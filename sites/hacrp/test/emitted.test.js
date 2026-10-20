// The committed HACRP emitted file against CMS's own values for every hospital. (Schema and methods log:
// pipeline/test/emitted-contract.test.js. Equal to a fresh build: golden.test.js.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv } from '../../../engine/js/csv.js';
import { whatIf } from '../../../engine/js/hacrp/whatif.js';
import { REPO_ROOT, readJson, readPinned } from '../../../pipeline/files.js';
import { SOURCES, emittedPath, fiscalYear } from '../pipeline/build.js';

const rows = parseCsv(readPinned(SOURCES[0]));
const emitted = readJson(REPO_ROOT + emittedPath(fiscalYear(rows)));

test('the emitted file reproduces CMS for every row', () => {
  assert.equal(emitted.hospitals.length, rows.length);
  emitted.hospitals.forEach((h, i) => {
    const row = rows[i];
    assert.equal(h.ccn, row['Facility ID']);
    assert.equal(h.totalText, row['Total HAC Score']);
    assert.equal(h.paymentReduction, row['Payment Reduction']);
    const r = whatIf(h, emitted.model);
    if (h.total === null) return assert.equal(r.available, false);
    assert.equal(r.after.score, h.total, h.ccn);
    assert.equal(r.after.flag, h.paymentReduction, h.ccn);
    assert.equal(String(h.total), String(Number(row['Total HAC Score'])));
  });
});
