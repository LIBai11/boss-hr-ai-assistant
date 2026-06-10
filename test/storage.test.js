const test = require('node:test');
const assert = require('node:assert/strict');

const storage = require('../src/modules/storage.js');

test('daily usage uses Asia Shanghai date and resets stale counters', () => {
  const now = new Date('2026-06-10T16:30:00.000Z');
  assert.equal(storage.dateKeyInTimeZone(now), '2026-06-11');

  assert.deepEqual(storage.normalizeDailyUsage({
    date: '2026-06-10',
    follow_runs: 3,
    proactive_runs: 2,
    proactive_resume_views: 199
  }, now), {
    date: '2026-06-11',
    follow_runs: 0,
    proactive_runs: 0,
    proactive_resume_views: 0
  });
});

test('proactive resume counter does not block new resume views', () => {
  assert.equal(storage.canOpenProactiveResume({ proactive_resume_views: 199 }), true);
  assert.equal(storage.canOpenProactiveResume({ proactive_resume_views: 200 }), true);
  assert.equal(storage.canOpenProactiveResume({ proactive_resume_views: 250 }), true);
});
