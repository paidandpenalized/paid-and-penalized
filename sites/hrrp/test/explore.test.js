// The program page's "Every hospital" Part: the filter controls, the empty table shell pointing at the hospitals asset
// (the rows are in the asset, never in the page), and the asset the build writes.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createContext } from '../../../pipeline/site/context.js';
import { withTemp } from '../../../pipeline/test/helpers.js';
import { FIELDS, SORTS, exploreControls, hospitalsAsset } from '../web/figures/explore-data.js';
import { explorePart } from '../web/figures/explore.js';
import { generateHrrp } from '../web/generate.js';
import { HOSPITALS_PATH, PROGRAM_PATH } from '../web/links.js';
import { programPage } from '../web/pages/program.js';
import { buildPlaces } from '../web/places.js';
import { areaContext, programView } from '../web/view.js';
import { ASSETS, CONDITIONS, HISTORY, META, NONE_BELOW, hospital, loadHrrpOnce } from './fixtures.js';

const HOSPITALS = [
  hospital({ id: '990011', name: 'EXAMPLE ZETA HOSPITAL', alias: 'EXAMPLE FORMER HOSPITAL', st: 'ZY', peer: 3, teach: 'major', beds: 600, urban: false }),
  hospital({ id: '990012', name: 'EXAMPLE ALPHA HOSPITAL', st: 'ZZ', peer: 1, teach: 'none', beds: 40, pen: null }),
  { ...NONE_BELOW, id: '990013', name: 'EXAMPLE QUIET HOSPITAL', inactive: { date: '2026-03-30', reason: 'x' } },
];

test('the search asset: a short row per hospital in name order (the explorer reads the place pages\' rows asset instead)', () => {
  const a = hospitalsAsset(HOSPITALS);
  assert.equal(a.hospitalPath, HOSPITALS_PATH);
  assert.deepEqual(a.fields, FIELDS);
  assert.deepEqual(a.rows.map((r) => r[0]), ['990012', '990013', '990011']);
  assert.ok(a.rows.every((r) => r.length === FIELDS.length));
});

test('the controls\' options come from the hospitals: states, peer groups, teaching statuses, bed bands, conditions', () => {
  const c = exploreControls(HOSPITALS, CONDITIONS, META.fy);
  assert.deepEqual(c.states, ['ZY', 'ZZ']);
  assert.deepEqual(c.peers, [1, 2, 3]);
  assert.deepEqual(c.teach.map((x) => x.value), ['none', 'minor', 'major']);
  assert.equal(c.beds.length, 4);
  assert.equal(c.conds.length, 6);
  assert.equal(c.conds[0].short, 'Heart attack');
  assert.equal(c.pageSize, 25);
  assert.deepEqual(SORTS.map((s) => s.key), ['name', 'cut', 'dollars', 'beds'], 'name A to Z first, the rest high to low');
  assert.match(c.csvHref, /^\/data\/hrrp\/fy\d+\/hrrp-fy\d+-hospitals\.csv$/);
});

test('the shell: every filter control, an empty table body, the asset address, hidden until a script has the rows', () => {
  const text = explorePart(exploreControls(HOSPITALS, CONDITIONS, META.fy), { url: '/assets/hrrp-hospitals.abc.json' }).text;
  assert.match(text, /<div class="ht explore ph" id="explore-table" data-ph data-all data-prefix="ex" data-csv="[^"]+\.csv" data-src="\/assets\/hrrp-hospitals\.abc\.json" data-page-size="25" hidden>/);
  for (const id of ['ex-text', 'ex-state', 'ex-peer', 'ex-cond', 'ex-teach', 'ex-beds', 'ex-loc', 'ex-pen', 'ex-sort']) assert.ok(text.includes(`id="${id}"`), id);
  assert.match(text, /<tbody><\/tbody>/);
  assert.ok(!text.includes('<tr><th scope="row"'), 'no data row in the page');
  assert.ok(!text.includes('EXAMPLE ZETA HOSPITAL'), 'no hospital name in the page');
  assert.match(text, /<option value="ZY">ZY<\/option>/);
  assert.match(text, /<option value="3">Group 3<\/option>/);
  assert.match(text, /<option value="cut">Cut, highest first<\/option>/);
  assert.match(text, /id="ex-empty" hidden>No hospital matches these filters\./);
  assert.match(text, /data-template="\{from\}–\{to\} of \{n\}"/);
  assert.match(text, /class="ht-nojs">The searchable table needs JavaScript\.[^<]*<a href="\/data\/hrrp\/fy\d+\/hrrp-fy\d+-hospitals\.csv" download>/);
  assert.ok(!explorePart(exploreControls(HOSPITALS, CONDITIONS, META.fy)).text.includes('data-src'), 'no source: no data-src');
});

