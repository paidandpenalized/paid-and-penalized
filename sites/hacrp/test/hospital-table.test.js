// The program page's hospital table, its pure parts (web/hospital-table.js): the default order, the reader's sort,
// the state and name filters, and the #state= fragment. Synthetic rows only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareByName, compareDefault, decodeState, filterRows, sortRows, stateCodes, tableRows, withState } from '../web/hospital-table.js';

// [ccn, name, city, state, total (CMS's text, hyphen-minus), decision]
const ROWS = [
  ['990011', 'Sample Medical Center', 'Sampleville', 'MD', '0.4000', 'N/A'],
  ['990012', 'Example General Hospital', 'Exampleton', 'AL', '0.3000', 'Yes'],
  ['990013', 'Example General Hospital', 'Aardvark', 'AL', '-0.1000', 'No'],
  ['990014', 'Zeta Community Hospital', 'Exampleton', 'AL', 'N/A', 'No'],
  ['990015', 'Alpha Regional Hospital', 'Testburg', 'CA', '-1.2500', 'No'],
  ['990016', 'Alpha Regional Hospital', 'Testburg', 'CA', '2.0000', 'Yes'],
];
const ccns = (rows) => rows.map((r) => (r.cells ?? r)[0]);
// The rows as the browser sorts and filters them, read once.
const TABLE = tableRows(ROWS);

test('the default order is state, then name, then city, then CCN', () => {
  assert.deepEqual(ccns([...ROWS].sort(compareDefault)), ['990013', '990012', '990014', '990015', '990016', '990011']);
});

test('the search\'s order is name, then state, then city; full ties keep their order', () => {
  assert.deepEqual(ccns([...ROWS].sort(compareByName)), ['990015', '990016', '990013', '990012', '990011', '990014']);
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
  assert.deepEqual(TABLE.map((r) => r.score), [0.4, 0.3, -0.1, NaN, -1.25, 2]);
  // "N/A", blanks and display text (a true minus) are not scores (the shared numberOrNaN).
  for (const s of ['N/A', '', ' ', '−0.1000']) assert.ok(Number.isNaN(tableRows([['990019', 'X', 'Y', 'AL', s, 'No']])[0].score), s);
  const base = sortRows(TABLE, null, 1);
  assert.deepEqual(ccns(sortRows(base, 'score', 1)), ['990015', '990013', '990012', '990011', '990016', '990014']);
  assert.deepEqual(ccns(sortRows(base, 'score', -1)), ['990016', '990011', '990012', '990013', '990015', '990014']);
  assert.deepEqual(ccns(sortRows(base, 'city', 1)), ['990013', '990012', '990014', '990011', '990015', '990016']);
  assert.deepEqual(ccns(sortRows(base, 'decision', -1)), ['990012', '990016', '990013', '990014', '990015', '990011']);
  assert.deepEqual(ccns(sortRows(base, null, 1)), ccns(base), 'no key: the default order');
  assert.deepEqual(ccns(base), ccns([...ROWS].sort(compareDefault)), 'no key: the default order, as the asset is written');
  assert.deepEqual(ccns(TABLE), ccns(ROWS), 'sorting never changes its input');
  assert.throws(() => sortRows(base, 'ccn', 1), /key/);
});

test('filterRows keeps one state and names containing the query, case-insensitive', () => {
  assert.deepEqual(ccns(filterRows(TABLE, { state: 'AL' })), ['990012', '990013', '990014']);
  assert.deepEqual(ccns(filterRows(TABLE, { query: '  GENERAL ' })), ['990012', '990013']);
  assert.deepEqual(ccns(filterRows(TABLE, { state: 'CA', query: 'alpha' })), ['990015', '990016']);
  assert.deepEqual(ccns(filterRows(TABLE, { state: 'CA', query: 'general' })), []);
  assert.deepEqual(ccns(filterRows(TABLE, {})), ccns(ROWS));
  assert.equal(TABLE[1].name, 'example general hospital', 'the name is lowercased once, when the rows are read');
});

test('a sorted order, filtered, equals the filtered rows sorted: the browser sorts once and filters as the reader types', () => {
  const base = sortRows(TABLE, null, 1);
  const views = [{ state: 'AL' }, { query: 'hospital' }, { state: 'CA', query: 'ALPHA' }, { query: 'none' }, {}];
  for (const [key, dir] of [[null, 1], ['score', 1], ['score', -1], ['name', 1], ['city', -1], ['decision', 1], ['state', -1]]) {
    const ordered = sortRows(base, key, dir);
    for (const v of views) {
      assert.deepEqual(ccns(filterRows(ordered, v)), ccns(sortRows(filterRows(base, v), key, dir)), `${key} ${dir} ${JSON.stringify(v)}`);
    }
  }
});

test('withState sets or clears only the state= part of the fragment and keeps the rest', () => {
  assert.equal(withState('', 'MD'), '#state=MD');
  assert.equal(withState('#state=AL', 'MD'), '#state=MD');
  assert.equal(withState('#state=AL', null), '');
  assert.equal(withState('#hospitals', 'MD'), '#hospitals&state=MD');
  assert.equal(withState('#hospitals&state=al', null), '#hospitals');
  assert.equal(withState('#state=al&state=ca&figure-2', 'CA'), '#figure-2&state=CA');
});
