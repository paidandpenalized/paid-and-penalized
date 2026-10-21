// The program page's hospital table, its pure parts (web/hospital-table.js): the default order, the reader's sort,
// the state and name filters, and the #state= fragment. Synthetic rows only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareDefault, decodeState, filterRows, scoreOf, sortRows, stateCodes, withState } from '../web/hospital-table.js';

// [ccn, name, city, state, total (CMS text, true minus), decision]
const ROWS = [
  ['990011', 'Sample Medical Center', 'Sampleville', 'MD', '0.4000', 'N/A'],
  ['990012', 'Example General Hospital', 'Exampleton', 'AL', '0.3000', 'Yes'],
  ['990013', 'Example General Hospital', 'Aardvark', 'AL', '−0.1000', 'No'],
  ['990014', 'Zeta Community Hospital', 'Exampleton', 'AL', 'N/A', 'No'],
  ['990015', 'Alpha Regional Hospital', 'Testburg', 'CA', '−1.2500', 'No'],
  ['990016', 'Alpha Regional Hospital', 'Testburg', 'CA', '2.0000', 'Yes'],
];
const ccns = (rows) => rows.map((r) => r[0]);

test('the default order is state, then name, then city, then CCN', () => {
  assert.deepEqual(ccns([...ROWS].sort(compareDefault)), ['990013', '990012', '990014', '990015', '990016', '990011']);
});

test('decodeState accepts only #state=XX for a code in the data, any case, and ignores everything else', () => {
  const codes = stateCodes(ROWS);
  assert.deepEqual(codes, ['AL', 'CA', 'MD']);
  assert.equal(decodeState('#state=md', codes), 'MD');
  assert.equal(decodeState('#state=CA', codes), 'CA');
  assert.equal(decodeState('state=al', codes), 'AL');
  assert.equal(decodeState('#figure-2&state=al', codes), 'AL');
  for (const hash of ['', '#', '#state=', '#state=ZZ', '#state=PR', '#state=MDX', '#state=M', '#state=%4D%44', '#STATE=MD',
    '#whatif&CLABSI=1', '#state=<b>', '#state=a l', '#state=1A']) {
    assert.equal(decodeState(hash, codes), null, hash);
  }
  assert.equal(decodeState('#state=ZZ&state=ca', codes), 'CA', 'the first valid value wins');
  assert.equal(decodeState(undefined, codes), null);
});

test('scores sort by value, with "N/A" and blanks last in either direction; text sorts by locale; ties keep order', () => {
  assert.equal(scoreOf('−0.1000'), -0.1);
  assert.ok(Number.isNaN(scoreOf('N/A')) && Number.isNaN(scoreOf('')) && Number.isNaN(scoreOf('1e3')));
  const base = [...ROWS].sort(compareDefault);
  assert.deepEqual(ccns(sortRows(base, 'score', 1)), ['990015', '990013', '990012', '990011', '990016', '990014']);
  assert.deepEqual(ccns(sortRows(base, 'score', -1)), ['990016', '990011', '990012', '990013', '990015', '990014']);
  assert.deepEqual(ccns(sortRows(base, 'city', 1)), ['990013', '990012', '990014', '990011', '990015', '990016']);
  assert.deepEqual(ccns(sortRows(base, 'decision', -1)), ['990012', '990016', '990013', '990014', '990015', '990011']);
  assert.deepEqual(ccns(sortRows(base, null, 1)), ccns(base), 'no key: the default order');
  assert.deepEqual(ccns(base), ccns([...ROWS].sort(compareDefault)), 'sorting never changes its input');
  assert.throws(() => sortRows(base, 'ccn', 1), /key/);
});

test('filterRows keeps one state and names containing the query, case-insensitive', () => {
  assert.deepEqual(ccns(filterRows(ROWS, { state: 'AL' })), ['990012', '990013', '990014']);
  assert.deepEqual(ccns(filterRows(ROWS, { query: '  GENERAL ' })), ['990012', '990013']);
  assert.deepEqual(ccns(filterRows(ROWS, { state: 'CA', query: 'alpha' })), ['990015', '990016']);
  assert.deepEqual(ccns(filterRows(ROWS, { state: 'CA', query: 'general' })), []);
  assert.deepEqual(ccns(filterRows(ROWS, {})), ccns(ROWS));
});

test('withState sets or clears only the state= part of the fragment and keeps the rest', () => {
  assert.equal(withState('', 'MD'), '#state=MD');
  assert.equal(withState('#state=AL', 'MD'), '#state=MD');
  assert.equal(withState('#state=AL', null), '');
  assert.equal(withState('#hospitals', 'MD'), '#hospitals&state=MD');
  assert.equal(withState('#hospitals&state=al', null), '#hospitals');
  assert.equal(withState('#state=al&state=ca&figure-2', 'CA'), '#figure-2&state=CA');
});
