// The build-time maps (web/charts/geo.js) on the pinned us-atlas topology: the state table against the atlas and the
// hospital master, the locator map's dot and its refusals, the US choropleth's entries, marks and legend, and its
// hospital dots; a state's counties; and a place's map (a state, several states or a metro area, with its hospitals).
// Points are invented coordinates, never a hospital's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { geoCentroid, geoConicEqualArea, geoContains, geoPath } from 'd3-geo';
import { masterPath, newestYear, readJson, readPinned, REPO_ROOT } from '../../pipeline/files.js';
import { Safe } from '../render/html.js';
import { absoluteD } from '../charts/pathd.js';
import { spreadPins } from '../charts/pin-layout.js';
import { STATES, STATE_NAMES } from '../../engine/js/states.js';
import { US_MAP_CODES, areaMap, countiesOf, countyShapes, placeMap, pointOf, prInset, prMap, stateMap, stateShapes, usMap, usMapHeight, usPaths, usPoints, usProjected } from '../charts/geo.js';

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
  assert.match(svg, /<path class="chart-geo-state" d="M[^"]+z"\/>/);
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
  // Every dot, each path read back as absolute commands (pathd.js): a dot is a moveto.
  const placed = [...svg.matchAll(/ d="([^"]*)"/g)].flatMap(([, d]) => [...absoluteD(d).matchAll(/M([\d.-]+) ([\d.-]+)/g)].map((m) => [Number(m[1]), Number(m[2])]));
  assert.ok(placed.length > 0);
  for (const [x, y] of placed) assert.ok(x > 0 && x < w && y > 0 && y < h, `${x}, ${y}`);
  assert.equal(String(usPoints({ shapes, points, sizes: { a: 3.2, b: 5.2 }, width: 560 })), String(usPoints({ shapes, points, sizes: { a: 3.2, b: 5.2 }, width: 560 })), 'the same call gives the same markup');
});

