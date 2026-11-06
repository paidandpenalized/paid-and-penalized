// A place page's two tables (figures/place-table-data.js, place-table.js): the places inside it (25 to a page, a state's "Outside metro
// areas" row unlinked, none on a metro page) with a CSV, and the area's hospitals (every row in the page, the state filter only where
// the place spans states) with a CSV that a metro area shares with the hospital pages. First on synthetic hospitals, then on the data.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseCsv } from '../../../engine/js/csv.js';
import { createContext } from '../../../pipeline/site/context.js';
import { ASSETS, withTemp } from '../../../pipeline/test/helpers.js';
import { generateHrrp } from '../web/generate.js';
import { csvPath, hospitalPath } from '../web/links.js';
import { buildPlaces } from '../web/places.js';
import { placeColumns } from '../web/csv.js';
import { areaCsvName } from '../web/figures/neighbors-data.js';
import { placePage } from '../web/pages/place.js';
import { areaContext, placeView } from '../web/view.js';
import { ASSETS as PAGE_ASSETS, CONDITIONS, HISTORY, META, areaOf, hospital, loadHrrpOnce } from './fixtures.js';

const placeOf = (ctx, kind, key) => ctx.places.list.find((p) => p.kind === kind && p.key === key);
const pageOf = (ctx, place) => placePage({ view: placeView(place, ctx), robots: null, assets: PAGE_ASSETS, shared: ctx });
const JUNK = /NaN|undefined|null|\[object Object\]/;
const quiet = { log: () => {} };

test('the child table: one row for each place inside, the hospitals outside the metro areas unlinked, the CSV linked; none on a metro page', () => {
  const hs = [
    hospital({ id: '990101', cbsa: '99901', cbsaName: 'Exampleton, ZZ', red: 1 }), hospital({ id: '990102', cbsa: '99901', cbsaName: 'Exampleton, ZZ', red: 0, paf: 1, pen: 0 }),
    hospital({ id: '990103', cbsa: null, cbsaName: null, red: 2 }),
  ];
  const ctx = areaContext({ hospitals: hs, meta: META, history: HISTORY, conditions: CONDITIONS, places: buildPlaces(hs, META) });
  const view = placeView(placeOf(ctx, 'state', 'zz'), ctx);
  assert.equal(view.children.column, 'Metro area');
  assert.deepEqual(view.children.rows.map((r) => [r.label, r.n, r.href === null]), [['Exampleton, ZZ', 2, false], ['Outside metro areas', 1, true]]);
  const text = pageOf(ctx, placeOf(ctx, 'state', 'zz'));
  assert.ok(!JUNK.test(text.slice(text.indexOf('<main'), text.indexOf('</main>'))));
  assert.match(text, /<h2 id="kids-h">Metro areas<\/h2>/);
  assert.match(text, /<th scope="row">Outside metro areas<\/th>/);
  assert.match(text, /<th scope="row"><a href="\/hrrp\/metro\/99901\/">Exampleton, ZZ<\/a><\/th>/);
  assert.ok(text.includes(`href="${csvPath(META.fy, view.children.csvName)}" download`));
  assert.equal(view.children.csvName, 'hrrp-fy2027-place-state-zz-metros');
  assert.ok(!pageOf(ctx, placeOf(ctx, 'metro', '99901')).includes('id="kids-h"'), 'no child table on a metro page');
});

