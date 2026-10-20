// The build-time loader's own checks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkMasterYear, loadHacrp } from '../web/data.js';

test('the master must be built for the same HACRP year as the HACRP file; the message names both years', () => {
  checkMasterYear({ programYears: { hacrp: 2026 } }, 2026);
  assert.throws(() => checkMasterYear({ programYears: { hacrp: 2025 } }, 2026), /FY2026.*HACRP year is 2025/);
  assert.throws(() => checkMasterYear({ programYears: {} }, 2026), /FY2026.*HACRP year is undefined/);
  assert.throws(() => checkMasterYear({}, 2026), RangeError);
});

test('the pinned data loads: the newest master carries the file\'s HACRP year', () => {
  assert.ok(loadHacrp().master.size > 0);
});

test('on the pinned data, a measure cell is blank or "N/A" exactly when the parsed number is null', () => {
  const blank = (text) => text === '' || text === 'N/A';
  for (const h of loadHacrp().hospitals) {
    for (const m of Object.values(h.measures)) {
      assert.equal(m.value === null, blank(m.valueText), `value "${m.valueText}"`);
      assert.equal(m.z === null, blank(m.zText), `z "${m.zText}"`);
    }
  }
});
