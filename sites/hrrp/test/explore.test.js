// The program page's "Every hospital" Part: the filter controls, the empty table shell pointing at the hospitals asset
// (the rows are in the asset, never in the page), and the asset the build writes.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createContext } from '../../../pipeline/site/context.js';
import { withTemp } from '../../../pipeline/test/helpers.js';
import { PAGE_SIZE } from '../web/constants.js';
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

test('the hospitals asset: one row per hospital in the table\'s first order (name A to Z), fields in the documented order', () => {
  const a = hospitalsAsset(HOSPITALS, META);
  assert.equal(a.hospitalPath, HOSPITALS_PATH);
  assert.equal(a.pageSize, PAGE_SIZE);
  assert.deepEqual(a.rows.map((r) => r[0]), ['990012', '990013', '990011']);
  assert.ok(a.rows.every((r) => r.length === FIELDS.length));
  const zeta = a.rows.find((r) => r[0] === '990011');
  assert.equal(zeta[FIELDS.indexOf('alias')], 'EXAMPLE FORMER HOSPITAL');
  assert.equal(zeta[FIELDS.indexOf('teach')], 'major');
  assert.equal(zeta[FIELDS.indexOf('urban')], false);
  assert.equal(a.rows.find((r) => r[0] === '990012')[FIELDS.indexOf('pen')], null);
  assert.equal(a.rows.find((r) => r[0] === '990013')[FIELDS.indexOf('inactive')], 1);
  assert.equal(zeta[FIELDS.indexOf('conds')].length, a.conds.length, 'one letter for each condition');
  assert.match(zeta[FIELDS.indexOf('conds')], /^[cbfn]{6}$/);
});

test('the controls\' options come from the hospitals: states, peer groups, teaching statuses, bed bands, conditions', () => {
  const c = exploreControls(HOSPITALS, CONDITIONS);
  assert.deepEqual(c.states, ['ZY', 'ZZ']);
  assert.deepEqual(c.peers, [1, 2, 3]);
  assert.deepEqual(c.teach.map((x) => x.value), ['none', 'minor', 'major']);
  assert.equal(c.beds.length, 4);
  assert.equal(c.conds.length, 6);
  assert.equal(c.conds[0].short, 'Heart attack');
  assert.equal(c.pageSize, 25);
  assert.deepEqual(SORTS.map((s) => [s.key, s.dir]), [['name', 1], ['red', -1], ['pen', -1], ['beds', -1]], 'name A to Z first, the rest high to low');
});

test('the shell: every filter control, an empty table body, the asset address, hidden until a script has the rows', () => {
  const text = explorePart(exploreControls(HOSPITALS, CONDITIONS), { url: '/assets/hrrp-hospitals.abc.json' }).text;
  assert.match(text, /<div class="ht explore" id="explore-table" data-src="\/assets\/hrrp-hospitals\.abc\.json" data-page-size="25" hidden>/);
  for (const id of ['ex-text', 'ex-state', 'ex-peer', 'ex-cond', 'ex-teach', 'ex-beds', 'ex-loc', 'ex-pen', 'ex-sort']) assert.ok(text.includes(`id="${id}"`), id);
  assert.match(text, /<tbody><\/tbody>/);
  assert.ok(!text.includes('<tr><th scope="row"'), 'no data row in the page');
  assert.ok(!text.includes('EXAMPLE ZETA HOSPITAL'), 'no hospital name in the page');
  assert.match(text, /<option value="ZY">ZY<\/option>/);
  assert.match(text, /<option value="3">Group 3<\/option>/);
  assert.match(text, /<option value="red:-1">Cut, highest first<\/option>/);
  assert.match(text, /id="ex-empty" hidden>No hospital matches these filters\./);
  assert.match(text, /data-template="Showing \{from\} to \{to\} of \{n\}"/);
  assert.match(text, /class="ht-nojs">The searchable table needs JavaScript\./);
  assert.ok(!explorePart(exploreControls(HOSPITALS, CONDITIONS)).text.includes('data-src'), 'no source: no data-src');
});

test('the program page carries the explorer, and none of the hospital rows', () => {
  const places = buildPlaces(HOSPITALS, META);
  const view = programView(areaContext({ hospitals: HOSPITALS, meta: META, history: HISTORY, conditions: CONDITIONS, places }));
  const text = programPage({ view, robots: null, assets: ASSETS, hospitalsUrl: '/assets/hrrp-hospitals.abc.json' });
  assert.match(text, /<section class="part" id="explore"/);
  assert.match(text, /data-src="\/assets\/hrrp-hospitals\.abc\.json"/);
  assert.ok(!text.includes('EXAMPLE QUIET HOSPITAL') && !text.includes('EXAMPLE FORMER HOSPITAL'));
  for (const id of ['history', 'research']) assert.match(text, new RegExp(`<section class="part" id="${id}"`));
});

test('the build writes the hospitals asset (every row) and the program page points at it', () =>
  withTemp('pp-hrrp-explore-', async (dir) => {
    const data = { ...loadHrrpOnce(), hospitals: loadHrrpOnce().hospitals.slice(0, 6) };
    const ctx = createContext({ outDir: dir, env: 'production', assets: ASSETS });
    generateHrrp(ctx, { data, released: false, log: () => {} });
    const files = readdirSync(join(dir, 'assets')).filter((f) => /^hrrp-hospitals\.[0-9a-f]+\.json$/.test(f));
    assert.equal(files.length, 1);
    const asset = JSON.parse(readFileSync(join(dir, 'assets', files[0]), 'utf8'));
    assert.equal(asset.rows.length, 6);
    const program = readFileSync(join(dir, PROGRAM_PATH, 'index.html'), 'utf8');
    assert.ok(program.includes(`data-src="/assets/${files[0]}"`));
  }));
