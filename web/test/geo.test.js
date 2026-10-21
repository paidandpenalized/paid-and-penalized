// The build-time maps (web/charts/geo.js) on the pinned us-atlas topology: the state table against the atlas and the
// hospital master, the locator map's dot and its refusals, and the US choropleth's entries, marks and legend.
// Points are invented coordinates, never a hospital's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { geoCentroid } from 'd3-geo';
import { masterPath, newestYear, readJson, readPinned, REPO_ROOT } from '../../pipeline/files.js';
import { STATES, STATE_NAMES, US_MAP_CODES, stateMap, stateShapes, usMap } from '../charts/geo.js';

const TOPO = JSON.parse(readPinned('us-atlas-counties-3.0.1'));
const shapes = stateShapes(TOPO);
const HEX = /#[0-9a-f]{3,8}\b/i;

const viewBox = (svg) => /viewBox="0 0 (\d+) (\d+)"/.exec(svg).slice(1).map(Number);
const dot = (svg) => /<circle class="chart-geo-dot" cx="([\d.-]+)" cy="([\d.-]+)"/.exec(svg).slice(1).map(Number);

test('the state table: every code has an outline in the atlas; the atlas pieces left out are the four territories', () => {
  assert.equal(STATES.length, 52);
  for (const [code] of STATES) assert.ok(shapes.has(code), code);
  const known = new Set(STATES.map(([, fips]) => fips));
  const left = TOPO.objects.states.geometries.map((g) => String(g.id)).filter((id) => !known.has(id)).sort();
  assert.deepEqual(left, ['60', '66', '69', '78']);
  // Names agree with the atlas's own.
  for (const g of TOPO.objects.states.geometries) {
    const row = STATES.find(([, fips]) => fips === String(g.id));
    if (row) assert.equal(row[2], g.properties.name, row[0]);
  }
  assert.equal(US_MAP_CODES.length, 51);
  assert.ok(!US_MAP_CODES.includes('PR'));
});

test("the state table's FIPS codes agree with the hospital master's county codes, state by state", () => {
  const master = readJson(REPO_ROOT + masterPath(newestYear('data/emitted/hospital')));
  const fipsOf = new Map(STATES.map(([code, fips]) => [code, fips]));
  let checked = 0;
  for (const r of master.hospitals) {
    if (!r.fips || !fipsOf.has(r.state)) continue;
    assert.equal(r.fips.slice(0, 2), fipsOf.get(r.state), `a ${r.state} record's county code`);
    checked++;
  }
  assert.ok(checked > 1000);
});

test('stateMap: the outline and a dot with its halo inside the frame, as an image named by the label (escaped)', () => {
  const svg = String(stateMap({ shapes, code: 'KS', point: [-98.0, 38.5], label: 'Map of <Kansas> & a dot' }));
  assert.match(svg, /^<svg class="chart chart--state-map" viewBox="0 0 300 \d+" width="100%" role="img" aria-label="Map of &lt;Kansas&gt; &amp; a dot"/);
  assert.match(svg, /<path class="chart-geo-state" d="M[^"]+Z"\/>/);
  assert.match(svg, /<circle class="chart-geo-halo" cx="[\d.]+" cy="[\d.]+" r="9"\/><circle class="chart-geo-dot"/);
  const [w, h] = viewBox(svg);
  const [x, y] = dot(svg);
  assert.ok(x > 0 && x < w && y > 0 && y < h, 'the dot is inside the frame');
  assert.doesNotMatch(svg, HEX);
  // A wide state is shorter than it is wide; no state is taller than the frame is wide.
  assert.ok(h < w);
  // Every state takes a dot at its own centroid, in a frame no taller than it is wide.
  for (const code of US_MAP_CODES) {
    const svg = stateMap({ shapes, code, point: geoCentroid(shapes.get(code)), label: 'x' });
    assert.ok(svg, code);
    assert.ok(viewBox(String(svg))[1] <= 300, code);
  }
});

test('stateMap: Alaska and Hawaii fit their own frames; the same call gives the same markup', () => {
  for (const [code, point] of [['AK', [-150, 61.5]], ['HI', [-157.9, 21.4]]]) {
    const a = String(stateMap({ shapes, code, point, label: STATE_NAMES[code] }));
    assert.equal(a, String(stateMap({ shapes, code, point, label: STATE_NAMES[code] })));
    const [w, h] = viewBox(a);
    const [x, y] = dot(a);
    assert.ok(x > 0 && x < w && y > 0 && y < h, code);
    assert.ok(a.length < 20000, `${code}: ${a.length} characters`);
  }
});