test('the child table pages by 25 and the CSV has the place columns with the first named for the kind', () => {
  const many = Array.from({ length: 30 }, (_, i) => hospital({ id: String(990200 + i), cbsa: String(90000 + i), cbsaName: `Metro ${String.fromCharCode(65 + (i % 26))}${i}, ZZ` }));
  const ctx = areaContext({ hospitals: many, meta: META, history: HISTORY, conditions: CONDITIONS, places: buildPlaces(many, META) });
  const view = placeView(placeOf(ctx, 'state', 'zz'), ctx);
  assert.deepEqual(view.children.pages.map((p) => p.length), [25, 5]);
  const text = pageOf(ctx, placeOf(ctx, 'state', 'zz'));
  assert.equal([...text.matchAll(/<tbody data-page="/g)].length, 2, 'two child pages (the hospitals table has one body, which is not a page)');
  assert.ok(text.includes('class="seg kids__pager"'));
});

test('the hospitals table: every hospital, largest cut first, linked; the state filter only where the place spans states', () => {
  const ctx = areaOf();
  const one = pageOf(ctx, placeOf(ctx, 'state', 'zz'));
  const spans = pageOf(ctx, placeOf(ctx, 'metro', '99901'));
  const rowsOf = (text) => [...text.matchAll(/<tr data-red="([^"]*)"|<tr[^>]* data-red="([^"]*)"/g)].map((m) => Number(m[1] ?? m[2]));
  const reds = rowsOf(one);
  assert.equal(reds.length, placeOf(ctx, 'state', 'zz').hospitals.length);
  assert.deepEqual(reds, [...reds].sort((a, b) => b - a), 'largest cut first');
  assert.match(one, /<h2 id="ph-h">Hospitals in Zedland<\/h2>/);
  for (const h of placeOf(ctx, 'state', 'zz').hospitals) assert.ok(one.includes(`href="${hospitalPath(h.id)}"`), h.id);
  assert.ok(!one.includes('id="ph-state"'), 'one state: no state filter');
  assert.ok(spans.includes('id="ph-state"'), 'a metro across a state line: the filter');
  assert.match(spans, /data-st="ZY"/);
  for (const id of ['ph-text', 'ph-peer', 'ph-cond', 'ph-teach', 'ph-beds', 'ph-loc', 'ph-pen', 'ph-sort']) assert.ok(one.includes(`id="${id}"`), id);
  assert.match(one, /class="ht__controls ph__controls"[^>]* hidden/, 'the filters are the script\'s to show');
  assert.ok(!JUNK.test(one.slice(one.indexOf('<main'), one.indexOf('</main>'))));
});

test('the hospitals CSV: a metro area with more than one hospital uses the hospital pages\' area file, every other place its own', () => {
  const ctx = areaOf();
  const metro = placeView(placeOf(ctx, 'metro', '99901'), ctx).hospitals;
  assert.equal(metro.csvName, areaCsvName(META.fy, 'metro-99901'));
  assert.equal(metro.csvOwn, false);
  const state = placeView(placeOf(ctx, 'state', 'zz'), ctx).hospitals;
  assert.equal(state.csvName, 'hrrp-fy2027-place-state-zz-hospitals');
  assert.equal(state.csvOwn, true);
});

test('the build writes each place\'s files: the child table\'s CSV with the place columns, the hospitals CSV of the same rows as the table', () =>
  withTemp('pp-hrrp-', async (dir) => {
    const data = loadHrrpOnce();
    const ctx = createContext({ outDir: dir, env: 'production', assets: ASSETS });
    generateHrrp(ctx, { data, released: false, ...quiet });
    const places = buildPlaces(data.hospitals, data.meta);
    const read = (name) => parseCsv(readFileSync(join(dir, csvPath(data.meta.fy, name)), 'utf8'));
    const state = places.list.filter((p) => p.kind === 'state').sort((a, b) => b.hospitals.length - a.hospitals.length)[0];
    const kids = read(`hrrp-fy${data.meta.fy}-place-state-${state.key}-metros`);
    assert.deepEqual(Object.keys(kids[0]), placeColumns('Metro area').map((c) => c.name));
    assert.ok(kids.length >= 2 && kids.every((r) => r['Metro area']));
    const rows = read(`hrrp-fy${data.meta.fy}-place-state-${state.key}-hospitals`);
    assert.equal(rows.length, state.hospitals.length);
    assert.deepEqual(rows.map((r) => r.CCN).sort(), state.hospitals.map((h) => h.id).sort());
    const reds = rows.map((r) => Number(r['Payment reduction (%)']));
    assert.deepEqual(reds, [...reds].sort((a, b) => b - a), 'largest cut first, as the table');
    const region = places.list.find((p) => p.kind === 'region');
    assert.equal(read(`hrrp-fy${data.meta.fy}-place-region-${region.key}-divisions`).length, region.children.length);
    // a metro area with several hospitals: no file of its own, the shared area file holds the same hospitals
    const metro = places.list.find((p) => p.kind === 'metro' && p.hospitals.length > 1);
    assert.deepEqual(read(areaCsvName(data.meta.fy, `metro-${metro.key}`)).map((r) => r.CCN).sort(), metro.hospitals.map((h) => h.id).sort());
    const page = readFileSync(join(dir, state.path, 'index.html'), 'utf8');
    assert.ok(page.includes(`href="${csvPath(data.meta.fy, `hrrp-fy${data.meta.fy}-place-state-${state.key}-hospitals`)}" download`));
  }));