test('the program page carries the explorer, and none of the hospital rows', () => {
  const places = buildPlaces(HOSPITALS, META);
  const view = programView(areaContext({ hospitals: HOSPITALS, meta: META, history: HISTORY, conditions: CONDITIONS, places }));
  const text = programPage({ view, robots: null, assets: ASSETS, hospitalsUrl: '/assets/hrrp-hospitals.abc.json', rowsUrl: '/assets/hrrp-place-rows.abc.json' });
  assert.match(text, /<section class="part" id="explore"/);
  assert.match(text, /<div class="ht explore ph"[^>]* data-src="\/assets\/hrrp-place-rows\.abc\.json"/);
  assert.ok(!text.includes('EXAMPLE QUIET HOSPITAL') && !text.includes('EXAMPLE FORMER HOSPITAL'));
  for (const id of ['history', 'research']) assert.match(text, new RegExp(`<section class="part" id="${id}"`));
});

test('the build writes the search asset and the rows asset; the program page\'s explorer points at the rows asset, which the place pages share', () =>
  withTemp('pp-hrrp-explore-', async (dir) => {
    const data = { ...loadHrrpOnce(), hospitals: loadHrrpOnce().hospitals.slice(0, 6) };
    const ctx = createContext({ outDir: dir, env: 'production', assets: ASSETS });
    generateHrrp(ctx, { data, released: false, log: () => {} });
    const named = (re) => readdirSync(join(dir, 'assets')).filter((f) => re.test(f));
    const [search, rows] = [named(/^hrrp-hospitals\.[0-9a-f]+\.json$/), named(/^hrrp-place-rows\.[0-9a-f]+\.json$/)];
    assert.equal(search.length + rows.length, 2);
    assert.equal(JSON.parse(readFileSync(join(dir, 'assets', search[0]), 'utf8')).rows.length, 6);
    assert.equal(JSON.parse(readFileSync(join(dir, 'assets', rows[0]), 'utf8')).rows.length, 6);
    const program = readFileSync(join(dir, PROGRAM_PATH, 'index.html'), 'utf8');
    assert.ok(program.includes(` data-src="/assets/${rows[0]}"`));
    assert.ok(!/<div class="ht explore[^>]*data-src="\/assets\/hrrp-hospitals\./.test(program), 'the explorer does not read the search asset');
  }));

// ---------- the browser's rules, on the rows asset ----------

const explorerRows = async (hospitals) => {
  const { placeRowsAsset } = await import('../web/figures/place-table-data.js');
  const { placeRows } = await import('../client/place-rows.js');
  const asset = JSON.parse(JSON.stringify(placeRowsAsset(hospitals, META, CONDITIONS)));
  return placeRows(asset, { all: true });
};

test('the explorer keeps every hospital, with the inactive flag and the beds source', async () => {
  const rows = await explorerRows([...HOSPITALS, hospital({ id: '990014', bedsSrc: 'cr' })]);
  assert.equal(rows.length, 4);
  assert.equal(rows.find((r) => r.h.id === '990013').h.inactive, 1);
  assert.equal(rows.find((r) => r.h.id === '990014').h.bedsSrc, 'cr');
  const { hospitalRow } = await import('../web/figures/place-row.js');
  const quiet = String(hospitalRow(rows.find((r) => r.h.id === '990013'), CONDITIONS, { prefix: 'ex' }));
  assert.match(quiet, /<span class="ph__tag"[^>]*>inactive<\/span>/);
  assert.match(String(hospitalRow(rows.find((r) => r.h.id === '990014'), CONDITIONS, { prefix: 'ex' })), /cost rpt/);
  assert.ok(!/inactive|cost rpt/.test(String(hospitalRow(rows.find((r) => r.h.id === '990011'), CONDITIONS, { prefix: 'ex' }))));
});

