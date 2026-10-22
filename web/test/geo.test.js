// The build-time maps (web/charts/geo.js) on the pinned us-atlas topology: the state table against the atlas and the
// hospital master, the locator map's dot and its refusals, the US choropleth's entries, marks and legend, and its
// hospital dots; a state's counties; and a place's map (a state, several states or a metro area, with its hospitals).
// Points are invented coordinates, never a hospital's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { geoCentroid, geoContains } from 'd3-geo';
import { masterPath, newestYear, readJson, readPinned, REPO_ROOT } from '../../pipeline/files.js';
import { Safe } from '../render/html.js';
import { STATES, STATE_NAMES, US_MAP_CODES, countiesOf, countyShapes, placeMap, stateMap, stateShapes, usMap, usPoints } from '../charts/geo.js';

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

// ---------- a state's counties, hospitals as dots, and a place's map ----------

const COUNTIES = countyShapes(TOPO);
const paths = (svg, cls) => [...svg.matchAll(new RegExp(`<path class="${cls}[^"]*" d="[^"]+"`, 'g'))].length;

test('countiesOf: a state\'s counties are the atlas\'s whose ids begin with its FIPS code; a territory or unknown code has none', () => {
  assert.ok(COUNTIES.length > 3000);
  let total = 0;
  const claimed = new Set();
  for (const [code, fips] of STATES) {
    const own = countiesOf(COUNTIES, code);
    assert.ok(own.every((f) => String(f.id).startsWith(fips) && String(f.id).length === 5), code);
    own.forEach((f) => claimed.add(String(f.id)));
    total += own.length;
  }
  assert.equal(claimed.size, total, 'no county is in two states');
  assert.ok(countiesOf(COUNTIES, 'KS').length > 100 && countiesOf(COUNTIES, 'DC').length === 1);
  // The only counties in no state's list are the four territories' (the table has no code for them).
  assert.deepEqual([...new Set(COUNTIES.filter((f) => !claimed.has(String(f.id))).map((f) => String(f.id).slice(0, 2)))].sort(), ['60', '66', '69', '78']);
  assert.deepEqual(countiesOf(COUNTIES, 'GU'), []);
  assert.deepEqual(countiesOf(COUNTIES, 'ZZ'), []);
  assert.deepEqual(countiesOf([], 'KS'), []);
});

test('usMap takes an overlay and draws it over the states, under the legend; without one the markup is as before', () => {
  const states = ENTRIES();
  const plain = String(usMap(MAP(states)));
  assert.equal(String(usMap(MAP(states, { overlay: '' }))), plain);
  const over = String(usMap(MAP(states, { overlay: new Safe('<g class="over"/>') })));
  assert.ok(over.indexOf('<g class="over"/>') > over.lastIndexOf('data-mark data-state="'), 'after the last state');
  assert.ok(over.indexOf('<g class="over"/>') < over.indexOf('chart-legend'), 'before the legend');
  assert.equal(over.replace('<g class="over"/>', ''), plain);
});

test('usPoints: one path of dots per class, each class its own size; a point with no place on the map, or in no class, is left out', () => {
  const points = [
    { point: [-98.0, 38.5], cls: 'a' }, { point: [-97.0, 39.0], cls: 'a' }, { point: [-90.2, 38.6], cls: 'b' },
    { point: [-150, 61.5], cls: 'b' }, { point: [-157.9, 21.4], cls: 'b' }, // Alaska and Hawaii, in their insets
    { point: [0, 0], cls: 'a' }, { point: null, cls: 'a' }, { point: [NaN, 38], cls: 'a' }, { point: [-98.0, 38.5], cls: 'unknown' },
  ];
  const svg = String(usPoints({ shapes, points, sizes: { a: 3.2, b: 5.2, c: 4 }, width: 560 }));
  const dots = (cls) => [...svg.matchAll(new RegExp(`<path class="chart-dots ${cls}" stroke-width="([\\d.]+)" d="([^"]+)"`, 'g'))].map((m) => [Number(m[1]), m[2].split('h0').length - 1]);
  assert.deepEqual(dots('a'), [[3.2, 2]]);
  assert.deepEqual(dots('b'), [[5.2, 3]]);
  assert.deepEqual(dots('c'), [], 'a class with no hospital draws no path');
  assert.match(svg, /^<g class="chart-us__points">/);
  assert.doesNotMatch(svg, HEX);
  // Dots sit inside the frame the choropleth draws at the same width.
  const [w, h] = viewBox(String(usMap(MAP(ENTRIES(), { width: 560 }))));
  for (const [, x, y] of svg.matchAll(/M([\d.-]+) ([\d.-]+)h0/g)) assert.ok(x > 0 && x < w && y > 0 && y < h, `${x}, ${y}`);
  assert.equal(String(usPoints({ shapes, points, sizes: { a: 3.2, b: 5.2 }, width: 560 })), String(usPoints({ shapes, points, sizes: { a: 3.2, b: 5.2 }, width: 560 })), 'the same call gives the same markup');
});