test('stateMap leaves the map out (null) for a territory, an unknown code, a missing point or one outside the state', () => {
  const at = (code, point) => stateMap({ shapes, code, point, label: 'x' });
  assert.equal(at('PR', [-66.1, 18.4]), null);
  assert.equal(at('GU', [144.8, 13.5]), null);
  assert.equal(at('ZZ', [-98, 38.5]), null);
  assert.equal(at('KS', null), null);
  assert.equal(at('KS', [NaN, 38.5]), null);
  assert.equal(at('KS', ['-98', '38.5']), null);
  assert.equal(at('ME', [-118.2, 34.0]), null, 'a point across the country');
  assert.throws(() => stateMap({ shapes, code: 'KS', point: [-98, 38.5] }), /label/);
});

const ENTRIES = () => Object.fromEntries(US_MAP_CODES.map((code, i) => [code, { value: (i % 5) * 10 + 5, label: `${code} label` }]));
const MAP = (states = ENTRIES(), extra = {}) => ({ id: 'us', shapes, states, ramp: [10, 20, 30, 40], legend: { title: 'Share cut', high: '50%', zero: 'none cut', few: 'few' }, ...extra });

test('usMap: one mark per state and DC with its name, tooltip and data-state; ramp steps; no hex color', () => {
  const svg = String(usMap(MAP()));
  assert.match(svg, /^<svg class="chart chart--us-map" viewBox="0 0 300 \d+"/);
  assert.equal(svg.match(/data-mark data-state="/g).length, 51);
  assert.match(svg, /data-state="KS" data-value="[\d.]+"><title>Kansas: KS label<\/title><path class="chart-tile chart-geo-state chart-seq-\d" d="M/);
  assert.doesNotMatch(svg, HEX);
  const step = (code) => new RegExp(`data-state="${code}"[^>]*>[\\s\\S]*?chart-seq-(\\d)`).exec(svg)[1];
  const states = ENTRIES();
  const at = (v) => US_MAP_CODES.find((c) => states[c].value === v);
  assert.equal(step(at(5)), '1');
  assert.equal(step(at(25)), '3');
  assert.equal(step(at(45)), '5');
  assert.equal(String(usMap(MAP())), svg, 'the same call gives the same markup');
});

test('usMap: hatched, empty, zero and few are drawn apart and keyed in the legend; a missing, unknown or valueless code throws', () => {
  const states = { ...ENTRIES(), MD: { hatched: true, label: 'not subject to the reduction' }, WY: { empty: true, label: 'no hospitals with a payment decision' }, VT: { value: 0, label: 'none' }, DE: { value: 35, label: 'few', few: true } };
  const svg = String(usMap(MAP(states)));
  const md = /data-state="MD"[\s\S]*?<\/g>/.exec(svg)[0];
  assert.match(md, /<path class="chart-tile-na chart-geo-state" fill="url\(#chart-us-hatch\)"/);
  assert.ok(!md.includes('data-value'));
  assert.match(/data-state="WY"[\s\S]*?<\/g>/.exec(svg)[0], /<path class="chart-tile-empty chart-geo-state"/);
  assert.match(/data-state="VT"[\s\S]*?<\/g>/.exec(svg)[0], /class="chart-tile chart-geo-state chart-tile-zero"/);
  assert.match(/data-state="DE"[\s\S]*?<\/g>/.exec(svg)[0], /<path class="chart-tile-few chart-geo-few chart-tile-few--on" d="M/);
  for (const words of ['Not subject to the reduction', 'No hospitals with a payment decision', 'None cut', 'Few']) assert.ok(svg.includes(`>${words}</text>`), words);
  const { CA, ...missing } = ENTRIES();
  assert.throws(() => usMap(MAP(missing)), /CA/);
  assert.throws(() => usMap(MAP({ ...ENTRIES(), PR: { value: 1, label: 'x' } })), /PR/);
  assert.throws(() => usMap(MAP({ ...ENTRIES(), CA: { value: null, label: 'x' } })), /CA/);
  assert.throws(() => usMap(MAP({ ...ENTRIES(), CA: { hatched: true, empty: true, label: 'x' } })), /hatched or empty/);
  assert.throws(() => usMap(MAP(ENTRIES(), { legend: { title: 'x' } })), /legend\.title and legend\.high/);
  assert.throws(() => usMap(MAP(ENTRIES(), { id: 'Bad id' })), /id/);
});
