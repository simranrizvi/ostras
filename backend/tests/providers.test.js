import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

process.env.OPENAI_API_KEY = 'test-key-never-sent';
process.env.TOKEN_ENCRYPTION_KEY = 'ab'.repeat(32);
process.env.N8N_WEBHOOK_URL = 'https://n8n.example.test/events';
process.env.N8N_WEBHOOK_SECRET = 'test-only-webhook-secret';
const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'social-flow-images-'));
process.env.UPLOAD_DIR = folder;
const { generateSocialCopy, generateSocialImage } =
  await import('../src/modules/posts/ai.service.js');
const { sendN8nEvent } = await import('../src/modules/integrations/n8n.service.js');
const { publishInstagramPost } = await import('../src/modules/integrations/instagram.service.js');
const { encrypt } = await import('../src/utils/crypto.js');
const brand = { name: 'Demo', niche: 'Engineering', voice: 'Friendly', goals: [] };
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

test.after(async () => {
  await fs.rm(folder, { recursive: true, force: true });
});
test('AI output is validated and caption plus hashtags fits the provider limit', async (t) => {
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.ok(options.signal);
    assert.equal(JSON.parse(options.body).response_format.type, 'json_object');
    return json({
      choices: [
        {
          message: {
            content: JSON.stringify({
              caption: 'a'.repeat(2200),
              hashtags: ['##launch', ' useful advice '],
            }),
          },
        },
      ],
    });
  });
  const result = await generateSocialCopy({ brand, topic: 'Release', platform: 'Instagram' });
  assert.deepEqual(result.hashtags, ['#launch', '#usefuladvice']);
  assert.equal([result.caption, result.hashtags.join(' ')].join('\n\n').length, 2200);
});
test('malformed AI responses produce an upstream error, not an unhandled parser error', async (t) => {
  t.mock.method(globalThis, 'fetch', async () =>
    json({ choices: [{ message: { content: 'not json' } }] }),
  );
  await assert.rejects(generateSocialCopy({ brand, topic: 'Release', platform: 'Instagram' }), {
    statusCode: 502,
    code: 'AI_INVALID_RESPONSE',
  });
});
test('generated media requests JPEG and writes the returned bytes to shared storage', async (t) => {
  const bytes = Buffer.from([255, 216, 255, 217]);
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.equal(JSON.parse(options.body).output_format, 'jpeg');
    return json({ data: [{ b64_json: bytes.toString('base64') }] });
  });
  const url = await generateSocialImage({ brand, topic: 'Launch' });
  assert.ok(url.endsWith('.jpg'));
  assert.deepEqual(await fs.readFile(path.join(folder, path.basename(url))), bytes);
});
test('n8n signature covers the exact bytes delivered and non-2xx deliveries fail', async (t) => {
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const expected = crypto
      .createHmac('sha256', process.env.N8N_WEBHOOK_SECRET)
      .update(options.body)
      .digest('hex');
    assert.equal(options.headers['x-social-flow-signature'], `sha256=${expected}`);
    assert.equal(JSON.parse(options.body).event, 'post.created');
    return json({ received: true });
  });
  assert.equal((await sendN8nEvent('post.created', { postId: 'example' })).delivered, true);
  globalThis.fetch.mock.mockImplementation(async () => json({ error: 'Unavailable' }, 503));
  await assert.rejects(sendN8nEvent('post.created'), /n8n returned 503/);
});
test('publishing persists the provider container before sending media_publish', async (t) => {
  const calls = [];
  let saved = false;
  const post = {
    caption: 'Reviewed caption',
    hashtags: ['#launch'],
    imageUrl: 'https://example.test/art.jpg',
    remoteContainerId: '',
    async save() {
      saved = true;
    },
  };
  const account = {
    accountId: 'account123',
    encryptedAccessToken: encrypt('private-token'),
    tokenExpiresAt: new Date(Date.now() + 30 * 86400_000),
  };
  t.mock.method(globalThis, 'fetch', async (url) => {
    const pathname = new URL(url).pathname;
    calls.push(pathname);
    if (pathname.endsWith('/media_publish')) {
      assert.equal(saved, true);
      return json({ id: 'published123' });
    }
    if (pathname.endsWith('/media')) return json({ id: 'container123' });
    return json({ status_code: 'FINISHED' });
  });
  assert.equal(await publishInstagramPost({ post, account }), 'published123');
  assert.equal(post.remoteContainerId, 'container123');
  assert.equal(calls.filter((value) => value.endsWith('/media')).length, 1);
});
