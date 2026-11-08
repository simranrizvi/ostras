import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-private-secret-with-at-least-32-characters';
process.env.TOKEN_ENCRYPTION_KEY = 'ab'.repeat(32);
process.env.WEB_ORIGIN = 'http://localhost:3000';
const { default: app } = await import('../src/app.js');
const { ContentPost } = await import('../src/modules/posts/ContentPost.model.js');
const { encrypt, decrypt } = await import('../src/utils/crypto.js');

test('encryption is randomized and detects ciphertext tampering', () => {
  const token = encrypt('private-token');
  assert.equal(decrypt(token), 'private-token');
  assert.notEqual(encrypt('private-token'), token);
  const parts = token.split('.');
  parts[2] = Buffer.from('tampered').toString('base64url');
  assert.throws(() => decrypt(parts.join('.')));
});

test('API integration: tenant isolation, post lifecycle, origin protection and error contracts', async (t) => {
  const database = await MongoMemoryServer.create({ instance: { args: ['--nounixsocket'] } });
  await mongoose.connect(database.getUri());
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    await database.stop();
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function request(path, { cookie, body, method = 'GET', headers = {} } = {}) {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return {
      status: response.status,
      headers: response.headers,
      data: response.status === 204 ? null : await response.json(),
    };
  }
  async function register(email) {
    const result = await request('/auth/register', {
      method: 'POST',
      body: {
        name: 'Test Owner',
        email,
        password: 'safe-password-123',
        brandName: 'Test Brand',
        niche: 'Software',
      },
    });
    assert.equal(result.status, 201);
    const cookie = result.headers.get('set-cookie').split(';')[0];
    assert.match(result.headers.get('set-cookie'), /HttpOnly/);
    return cookie;
  }
  const owner = await register('owner@example.com');
  const outsider = await register('other@example.com');
  const created = await request('/posts', {
    method: 'POST',
    cookie: owner,
    body: { title: 'Release [v1]', caption: 'Useful caption', hashtags: ['#launch'] },
  });
  assert.equal(created.status, 201);
  const id = created.data.post._id;
  await t.test('workspace boundaries and protected reads', async () => {
    assert.equal((await request(`/posts/${id}`, { cookie: outsider })).status, 404);
    assert.equal((await request(`/posts/${id}`, { cookie: owner })).status, 200);
    assert.equal((await request('/posts')).status, 401);
    assert.equal((await request('/posts', { cookie: outsider })).data.pagination.total, 0);
  });
  await t.test('search treats regular expression characters as literal input', async () => {
    assert.equal(
      (await request('/posts?search=%5Bv1%5D', { cookie: owner })).data.pagination.total,
      1,
    );
    assert.equal((await request('/posts?search=.*', { cookie: owner })).data.pagination.total, 0);
    assert.equal((await request('/posts?page=1.5', { cookie: owner })).status, 422);
  });
  await t.test('cookie writes from untrusted origins are blocked', async () => {
    assert.equal(
      (
        await request(`/posts/${id}`, {
          method: 'DELETE',
          cookie: owner,
          headers: { Origin: 'https://evil.example' },
        })
      ).status,
      403,
    );
  });
  await t.test('schedule, return to draft and duplicate preserve state rules', async () => {
    const scheduledAt = new Date(Date.now() + 3600_000).toISOString();
    assert.equal(
      (
        await request(`/posts/${id}/schedule`, {
          cookie: owner,
          method: 'POST',
          body: { scheduledAt },
        })
      ).data.post.status,
      'scheduled',
    );
    assert.equal((await request(`/posts/${id}`, { cookie: owner, method: 'DELETE' })).status, 409);
    const clone = await request(`/posts/${id}/duplicate`, { cookie: owner, method: 'POST' });
    assert.equal(clone.data.post.status, 'draft');
    assert.equal(clone.data.post.scheduledAt, null);
    assert.equal(
      (await request(`/posts/${id}/unschedule`, { cookie: owner, method: 'POST' })).data.post
        .status,
      'draft',
    );
    assert.equal(
      (
        await request(`/posts/${id}/schedule`, {
          cookie: owner,
          method: 'POST',
          body: { scheduledAt: '2000-01-01T00:00:00Z' },
        })
      ).status,
      422,
    );
  });
  await t.test('an editor cannot bypass scheduling validation or inject state', async () => {
    const result = await request(`/posts/${id}`, {
      cookie: owner,
      method: 'PATCH',
      body: { caption: 'Edited caption', status: 'published', scheduledAt: '2000-01-01T00:00:00Z' },
    });
    assert.equal(result.data.post.status, 'draft');
    assert.equal(result.data.post.scheduledAt, null);
  });
  await t.test('two concurrent publish claims have one winner', async () => {
    // Queueing is durable and only one concurrent request is accepted.
    const results = await Promise.all([
      request(`/posts/${id}/publish`, { cookie: owner, method: 'POST' }),
      request(`/posts/${id}/publish`, { cookie: owner, method: 'POST' }),
    ]);
    assert.deepEqual(results.map((result) => result.status).sort(), [202, 409]);
    const { runSchedulerTick } = await import('../src/jobs/scheduler.js');
    await runSchedulerTick();
    const post = await ContentPost.findById(id);
    assert.equal(post.status, 'failed');
    assert.equal(post.publishAttempts, 1);
    // Test actual simultaneous atomic claims independent of the fast failure path.
    const { claimPost } = await import('../src/modules/posts/publishing.service.js');
    await ContentPost.updateOne({ _id: id }, { $set: { status: 'scheduled' } });
    const claims = await Promise.all([
      claimPost({ _id: id, status: 'scheduled' }),
      claimPost({ _id: id, status: 'scheduled' }),
    ]);
    assert.equal(claims.filter(Boolean).length, 1);
    assert.equal(
      (
        await request(`/posts/${id}`, {
          cookie: owner,
          method: 'PATCH',
          body: { caption: 'Too late' },
        })
      ).status,
      409,
    );
  });
  await t.test('invalid IDs and JSON produce useful client errors with request IDs', async () => {
    const result = await request('/posts/invalid', { cookie: owner });
    assert.equal(result.status, 422);
    assert.ok(result.data.error.requestId);
    const response = await fetch(`${base}/posts`, {
      method: 'POST',
      headers: { Cookie: owner, 'Content-Type': 'application/json' },
      body: '{broken',
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, 'INVALID_JSON');
    assert.equal((await request('/ready')).status, 200);
  });
});