test('pointOf is [lon, lat] for a record with both, else null; usProjected places it inside usMapHeight, and gives null where the map has no place', () => {
  assert.deepEqual(pointOf({ lat: 38.5, lon: -98 }), [-98, 38.5]);
  for (const bad of [{}, { lat: 38.5 }, { lon: -98 }, { lat: null, lon: -98 }, { lat: NaN, lon: -98 }, { lat: 38.5, lon: '-98' }]) assert.equal(pointOf(bad), null, JSON.stringify(bad));
  const placed = usProjected(shapes, [pointOf({ lat: 38.5, lon: -98 }), pointOf({}), [0, 0]], 975);
  const [x, y] = placed[0];
  assert.ok(x > 0 && x < 975 && y > 0 && y < usMapHeight(975), `${x}, ${y}`);
  assert.deepEqual(placed.slice(1), [null, null]);
  assert.equal(usMapHeight(975), 605);
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

// ---------- the area map's reading aids, and Puerto Rico's inset ----------

const AREA = { shapes, center: { point: [-93.6, 42.0], tip: 'c' }, label: 'Map', width: 460 };
const pins = (svg) => [...String(svg).matchAll(/<circle class="chart-pin [^"]*" cx="([\d.-]+)" cy="([\d.-]+)" r="([\d.]+)"/g)].map((m) => m.slice(1).map(Number));

test('spreadPins: pins at one place, or over the ▲, are pushed apart, kept in the frame, the same every time', () => {
  const same = [[100, 100], [100, 100], [100, 100], [104, 101]];
  const got = spreadPins(same, [300, 300], { width: 460, height: 368 });
  for (let i = 0; i < got.length; i++) for (let j = i + 1; j < got.length; j++) assert.ok(Math.hypot(got[i][0] - got[j][0], got[i][1] - got[j][1]) >= 18, 'two radii apart');
  assert.deepEqual(spreadPins(same, [300, 300], { width: 460, height: 368 }), got, 'deterministic');
  assert.deepEqual(same[0], [100, 100], 'the input is left as it was');
  const [off] = spreadPins([[50, 50]], [50, 50], { width: 460, height: 368 });
  assert.ok(Math.hypot(off[0] - 50, off[1] - 50) >= 9 + 12 - 1e-9, 'off the ▲');
  const [edge] = spreadPins([[0, 400]], [200, 200], { width: 460, height: 368 });
  assert.ok(edge[0] >= 10 && edge[1] <= 368 - 10, 'inside the frame, a radius in');
  const apart = [[10 + 9, 30], [100, 30]];
  assert.deepEqual(spreadPins(apart, [300, 300], { width: 460, height: 368 }), apart, 'pins already apart stay put');
});

test('areaMap: without its aids it draws what it always drew; given, they add only the aids', () => {
  const points = [{ point: [-93.62, 42.03], n: 1, cls: 'chart-pin--no', tip: 'a' }, { point: [-93.62, 42.03], n: 2, cls: 'chart-pin--yes', tip: 'b' }, { point: [-92.9, 41.7], n: 3, cls: 'chart-pin--no', tip: 'c' }];
  const plain = String(areaMap({ ...AREA, points }));
  assert.equal(plain, String(areaMap({ ...AREA, points, aids: null })), 'the aids are off by default');
  assert.doesNotMatch(plain, /chart-geo-label|chart-pin__lead|chart-pin__at/, 'no aids by default');
  const closest = (list) => Math.min(...list.flatMap((p, i) => list.slice(i + 1).map((q) => Math.hypot(p[0] - q[0], p[1] - q[1]))));
  assert.equal(closest(pins(plain)), 0, 'unspread, two pins at one place overlap');
  const aided = String(areaMap({ ...AREA, points, aids: { labels: 4, pad: 30 } }));
  assert.ok(closest(pins(aided)) >= 18, 'spread apart');
  assert.match(aided, /<path class="chart-pin__lead" d="M[\d.-]+ [\d.-]+L[\d.-]+ [\d.-]+"\/><circle class="chart-pin__at"/, 'a moved pin is tied to its place');
  const labels = [...aided.matchAll(/<text class="chart-geo-label" x="([\d.-]+)" y="([\d.-]+)"[^>]*>([A-Z]{2})<\/text>/g)];
  assert.ok(labels.length >= 1 && labels.length <= 4, 'one to four state labels');
  assert.ok(labels.some((m) => m[3] === 'IA'), 'the state the map centers on is labeled');
  assert.ok(new Set(labels.map((m) => m[3])).size === labels.length, 'each state once');
  assert.match(String(areaMap({ ...AREA, points: points.slice(1), aids: { labels: 4 } })), /chart-geo-label/, 'labels at the default room too');
  assert.ok(aided.indexOf('chart-geo-label') < aided.indexOf('class="chart-pin '), 'under the pins');
  assert.equal(String(areaMap({ ...AREA, points, context: [{ point: [-93.5, 42.1], cls: 'ctx' }], aids: { contextR: 3 } })).match(/<circle class="ctx" [^>]*r="3"\/>/g)?.length, 1, 'the context dots\' radius');
});

test('areaMap labels: each inside the state it names, clear of the pins and the frame', () => {
  const points = [{ point: [-93.62, 42.03], n: 1, cls: 'chart-pin--no', tip: 'a' }, { point: [-91.5, 41.6], n: 2, cls: 'chart-pin--yes', tip: 'b' }];
  const svg = String(areaMap({ ...AREA, points, aids: { labels: 4, pad: 30 } }));
  const [w, h] = viewBox(svg);
  // The same projection the map fits (geo.js areaMap): around the center, a quarter degree about it, and the points.
  const [lon, lat] = AREA.center.point;
  const projection = geoConicEqualArea().rotate([-lon, 0]).parallels([lat - 2, lat + 2])
    .fitExtent([[30, 30], [w - 30, h - 30]], { type: 'MultiPoint', coordinates: [AREA.center.point, [lon - 0.25, lat - 0.25], [lon + 0.25, lat + 0.25], ...points.map((p) => p.point)] });
  const labels = [...svg.matchAll(/<text class="chart-geo-label" x="([\d.-]+)" y="([\d.-]+)"[^>]*>([A-Z]{2})<\/text>/g)];
  assert.ok(labels.length > 0);
  for (const [, x, y, code] of labels) {
    const at = [Number(x), Number(y)];
    assert.ok(geoContains(shapes.get(code), projection.invert(at)), 'inside its state');
    assert.ok(at[0] > 10 && at[0] < w - 10 && at[1] > 7 && at[1] < h - 7, 'clear of the frame');
    for (const [px, py, r] of pins(svg)) assert.ok(Math.hypot(at[0] - px, at[1] - py) >= r, 'clear of a pin');
  }
});

test('prInset: Puerto Rico in a box at the US map\'s lower right, clear of every state; points outside the island have no place', () => {
  const width = 975;
  const inset = prInset(shapes, width);
  assert.ok(inset, 'the atlas has Puerto Rico');
  assert.equal(prInset(shapes, width), inset, 'remembered');
  const { box } = inset;
  const height = usMapHeight(width);
  assert.ok(box.x + box.width <= width && box.y + box.height <= height && box.x > width * 0.8 && box.y > height * 0.85, 'in the lower right, inside the frame');
  // Clear of the states: no state's outline reaches into the box.
  const { projection } = usPaths(shapes, width);
  for (const code of US_MAP_CODES) {
    const [[sx0, sy0], [sx1, sy1]] = geoPath(projection).bounds(shapes.get(code));
    assert.ok(sx1 < box.x || sy1 < box.y || sx0 > box.x + box.width || sy0 > box.y + box.height, `${code} is clear of the box`);
  }
  // San Juan inside; a point on the mainland, and one far at sea, outside.
  const sj = inset.project([-66.1, 18.45]);
  assert.ok(sj && sj[0] >= box.x && sj[0] <= box.x + box.width && sj[1] >= box.y && sj[1] <= box.y + box.height, 'a point on the island inside the box');
  assert.equal(inset.project([-93.6, 42.0]), null, 'a mainland point has no place');
  assert.equal(inset.project(null), null, 'no coordinates, no place');
  assert.match(inset.outline, /^m|^M/, 'the outline');
  assert.equal(prInset(new Map(), width), null, 'no Puerto Rico in the shapes: no inset');
});

test('areaMap round two: towns beside pins inside the frame, a ringed place, the frame\'s aspect, a variant, the context by class', () => {
  const points = [
    { point: [-93.62, 42.03], n: 1, cls: 'chart-pin--no', tip: 'a', town: 'Ames' },
    { point: [-93.62, 42.03], n: 2, cls: 'chart-pin--yes', tip: 'b' },
    { point: [-92.9, 41.7], n: 3, cls: 'chart-pin--no', tip: 'c', town: 'A town with a name far too long for this frame on either side of its pin, above it or below it' },
  ];
  const context = [{ point: [-93.5, 42.1], cls: 'a' }, { point: [-93.4, 42.0], cls: 'b' }, { point: [-93.3, 41.9], cls: 'b' }];
  const svg = areaMap({ ...AREA, points, context, variant: 'wide', aids: { towns: true, aspect: 0.72, ring: true, pad: 30 } });
  const text = String(svg);
  const [w, h] = viewBox(text);
  assert.equal(h, Math.round(w * 0.72), 'the aspect');
  assert.match(text, /^<svg class="chart chart--area-map" data-fit="wide" viewBox=/, 'the variant');
  assert.match(text, /<circle class="chart-self__ring" cx="[\d.-]+" cy="[\d.-]+" r="11"\/><circle class="chart-self__dot"/, 'the place ringed');
  assert.doesNotMatch(text, /chart-this--map/, 'no ▲');
  const towns = [...text.matchAll(/<text class="chart-pin__town" x="([\d.-]+)" y="([\d.-]+)" dy="0.35em" text-anchor="(\w+)">([^<]*)<\/text>/g)];
  assert.deepEqual(towns.map((m) => m[4]), ['Ames'], 'a town that fits, and none that can\'t');
  assert.deepEqual(svg.contextDrawnBy, { a: 1, b: 2 }, 'the context drawn, by class');
  // Two pins at one place are spread past their radius, so each one's hairline back to the place shows.
  const leads = [...text.matchAll(/<path class="chart-pin__lead" d="M([\d.-]+) ([\d.-]+)L([\d.-]+) ([\d.-]+)"/g)].map((m) => m.slice(1).map(Number));
  assert.ok(leads.length >= 2 && leads.every(([x0, y0, x1, y1]) => Math.hypot(x1 - x0, y1 - y0) > 9), 'tied back, beyond the pin\'s edge');
  // Without the options: no towns, a ▲, the default frame.
  const plain = String(areaMap({ ...AREA, points }));
  assert.doesNotMatch(plain, /chart-pin__town|chart-self__|data-fit/);
  assert.equal(viewBox(plain)[1], Math.round(460 * 0.8));
});

test('areaMap: contextDrawnBy counts the dots drawn, dense or not; clear leaves out a dot under a pin or the place\'s mark; a gap spreads pins farther', () => {
  const points = [{ point: [-93.62, 42.03], n: 1, cls: 'chart-pin--no', tip: 'a' }, { point: [-93.62, 42.03], n: 2, cls: 'chart-pin--yes', tip: 'b' }, { point: [-92.9, 41.7], n: 3, cls: 'chart-pin--no', tip: 'c' }];
  // Three dots of two classes, away from every pin; then one at a pin's place and one at the center.
  const apart = [{ point: [-93.4, 42.2], cls: 'a' }, { point: [-93.1, 41.8], cls: 'b' }, { point: [-93.8, 41.8], cls: 'b' }];
  for (const dense of [false, true]) {
    const svg = areaMap({ ...AREA, points, context: apart, aids: { dense } });
    assert.deepEqual(svg.contextDrawnBy, { a: 1, b: 2 }, `every dot counted, by class (dense: ${dense})`);
  }
  const under = [...apart, { point: [-92.9, 41.7], cls: 'b' }, { point: AREA.center.point, cls: 'a' }];
  assert.deepEqual(areaMap({ ...AREA, points, context: under, aids: {} }).contextDrawnBy, { a: 2, b: 3 }, 'without clear, every dot in the frame');
  const cleared = areaMap({ ...AREA, points, context: under, aids: { clear: true, ring: true } });
  assert.deepEqual(cleared.contextDrawnBy, { a: 1, b: 2 }, 'clear: the dots under a pin and under the ring left out');
  const ctx = [...String(cleared).matchAll(/<circle class="[ab]" cx="([\d.-]+)" cy="([\d.-]+)" r="([\d.]+)"/g)].map((m) => m.slice(1).map(Number));
  for (const [x, y, r] of ctx) for (const [px, py, pr] of pins(cleared)) assert.ok(Math.hypot(x - px, y - py) >= r + pr, 'no drawn dot touches a pin');
  const closest = (list) => Math.min(...list.flatMap((p, i) => list.slice(i + 1).map((q) => Math.hypot(p[0] - q[0], p[1] - q[1]))));
  const near = closest(pins(areaMap({ ...AREA, points, aids: {} })));
  const far = closest(pins(areaMap({ ...AREA, points, aids: { gap: 16 } })));
  assert.ok(far >= 2 * 9 + 16 - 1e-6 && far > near, 'a wider gap between spread pins');
  assert.equal(String(areaMap({ ...AREA, points, context: apart, aids: {} })), String(areaMap({ ...AREA, points, context: apart, aids: { clear: false, gap: 8 } })), 'the defaults are the old drawing');
  assert.throws(() => areaMap({ ...AREA, points, aids: { spread: true } }), /unknown aid/, 'an aid the map has no such option for');
});

test('prMap: Puerto Rico across the frame, padded; points off the island have no place', () => {
  const map = prMap(shapes, 975, 22);
  assert.equal(prMap(shapes, 975, 22), map, 'remembered');
  assert.ok(map.height > 100 && map.height < 975 / 2, 'wider than tall');
  const [x, y] = map.project([-66.1, 18.45]);
  assert.ok(x >= 22 && x <= 975 - 22 && y >= 22 && y <= map.height - 22, 'a point on the island inside the padding');
  assert.equal(map.project([-93.6, 42.0]), null, 'the mainland has no place');
  assert.equal(prMap(new Map(), 975, 22), null, 'no Puerto Rico: no map');
});
