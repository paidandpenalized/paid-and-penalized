import { test } from 'node:test';
import assert from 'node:assert/strict';
import { builtOn, isIsoDate, isoParts, onCalendar } from '../dates.js';

test('onCalendar: whether a year, month and day exist together, leap days included', () => {
  for (const [y, m, d] of [[2026, 8, 13], [2024, 2, 29], [2026, 12, 31], [2026, 1, 1]]) assert.equal(onCalendar(y, m, d), true, `${y}-${m}-${d}`);
  for (const [y, m, d] of [[2026, 2, 30], [2025, 2, 29], [2026, 13, 1], [2026, 0, 1], [2026, 4, 31], [2026, 1, 0]]) assert.equal(onCalendar(y, m, d), false, `${y}-${m}-${d}`);
});

test('isoParts: [year, month, day] of a YYYY-MM-DD text; any other text is a RangeError (the calendar is not checked)', () => {
  assert.deepEqual(isoParts('2026-08-13'), [2026, 8, 13]);
  assert.deepEqual(isoParts('2026-02-30'), [2026, 2, 30]);
  for (const bad of ['2026-8-13', '2026-08-13T00:00:00Z', 'August 13, 2026', '', undefined, 20260813]) assert.throws(() => isoParts(bad), RangeError, String(bad));
});

test('isIsoDate says whether a text is YYYY-MM-DD on the calendar', () => {
  for (const ok of ['2026-08-13', '2024-02-29']) assert.equal(isIsoDate(ok), true, ok);
  for (const bad of ['2026-02-30', '2026-13-01', '2026-8-13', '2026-08-13T00:00:00Z', 'August 13, 2026', '', undefined, null, 20260813]) {
    assert.equal(isIsoDate(bad), false, String(bad));
  }
});

test('builtOn: the UTC day of a whole-second timestamp on the calendar, else null', () => {
  assert.equal(builtOn('2026-10-20T16:29:57Z'), '2026-10-20');
  assert.equal(builtOn('2024-02-29T00:00:00Z'), '2024-02-29');
  for (const bad of ['2026-02-30T00:00:00Z', '2026-10-20', '2026-10-20T16:29:57', '2026-10-20T16:29:57.5Z', '2026-10-20T16:29:57+00:00', '', undefined, null, 20261020]) {
    assert.equal(builtOn(bad), null, String(bad));
  }
});
