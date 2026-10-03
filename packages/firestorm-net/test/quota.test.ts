import assert from 'node:assert/strict';
import { DEFAULT_QUOTA, addUsage, nextResetMs, quotaStatus, rollover, utcDay } from '../src/quota';
import { test } from './harness';

const noon = Date.UTC(2026, 9, 4, 12, 0, 0);

test('quota: a fresh day has room for many matches, limited by the tighter of writes and requests', () => {
  const s = quotaStatus({ day: utcDay(noon), writes: 0, requests: 0 }, noon);
  assert.equal(s.canStart, true);
  // 90,000 usable writes / 4,000 = 22; 90,000 usable requests / 2,500 = 36; writes decide.
  assert.equal(s.matchesLeft, 22);
});

test('quota: the gate closes when less than one match is left, on either limit', () => {
  const nearlyOutOfWrites = quotaStatus({ day: utcDay(noon), writes: 90_000 - 3_999, requests: 0 }, noon);
  assert.equal(nearlyOutOfWrites.matchesLeft, 0);
  assert.equal(nearlyOutOfWrites.canStart, false);
  const nearlyOutOfRequests = quotaStatus({ day: utcDay(noon), writes: 0, requests: 90_000 - 2_499 }, noon);
  assert.equal(nearlyOutOfRequests.canStart, false);
  const justEnough = quotaStatus({ day: utcDay(noon), writes: 90_000 - 4_000, requests: 0 }, noon);
  assert.equal(justEnough.matchesLeft, 1);
  assert.equal(justEnough.canStart, true);
});

test('quota: counters reset at 00:00 UTC', () => {
  const used = { day: utcDay(noon), writes: 95_000, requests: 80_000 };
  assert.equal(quotaStatus(used, noon).canStart, false);
  const tomorrow = nextResetMs(noon);
  assert.equal(tomorrow, Date.UTC(2026, 9, 5));
  assert.deepEqual(rollover(used, tomorrow), { day: '2026-10-05', writes: 0, requests: 0 });
  assert.equal(quotaStatus(used, tomorrow).canStart, true);
  const added = addUsage(used, tomorrow + 1000, 10, 5);
  assert.deepEqual(added, { day: '2026-10-05', writes: 10, requests: 5 });
});

test('quota: adding usage never goes negative and limits are configurable', () => {
  const u = addUsage({ day: utcDay(noon), writes: 5, requests: 5 }, noon, -50, -50);
  assert.deepEqual(u, { day: utcDay(noon), writes: 5, requests: 5 });
  const tiny = quotaStatus({ day: utcDay(noon), writes: 0, requests: 0 }, noon, { ...DEFAULT_QUOTA, writesLimit: 1000 });
  assert.equal(tiny.canStart, false);
});
