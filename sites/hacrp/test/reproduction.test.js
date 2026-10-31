// make refresh's reproduction report (pipeline/reproduction.js), on the pinned data and with one check made to fail.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reproductionReport } from '../pipeline/reproduction.js';
import { DATA } from './pinned.js';

test('reproduction: on the pinned data, A1, every history year and every dollar check pass', () => {
  const { ok, text } = reproductionReport(DATA);
  assert.equal(ok, true);
  assert.match(text, /^A1 ok$/m);
  assert.match(text, new RegExp(`all ${DATA.history.years.length} years reproduce`));
  assert.match(text, new RegExp(`${DATA.dollars.checks.length} of ${DATA.dollars.checks.length} pass`));
  assert.doesNotMatch(text, /FAIL/);
});

test('reproduction: a failing dollar check fails the report and is marked in its table', () => {
  const [first, ...rest] = DATA.dollars.checks;
  const dollars = { ...DATA.dollars, checks: [{ ...first, pass: false }, ...rest] };
  const { ok, text } = reproductionReport({ ...DATA, dollars });
  assert.equal(ok, false);
  assert.match(text, new RegExp(`\\| \`${first.id}\` \\|.*\\*\\*FAIL\\*\\* \\|`));
});

test('reproduction: a build without a history says so', () => {
  const { ok, text } = reproductionReport({ ...DATA, history: null });
  assert.equal(ok, true);
  assert.match(text, /History: none in this build\./);
});
