import test from 'node:test';
import assert from 'node:assert/strict';
import { upcomingSlots, zonedInstant } from '../src/jobs/schedule-time.js';
import { listSchema, postSchema, scheduleSchema } from '../src/modules/posts/posts.schemas.js';

test('Karachi local time resolves without date drift across UTC midnight', () => {
  assert.equal(
    zonedInstant({ year: 2026, month: 11, day: 9 }, '01:00', 'Asia/Karachi').toISOString(),
    '2026-11-08T20:00:00.000Z',
  );
});
test('negative UTC offsets resolve into the next UTC day', () => {
  assert.equal(
    zonedInstant({ year: 2026, month: 11, day: 9 }, '23:30', 'America/Los_Angeles').toISOString(),
    '2026-11-10T07:30:00.000Z',
  );
});
test('DST gap is skipped and seasonal offsets are respected', () => {
  assert.equal(zonedInstant({ year: 2026, month: 3, day: 8 }, '02:30', 'America/New_York'), null);
  assert.equal(
    zonedInstant({ year: 2026, month: 7, day: 8 }, '10:00', 'America/New_York').toISOString(),
    '2026-07-08T14:00:00.000Z',
  );
});
test('weekly rhythm creates exactly five future slots without duplicates', () => {
  const now = new Date('2026-11-08T12:00:00Z');
  const slots = upcomingSlots(
    { postsPerWeek: 5, preferredTimes: ['10:00'], timezone: 'Asia/Karachi' },
    now,
    7,
  );
  assert.equal(slots.length, 5);
  assert.equal(new Set(slots.map(String)).size, 5);
  assert.ok(slots.every((slot) => slot > now));
});
test('pagination rejects decimals, arrays, excessive limits and invalid ranges', () => {
  for (const query of [
    { page: '1.5' },
    { limit: '51' },
    { search: { $ne: '' } },
    { status: 'invalid' },
    { from: '2026-11-10T00:00:00Z', to: '2026-11-09T00:00:00Z' },
  ])
    assert.equal(listSchema.safeParse(query).success, false);
});
test('caption and hashtags share a 2200 character budget', () => {
  assert.equal(
    postSchema.safeParse({ caption: 'a'.repeat(2198), hashtags: ['#long'] }).success,
    false,
  );
  assert.equal(
    postSchema.safeParse({ caption: 'Useful post', imageUrl: 'javascript:alert(1)' }).success,
    false,
  );
  assert.equal(
    postSchema.safeParse({ caption: 'Useful post', imageUrl: 'https://example.com/art.jpg' })
      .success,
    true,
  );
});
test('past schedules are rejected', () => {
  assert.equal(scheduleSchema.safeParse({ scheduledAt: '2000-01-01T00:00:00Z' }).success, false);
});