test('filters: text finds a former name, penalized only means a factor below 1, the condition follows the counted conditions', async () => {
  const { filterRows } = await import('../client/place-rows.js');
  const rows = await explorerRows(HOSPITALS);
  assert.deepEqual(filterRows(rows, { text: 'former' }).map((r) => r.h.id), ['990011']);
  assert.ok(filterRows(rows, { pen: true }).every((r) => r.h.paf < 1));
  for (const i of [0, 2, 5]) assert.ok(filterRows(rows, { cond: String(i) }).every((r) => r.states[i] === 'counted'));
  assert.deepEqual(filterRows(rows, { st: 'ZY', peer: '3', teach: 'major', beds: '500+', loc: 'rural' }).map((r) => r.h.id), ['990011']);
  assert.equal(filterRows(rows, { st: 'ZZ', peer: '3' }).length, 0, 'the empty state');
});

test('sort: name A to Z, the rest high to low, a blank last', async () => {
  const { sortRows } = await import('../client/place-rows.js');
  const rows = await explorerRows([...HOSPITALS, hospital({ id: '990014', name: 'EXAMPLE BETA HOSPITAL', pen: 5, beds: null })]);
  assert.deepEqual(sortRows(rows, 'name').map((r) => r.h.name), [...rows.map((r) => r.h.name)].sort((a, b) => a.localeCompare(b, 'en')));
  const dollars = sortRows(rows, 'dollars').map((r) => r.h.pen);
  assert.deepEqual(dollars.filter((d) => d !== null), dollars.filter((d) => d !== null).sort((a, b) => b - a));
  assert.equal(dollars.findIndex((d) => d === null), dollars.length - dollars.filter((d) => d === null).length, 'blanks after every figure');
  const beds = sortRows(rows, 'beds').map((r) => r.h.beds);
  assert.equal(beds.at(-1), null);
  assert.deepEqual(sortRows(rows, 'cut').map((r) => r.h.red), rows.map((r) => r.h.red).sort((a, b) => b - a));
});

test('the status line: 1 to 25 of N with thousands separators; none with no rows', async () => {
  const { statusLine } = await import('../client/place-rows.js');
  const tpl = '{from}–{to} of {n}';
  assert.equal(statusLine(tpl, { page: 1, size: 25, n: 3123 }), '1–25 of 3,123');
  assert.equal(statusLine(tpl, { page: 125, size: 25, n: 3123 }), '3,101–3,123 of 3,123');
  assert.equal(statusLine(tpl, { page: 1, size: 25, n: 0 }), '');
});

test('copy and download: the filtered rows, in the current sort, from the hospitals CSV', async () => {
  const { csvSubset, filterRows, sortRows } = await import('../client/place-rows.js');
  const { hospitalCsv } = await import('../web/csv.js');
  const list = [...HOSPITALS, hospital({ id: '990014', name: 'EXAMPLE BETA HOSPITAL', st: 'ZY' })];
  const shown = sortRows(filterRows(await explorerRows(list), { st: 'ZY' }), 'name');
  const csv = csvSubset(hospitalCsv(list), shown.map((r) => r.h.id));
  const cells = csv.trimEnd().split('\n').slice(1).map((l) => l.slice(0, l.indexOf(',')));
  assert.deepEqual(cells, shown.map((r) => r.h.id));
  assert.deepEqual(cells, ['990014', '990011']);
});

test('the shared row names the place and the CCN: "city, ST · CCN id"', async () => {
  const { hospitalRow } = await import('../web/figures/place-row.js');
  const [r] = await explorerRows([hospital({ id: '990014' })]);
  assert.match(String(hospitalRow(r, CONDITIONS)), /<span class="nb__place">[^<]+, [A-Z]{2} · CCN 990014<\/span>/);
});