const KS = { codes: ['KS'], label: 'Map of <Kansas> & its hospitals', width: 300, aspect: 0.8 };
const POINTS = [
  { point: [-98.0, 38.5], cls: 'dot--pen', tip: 'First <Hospital> & Co: 0.5000', href: '/h/990001/', r: 4.6 },
  { point: [-95.7, 39.0], cls: 'dot--ring', tip: 'Second Hospital: -0.1000', href: '/h/990002/' },
  { point: [-100.0, 37.5], cls: 'dot--faint', tip: 'Third Hospital: N/A' },
];

test('placeMap, one state: the state and its neighbors, counties as hairlines, each hospital a mark with its tooltip and page; the label escaped', () => {
  const kansas = countiesOf(COUNTIES, 'KS');
  const svg = String(placeMap({ shapes, counties: kansas, points: POINTS, ...KS }));
  assert.match(svg, /^<svg class="chart chart--place-map" viewBox="0 0 300 240" width="100%" role="img" aria-label="Map of &lt;Kansas&gt; &amp; its hospitals" focusable="false" style="--vb: 300">/);
  assert.equal(paths(svg, 'chart-geo-state'), 1, 'its outline');
  assert.equal(paths(svg, 'chart-geo-land chart-geo-mine'), 1, 'its fill');
  assert.ok(paths(svg, 'chart-geo-land chart-geo-near') > 0, 'neighbors faint around it');
  const counties = /<g class="chart-geo-counties">([\s\S]*?)<\/g>/.exec(svg)[1];
  assert.ok(counties.match(/<path /g).length > 50 && counties.match(/<path /g).length <= kansas.length, 'a county line for the counties on the map');
  // A hospital: a mark with its tooltip (escaped) and, when it has one, the page it opens.
  const marks = [...svg.matchAll(/<g class="chart-mark" data-mark(?: data-href="([^"]*)")?><title>([^<]*)<\/title><circle class="chart-place__dot ([^"]*)" cx="[\d.]+" cy="[\d.]+" r="([\d.]+)"\/>/g)].map((m) => m.slice(1));
  assert.deepEqual(marks, [
    ['/h/990001/', 'First &lt;Hospital&gt; &amp; Co: 0.5000', 'dot--pen', '4.6'],
    ['/h/990002/', 'Second Hospital: -0.1000', 'dot--ring', '4'],
    [undefined, 'Third Hospital: N/A', 'dot--faint', '4'],
  ]);
  assert.doesNotMatch(svg, HEX);
  assert.ok(!svg.includes('<Kansas>') && !svg.includes('<Hospital>'));
  assert.equal(String(placeMap({ shapes, counties: kansas, points: POINTS, ...KS })), svg, 'the same call gives the same markup');
});

test('placeMap leaves a point it cannot place out, and returns null with nothing to draw; a label is required', () => {
  const odd = [...POINTS, { point: null, cls: 'x', tip: 'none' }, { point: [NaN, 38], cls: 'x', tip: 'nan' }, { point: ['-98', '38.5'], cls: 'x', tip: 'text' }, { point: [-98], cls: 'x', tip: 'one' }];
  const svg = String(placeMap({ shapes, points: odd, ...KS }));
  assert.equal(svg.match(/class="chart-place__dot/g).length, 3);
  assert.equal(placeMap({ shapes, points: [], codes: [], label: 'x', width: 300 }), null, 'no state, no hospital');
  assert.equal(placeMap({ shapes, points: [], codes: ['ZZ'], label: 'x', width: 300 }), null, 'a code the atlas has no outline for');
  assert.equal(placeMap({ shapes, points: [{ point: null, cls: 'x' }], codes: [], fit: 'points', label: 'x', width: 300 }), null, 'a metro area with no hospital to fit');
  assert.throws(() => placeMap({ shapes, points: POINTS, codes: ['KS'], width: 300 }), TypeError);
  assert.throws(() => placeMap({ shapes, points: POINTS, codes: ['KS'], label: '', width: 300 }), TypeError);
});

test('placeMap, several states: Albers USA with Alaska and Hawaii inset, every state of the place and no county lines', () => {
  const svg = String(placeMap({ shapes, counties: COUNTIES, points: POINTS, codes: ['KS', 'NE', 'MO'], label: 'Three states', width: 300 }));
  assert.equal(paths(svg, 'chart-geo-state'), 3);
  assert.equal(paths(svg, 'chart-geo-land chart-geo-near'), 0, 'no neighbors drawn');
  assert.match(svg, /<g class="chart-geo-counties"><\/g>/);
  const far = String(placeMap({ shapes, points: [{ point: [-150, 61.5], cls: 'a', tip: 'AK' }, { point: [-157.9, 21.4], cls: 'a', tip: 'HI' }], codes: ['AK', 'HI', 'WA'], label: 'West', width: 300 }));
  assert.equal(far.match(/class="chart-place__dot/g).length, 2, 'both insets place their dots');
});

test('placeMap, a metro area: fitted around its hospitals with its counties shaded as its own', () => {
  const near = [{ point: [-94.6, 39.1], cls: 'a', tip: 'One' }, { point: [-94.4, 39.0], cls: 'a', tip: 'Two' }, { point: [-94.9, 38.9], cls: 'a', tip: 'Three' }];
  // The counties the hospitals are in (by the atlas's own outlines): shaded as the metro area's own.
  const own = new Set(near.map((p) => COUNTIES.find((f) => geoContains(f, p.point)).id).map(String));
  assert.ok(own.size >= 2);
  const base = { shapes, counties: [...countiesOf(COUNTIES, 'KS'), ...countiesOf(COUNTIES, 'MO')], points: near, codes: [], fit: 'points', label: 'Metro', width: 300, aspect: 0.8 };
  const plain = String(placeMap(base));
  assert.equal(plain.match(/class="chart-place__dot/g).length, 3);
  assert.equal(paths(plain, 'chart-geo-land chart-geo-mine'), 0, 'no state is the metro');
  const lines = (svg) => /<g class="chart-geo-counties">([\s\S]*?)<\/g>/.exec(svg)[1].match(/<path /g)?.length ?? 0;
  assert.ok(lines(plain) > 0 && lines(plain) < countiesOf(COUNTIES, 'KS').length + countiesOf(COUNTIES, 'MO').length, 'only counties near the hospitals');
  const shaded = String(placeMap({ ...base, ownCounties: own }));
  assert.equal(paths(shaded, 'chart-geo-land chart-geo-mine'), own.size, 'each of its counties, filled');
  assert.equal(lines(shaded), lines(plain), 'the lines are the same');
  // Nothing to fit round: no map.
  assert.equal(placeMap({ ...base, points: [] }), null);
});

test('placeMap, dense: the dots are one path per class with no marks or tooltips', () => {
  const many = Array.from({ length: 40 }, (_, i) => ({ point: [-99 + (i % 8) * 0.3, 38 + Math.floor(i / 8) * 0.3], cls: i % 2 ? 'dot--pen' : 'dot--ring', tip: 'x' }));
  const svg = String(placeMap({ shapes, points: many, dense: { 'dot--pen': 4, 'dot--ring': 3.4, 'dot--faint': 2.6 }, ...KS }));
  assert.doesNotMatch(svg, /chart-place__dot/);
  assert.equal([...svg.matchAll(/<g class="chart-mark"/g)].length, 0);
  const dots = (cls) => [...svg.matchAll(new RegExp(`<path class="chart-dots ${cls}" stroke-width="([\\d.]+)" d="([^"]+)"`, 'g'))].map((m) => [Number(m[1]), m[2].split('h0').length - 1]);
  assert.deepEqual(dots('dot--pen'), [[4, 20]]);
  assert.deepEqual(dots('dot--ring'), [[3.4, 20]]);
  assert.deepEqual(dots('dot--faint'), []);
});
