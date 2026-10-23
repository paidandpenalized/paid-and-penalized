// The build-time loader's own checks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HAI_MEASURES, HAI_PINS } from '../pipeline/history.js';
import { changedOn, changelogEntries, checkMasterYear, infectionsByHospital, loadHacrp } from '../web/data.js';

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

test('changelogEntries: each dated heading with its items, newest first as written; text outside them is ignored', () => {
  const text = '# What changed\n\nSome words.\n\n## 2026-10-22\n- Second thing.\n- First thing.  \n\n## 2026-10-21\n- Older.\n';
  assert.deepEqual(changelogEntries(text), [{ date: '2026-10-22', items: ['Second thing.', 'First thing.'] }, { date: '2026-10-21', items: ['Older.'] }]);
  assert.deepEqual(changelogEntries(text.replaceAll('\n', '\r\n')), changelogEntries(text), 'Windows line endings');
  assert.deepEqual(changelogEntries('# only a title\n'), []);
  assert.deepEqual(changelogEntries('## 2026-10-22 \n- a\n'), [{ date: '2026-10-22', items: ['a'] }], 'trailing space after the date');
});

test('changelogEntries: an item before the first date, or a date with no item, fails the build', () => {
  assert.throws(() => changelogEntries('- loose item\n## 2026-10-22\n- a\n'), /an item before the first dated heading/);
  assert.throws(() => changelogEntries('## 2026-10-22\n- a\n## 2026-10-21\n\nOnly words.\n'), /a dated heading with no items/);
  assert.throws(() => changelogEntries('## 2026-10-22\n'), /a dated heading with no items/);
});

test('the changelog the pages read: dated entries, newest first, each with items, none repeated', () => {
  const { changes } = loadHacrp();
  assert.ok(changes.length > 0);
  const dates = changes.map((c) => c.date);
  assert.deepEqual([...dates].sort().reverse(), dates);
  assert.equal(new Set(dates).size, dates.length);
  assert.ok(changes.every((c) => c.items.length > 0 && c.items.every((i) => i.length > 0)));
});

test('infectionsByHospital: each hospital\'s SIR by calendar year, none for a result CMS did not publish; years in the order given', () => {
  const sir = (ccn, vals) => Object.fromEntries(HAI_MEASURES.map(([, k]) => [`hai_${k}_sir`, vals[k] ?? 'Not Available']).concat([['ccn', ccn]]));
  const files = [
    { cy: 2021, rows: [sir('990001', { 1: '1.250', 2: '0.000' }), sir('990002', { 1: '0.800' })] },
    { cy: 2022, rows: [sir('990001', { 1: '1.100', 6: '0.9' })] },
  ];
  const out = infectionsByHospital(files);
  assert.deepEqual([...out.keys()], ['990001', '990002']);
  assert.deepEqual(out.get('990001'), [
    { cy: 2021, sir: { CLABSI: 1.25, CAUTI: 0, SSI_COLON: null, SSI_HYST: null, MRSA: null, CDI: null } },
    { cy: 2022, sir: { CLABSI: 1.1, CAUTI: null, SSI_COLON: null, SSI_HYST: null, MRSA: null, CDI: 0.9 } },
  ]);
  assert.deepEqual(out.get('990002').map((r) => r.cy), [2021], 'listed only for the years it appears in');
  assert.equal(infectionsByHospital([]).size, 0);
});

test('on the pinned data, the history loads with the infection results: every year of the history, a hospital\'s SIRs by calendar year', () => {
  const data = loadHacrp();
  assert.ok(data.history, 'the committed history is read');
  assert.equal(data.history.fy, data.fy);
  assert.equal(data.history.years.at(-1).fy, data.fy);
  assert.deepEqual(data.history.infections.map((i) => i.cy), HAI_PINS.map((p) => p.cy));
  assert.ok(data.infections.size > 3000);
  for (const [, list] of data.infections) {
    assert.ok(list.length > 0 && list.length <= HAI_PINS.length);
    assert.deepEqual(list.map((r) => r.cy), [...list.map((r) => r.cy)].sort((a, b) => a - b), 'oldest first');
    for (const r of list) assert.ok(Object.values(r.sir).every((v) => v === null || (Number.isFinite(v) && v >= 0)));
  }
});

test('checkHistoryYear: a history that does not end with the HACRP file\'s year fails the build; none at all is fine', async () => {
  const { checkHistoryYear } = await import('../web/data.js');
  assert.doesNotThrow(() => checkHistoryYear(null, 2027));
  assert.doesNotThrow(() => checkHistoryYear({ fy: 2027 }, 2027));
  assert.throws(() => checkHistoryYear({ fy: 2026 }, 2027), /history ends at FY2026/);
});

test('changedOn: the newest built_at date (UTC) among the files given; a file that is absent is skipped; a stamp that is not an ISO timestamp stops the build', () => {
  const at = (built_at) => ({ built_at });
  assert.equal(changedOn([at('2026-10-20T16:29:57Z'), at('2026-10-23T14:02:59Z'), at('2026-10-22T12:15:15Z')]), '2026-10-23');
  assert.equal(changedOn([at('2026-10-20T16:29:57Z'), null, at('2026-10-19T00:00:00Z')]), '2026-10-20');
  assert.equal(changedOn([at('2026-10-20T16:29:57Z')]), '2026-10-20');
  for (const bad of [at(undefined), at(''), at('2026-10-20'), at('10/20/2026'), at('2026-02-30T00:00:00Z'), {}]) {
    assert.throws(() => changedOn([at('2026-10-20T16:29:57Z'), bad]), /built_at/, JSON.stringify(bad));
  }
  assert.throws(() => changedOn([null]), RangeError);
});

test('the pinned data\'s changed date is the newest built_at of the four files the pages read', () => {
  assert.match(loadHacrp().changedOn, /^\d{4}-\d{2}-\d{2}$/);
});
