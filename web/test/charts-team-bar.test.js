// The TEAM program page's Part 4 chart and the hub band's ruler: the census-division map of one episode type's prices
// (web/charts/divisionMap.js, its steps from web/charts/evenSteps.js) and the scenario range against a track's limits
// (web/charts/limitRuler.js). Synthetic prices and dollars, never a hospital's; each chart's every plotted value is in
// the table its figure carries (figure() throws when one is not).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REPO_ROOT, readPinned } from '../../pipeline/files.js';
import { MAP_KIT_STYLE } from '../../pipeline/site/assets.js';
import { DIVISIONS } from '../../engine/js/divisions.js';
import { divisionLabels, divisionMap } from '../charts/divisionMap.js';
import { evenSteps } from '../charts/evenSteps.js';
import { figure } from '../charts/figure.js';
import { ATLAS_ID } from '../charts/geo.js';
import { limitRuler, limitRulerValues } from '../charts/limitRuler.js';
import { WIDTH } from '../charts/svg.js';

const TOPO = JSON.parse(readPinned(ATLAS_ID));
const values = (svg) => [...String(svg).matchAll(/data-value="([^"]*)"/g)].flatMap((m) => m[1].split(' ').map(Number));
const usd = (v) => `$${Math.round(v).toLocaleString('en-US')}`;

// ---------- evenSteps ----------

test('evenSteps: five even steps from the lowest value to the highest, the ends on the ends, one value on the middle step', () => {
  const s = evenSteps([10, 20, 30, 40, 50, 60]);
  assert.deepEqual([s.lo, s.hi], [10, 60]);
  assert.deepEqual([10, 19.99, 20, 35, 49.99, 50, 60].map(s.stepOf), [1, 1, 2, 3, 4, 5, 5]);
  assert.equal(evenSteps([7, 7, 7]).stepOf(7), 3);
  assert.throws(() => evenSteps([]), RangeError);
  assert.throws(() => evenSteps([1, Number.NaN]), RangeError);
});

// ---------- divisionMap ----------

// Invented prices, one per division (1 to 9): the lowest in division 4, the highest in division 7.
const PRICES = { 1: 18900, 2: 18800, 3: 18400, 4: 18100, 5: 18750, 6: 19500, 7: 20400, 8: 18450, 9: 18700 };
const WORDS = {
  price: usd,
  name: (div) => DIVISIONS[div - 1][0],
  tip: (div, v) => `${DIVISIONS[div - 1][0]}: ${usd(v)}`,
  legend: { title: 'Target price, standardized dollars', low: 'lowest', high: 'highest' },
};
const MAP = { topo: TOPO, values: PRICES, reader: 6, words: WORDS };
const marksOf = (svg) => [...String(svg).matchAll(/<g class="chart-mark" data-mark data-div="(\d)" data-value="([^"]+)"><title>([^<]+)<\/title><path class="([^"]+)" d="([^"]+)"\/><\/g>/g)]
  .map(([, div, value, tip, cls, d]) => ({ div: Number(div), value: Number(value), tip, cls, d }));

test('divisionMap: all nine divisions, each a mark holding its price, shaded by its step, labeled with its price and name', () => {
  for (const width of [WIDTH, 560]) {
    const svg = String(divisionMap({ ...MAP, width }));
    assert.match(svg, /^<svg class="chart chart--division-map"/);
    const marks = marksOf(svg);
    assert.deepEqual(marks.map((m) => m.div).sort(), [1, 2, 3, 4, 5, 6, 7, 8, 9], `${width}: nine divisions`);
    for (const m of marks) {
      assert.equal(m.value, PRICES[m.div]);
      assert.equal(m.tip, WORDS.tip(m.div, PRICES[m.div]));
      assert.ok(m.d.length > 50, `${width}: division ${m.div} has its states' outlines`);
    }
    const step = (div) => Number(/chart-div--s(\d)/.exec(marks.find((m) => m.div === div).cls)[1]);
    assert.equal(step(4), 1, 'the lowest price: the lightest step');
    assert.equal(step(7), 5, 'the highest price: the darkest step');
    // Each division's label: its price, then its name (on a phone, a long name on two lines).
    for (let div = 1; div <= 9; div++) {
      assert.match(svg, new RegExp(`<text class="chart-div__price" data-div="${div}"[^>]*>${WORDS.price(PRICES[div]).replace('$', '\\$')}</text>`), `${width}: price ${div}`);
      const name = DIVISIONS[div - 1][0];
      const shown = [...svg.matchAll(new RegExp(`<text class="chart-div__name" data-div="${div}"[^>]*>([^<]+)</text>`, 'g'))].map((m) => m[1]).join(' ');
      assert.equal(shown, name, `${width}: name ${div}`);
    }
    // The division borders (a mesh), and the legend's two ends.
    assert.match(svg, /<path class="chart-div__borders" d="M/);
    assert.match(svg, /<tspan data-legend="low">\$18,100<\/tspan> lowest</);
    assert.match(svg, /<tspan data-legend="high">\$20,400<\/tspan> highest</);
    assert.match(svg, />Target price, standardized dollars</);
  }
});

test('divisionMap: the reader\'s division is marked and outlined (its edges, coasts included); with no reader, none is', () => {
  const svg = String(divisionMap({ ...MAP, width: 560 }));
  assert.deepEqual(marksOf(svg).filter((m) => /chart-div--reader/.test(m.cls)).map((m) => m.div), [6]);
  assert.deepEqual(marksOf(svg).map((m) => m.div), [1, 2, 3, 4, 5, 6, 7, 8, 9], 'the divisions in census order');
  assert.equal((svg.match(/<path class="chart-div__reader" d="M/g) ?? []).length, 1);
  // Drawn over the divisions' borders, under the labels.
  assert.ok(svg.indexOf('chart-div__borders') < svg.indexOf('chart-div__reader') && svg.indexOf('chart-div__reader') < svg.indexOf('chart-div__labels'));
  const none = String(divisionMap({ ...MAP, reader: null, width: 560 }));
  assert.deepEqual(marksOf(none).filter((m) => /chart-div--reader/.test(m.cls)), []);
  assert.doesNotMatch(none, /chart-div__reader/);
});

// The labels' chips (each block's words, estimated from the type's advance, on its paper chip) stay at least CHIP_GAP
// apart, at either width, for any price up to the widest a TEAM price prints ("$188,888"); each block's words sit on its
// chip and each chip inside the frame.
const CHIP_GAP = 6;
test('divisionMap: no two labels\' chips come within 6 units and none leaves the frame, even at the widest price', () => {
  for (const width of [WIDTH, 560]) {
    const boxes = divisionLabels({ topo: TOPO, width, name: WORDS.name, priceText: () => '$188,888' });
    assert.equal(boxes.length, 9);
    const height = Number(/viewBox="0 0 \d+ (\d+)"/.exec(String(divisionMap({ ...MAP, width })))[1]);
    for (const { div, chip: c, ...b } of boxes) {
      assert.ok(c.x0 >= 0 && c.x1 <= width && c.y0 >= 0 && c.y1 <= height, `${width}: division ${div}'s chip inside the frame`);
      assert.ok(c.x0 <= b.x0 && b.x1 <= c.x1 && c.y0 <= b.y0 && b.y1 <= c.y1, `${width}: division ${div}'s words on its chip`);
    }
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const [a, b] = [boxes[i].chip, boxes[j].chip];
        const gap = Math.max(b.x0 - a.x1, a.x0 - b.x1, b.y0 - a.y1, a.y0 - b.y1);
        assert.ok(gap >= CHIP_GAP, `${width}: the chips of divisions ${boxes[i].div} and ${boxes[j].div} are ${gap.toFixed(1)} apart`);
      }
    }
  }
});

test('divisionMap: its figure holds every plotted value in the table', () => {
  const rows = Object.entries(PRICES).map(([div, v]) => [DIVISIONS[div - 1][0], { text: usd(v), value: String(v) }]);
  assert.doesNotThrow(() => figure({
    n: 4, takeaway: 't', svg: divisionMap({ ...MAP, width: WIDTH }), svgWide: divisionMap({ ...MAP, width: 560 }), source: 's', alt: 'a',
    table: { columns: [{ name: 'Region' }, { name: 'Price', numeric: true }], rows },
  }));
  assert.throws(() => figure({
    n: 4, takeaway: 't', svg: divisionMap({ ...MAP, width: WIDTH }), source: 's', alt: 'a',
    table: { columns: [{ name: 'Region' }, { name: 'Price', numeric: true }], rows: rows.slice(1) },
  }), /not in the table/);
});

test('divisionMap: bad input throws', () => {
  assert.throws(() => divisionMap({ ...MAP, values: { ...PRICES, 9: undefined }, width: WIDTH }), RangeError);
  assert.throws(() => divisionMap({ ...MAP, values: { ...PRICES, 10: 1 }, width: WIDTH }), RangeError);
  assert.throws(() => divisionMap({ ...MAP, reader: 10, width: WIDTH }), RangeError);
});

// The phone drawing's markup, its outlines' d left out (they are the geometry's, tested above): the marks' order and
// steps, the labels and their places, the legend. A change here is a visible change to Figure 4: look at it in the
// browser before updating the snapshot.
const DIVISION_SNAPSHOT = "<svg class=\"chart chart--division-map\" viewBox=\"0 0 300 230\" width=\"100%\" focusable=\"false\" style=\"--vb: 300\"><g transform=\"scale(0.535714)\"><g class=\"chart-div__shapes\"><g class=\"chart-mark\" data-mark data-div=\"1\" data-value=\"18900\"><title>New England: $18,900</title><path class=\"chart-div chart-div--s2\" d/></g><g class=\"chart-mark\" data-mark data-div=\"2\" data-value=\"18800\"><title>Middle Atlantic: $18,800</title><path class=\"chart-div chart-div--s2\" d/></g><g class=\"chart-mark\" data-mark data-div=\"3\" data-value=\"18400\"><title>East North Central: $18,400</title><path class=\"chart-div chart-div--s1\" d/></g><g class=\"chart-mark\" data-mark data-div=\"4\" data-value=\"18100\"><title>West North Central: $18,100</title><path class=\"chart-div chart-div--s1\" d/></g><g class=\"chart-mark\" data-mark data-div=\"5\" data-value=\"18750\"><title>South Atlantic: $18,750</title><path class=\"chart-div chart-div--s2\" d/></g><g class=\"chart-mark\" data-mark data-div=\"6\" data-value=\"19500\"><title>East South Central: $19,500</title><path class=\"chart-div chart-div--s4 chart-div--reader\" d/></g><g class=\"chart-mark\" data-mark data-div=\"7\" data-value=\"20400\"><title>West South Central: $20,400</title><path class=\"chart-div chart-div--s5\" d/></g><g class=\"chart-mark\" data-mark data-div=\"8\" data-value=\"18450\"><title>Mountain: $18,450</title><path class=\"chart-div chart-div--s1\" d/></g><g class=\"chart-mark\" data-mark data-div=\"9\" data-value=\"18700\"><title>Pacific: $18,700</title><path class=\"chart-div chart-div--s2\" d/></g></g>\n<path class=\"chart-div__borders\" d/></g>\n<g class=\"chart-div__chips\" aria-hidden=\"true\"><rect class=\"chart-div__chip\" x=\"236.6\" y=\"0.67\" width=\"63.4\" height=\"26\" rx=\"2\"/><rect class=\"chart-div__chip\" x=\"238.33\" y=\"42.26\" width=\"56.8\" height=\"37\" rx=\"2\"/><rect class=\"chart-div__chip\" x=\"173.41\" y=\"47.96\" width=\"58\" height=\"37\" rx=\"2\"/><rect class=\"chart-div__chip\" x=\"108.76\" y=\"46.02\" width=\"58\" height=\"37\" rx=\"2\"/><rect class=\"chart-div__chip\" x=\"237.47\" y=\"136.13\" width=\"56.8\" height=\"37\" rx=\"2\"/><rect class=\"chart-div__chip\" x=\"183.23\" y=\"91.73\" width=\"58\" height=\"37\" rx=\"2\"/><rect class=\"chart-div__chip\" x=\"127.31\" y=\"136.37\" width=\"58\" height=\"37\" rx=\"2\"/><rect class=\"chart-div__chip\" x=\"64.33\" y=\"89.24\" width=\"56.8\" height=\"26\" rx=\"2\"/><rect class=\"chart-div__chip\" x=\"14.09\" y=\"45.91\" width=\"56.8\" height=\"26\" rx=\"2\"/></g>\n<g transform=\"scale(0.535714)\"><path class=\"chart-div__reader\" d/></g>\n<g class=\"chart-div__labels\" aria-hidden=\"true\"><text class=\"chart-div__price\" data-div=\"1\" x=\"298\" y=\"11.69\" font-size=\"11\" text-anchor=\"end\">$18,900</text><text class=\"chart-div__name\" data-div=\"1\" x=\"298\" y=\"23.05\" font-size=\"9\" text-anchor=\"end\">New England</text><text class=\"chart-div__price\" data-div=\"2\" x=\"266.73\" y=\"53.28\" font-size=\"11\" text-anchor=\"middle\">$18,800</text><text class=\"chart-div__name\" data-div=\"2\" x=\"266.73\" y=\"64.64\" font-size=\"9\" text-anchor=\"middle\">Middle</text><text class=\"chart-div__name\" data-div=\"2\" x=\"266.73\" y=\"75.64\" font-size=\"9\" text-anchor=\"middle\">Atlantic</text><text class=\"chart-div__price\" data-div=\"3\" x=\"202.41\" y=\"58.98\" font-size=\"11\" text-anchor=\"middle\">$18,400</text><text class=\"chart-div__name\" data-div=\"3\" x=\"202.41\" y=\"70.34\" font-size=\"9\" text-anchor=\"middle\">East North</text><text class=\"chart-div__name\" data-div=\"3\" x=\"202.41\" y=\"81.34\" font-size=\"9\" text-anchor=\"middle\">Central</text><text class=\"chart-div__price\" data-div=\"4\" x=\"137.76\" y=\"57.04\" font-size=\"11\" text-anchor=\"middle\">$18,100</text><text class=\"chart-div__name\" data-div=\"4\" x=\"137.76\" y=\"68.4\" font-size=\"9\" text-anchor=\"middle\">West North</text><text class=\"chart-div__name\" data-div=\"4\" x=\"137.76\" y=\"79.4\" font-size=\"9\" text-anchor=\"middle\">Central</text><text class=\"chart-div__price\" data-div=\"5\" x=\"265.87\" y=\"147.15\" font-size=\"11\" text-anchor=\"middle\">$18,750</text><text class=\"chart-div__name\" data-div=\"5\" x=\"265.87\" y=\"158.51\" font-size=\"9\" text-anchor=\"middle\">South</text><text class=\"chart-div__name\" data-div=\"5\" x=\"265.87\" y=\"169.51\" font-size=\"9\" text-anchor=\"middle\">Atlantic</text><text class=\"chart-div__price\" data-div=\"6\" x=\"212.23\" y=\"102.75\" font-size=\"11\" text-anchor=\"middle\">$19,500</text><text class=\"chart-div__name\" data-div=\"6\" x=\"212.23\" y=\"114.11\" font-size=\"9\" text-anchor=\"middle\">East South</text><text class=\"chart-div__name\" data-div=\"6\" x=\"212.23\" y=\"125.11\" font-size=\"9\" text-anchor=\"middle\">Central</text><text class=\"chart-div__price\" data-div=\"7\" x=\"156.31\" y=\"147.39\" font-size=\"11\" text-anchor=\"middle\">$20,400</text><text class=\"chart-div__name\" data-div=\"7\" x=\"156.31\" y=\"158.75\" font-size=\"9\" text-anchor=\"middle\">West South</text><text class=\"chart-div__name\" data-div=\"7\" x=\"156.31\" y=\"169.75\" font-size=\"9\" text-anchor=\"middle\">Central</text><text class=\"chart-div__price\" data-div=\"8\" x=\"92.73\" y=\"100.26\" font-size=\"11\" text-anchor=\"middle\">$18,450</text><text class=\"chart-div__name\" data-div=\"8\" x=\"92.73\" y=\"111.62\" font-size=\"9\" text-anchor=\"middle\">Mountain</text><text class=\"chart-div__price\" data-div=\"9\" x=\"42.49\" y=\"56.93\" font-size=\"11\" text-anchor=\"middle\">$18,700</text><text class=\"chart-div__name\" data-div=\"9\" x=\"42.49\" y=\"68.29\" font-size=\"9\" text-anchor=\"middle\">Pacific</text></g>\n<g class=\"chart-div__legend\"><text class=\"chart-legend__title\" x=\"0\" y=\"199.89\" text-anchor=\"start\">Target price, standardized dollars</text><rect class=\"chart-div chart-div--s1\" x=\"0\" y=\"205.89\" width=\"56\" height=\"8\"/><rect class=\"chart-div chart-div--s2\" x=\"56\" y=\"205.89\" width=\"56\" height=\"8\"/><rect class=\"chart-div chart-div--s3\" x=\"112\" y=\"205.89\" width=\"56\" height=\"8\"/><rect class=\"chart-div chart-div--s4\" x=\"168\" y=\"205.89\" width=\"56\" height=\"8\"/><rect class=\"chart-div chart-div--s5\" x=\"224\" y=\"205.89\" width=\"56\" height=\"8\"/><text class=\"chart-legend__label\" x=\"0\" y=\"225.89\" text-anchor=\"start\"><tspan data-legend=\"low\">$18,100</tspan> lowest</text><text class=\"chart-legend__label\" x=\"280\" y=\"225.89\" text-anchor=\"end\"><tspan data-legend=\"high\">$20,400</tspan> highest</text></g></svg>";
test('divisionMap: the phone drawing matches its snapshot (outlines left out)', () => {
  const shape = String(divisionMap({ ...MAP, width: WIDTH })).replace(/ d="[^"]*"/g, ' d');
  assert.equal(shape, DIVISION_SNAPSHOT);
});

// ---------- limitRuler ----------

const RULER_WORDS = {
  money: (v) => (v === 0 ? '$0' : `${v < 0 ? '−' : '+'}$${Math.abs(v) / 1000}K`),
  stopGain: (v) => `stop-gain +$${v / 1000}K`,
  stopLoss: (v) => `stop-loss −$${v / 1000}K`,
  noLoss: 'no downside in Track 1',
  tip: (lo, hi) => `${lo} to ${hi}`,
  wallTip: (side, v) => `${side}: ${v}`,
};
const RULER = { id: 'band', low: -546000, high: 551000, limits: { gain: 2300000, loss: 2300000 }, words: RULER_WORDS };

test('limitRuler: the range as a bar on one dollar axis, owed in the repaid ink and paid in the paid ink, $0 marked, the limits as hatched walls at the ends', () => {
  const svg = String(limitRuler({ ...RULER, width: 560 }));
  assert.match(svg, /^<svg class="chart chart--ruler"/);
  assert.equal((svg.match(/class="chart-ruler__loss"/g) ?? []).length, 1);
  assert.equal((svg.match(/class="chart-ruler__gain"/g) ?? []).length, 1);
  assert.equal((svg.match(/class="chart-ruler__wall"/g) ?? []).length, 2);
  assert.match(svg, /<pattern id="chart-band-hatch"/);
  assert.match(svg, /class="chart-ruler__zero"/);
  assert.match(svg, />\$0</);
  assert.match(svg, />stop-loss −\$2300K</);
  assert.match(svg, />stop-gain \+\$2300K</);
  assert.match(svg, />−\$546K</);
  assert.match(svg, />\+\$551K</);
  // The axis is symmetric about $0, so $0 sits mid-frame on every drawing, and the walls end where the limits are.
  const zeroX = Number(/class="chart-ruler__zero" x1="([\d.]+)"/.exec(svg)[1]);
  assert.equal(zeroX, 280);
  const walls = [...svg.matchAll(/class="chart-ruler__wall" fill="[^"]+" x="([\d.]+)" y="[\d.]+" width="([\d.]+)"/g)].map((m) => [Number(m[1]), Number(m[2])]);
  const lossEdge = walls[0][0] + walls[0][1];
  const gainEdge = walls[1][0];
  assert.ok(Math.abs((zeroX - lossEdge) - (gainEdge - zeroX)) < 0.02, 'equal limits, equal walls');
});

// The limits' labels sit at the frame's two ends at every width: the stop-loss from the left end, the stop-gain to the
// right end, so on a phone the two never crowd toward the middle.
test('limitRuler: the stop-loss label starts at the left end and the stop-gain label ends at the right end, at every width', () => {
  for (const width of [WIDTH, 560]) {
    const svg = String(limitRuler({ ...RULER, width }));
    const label = () => /<text class="chart-tick" x="([\d.]+)" y="[\d.]+" text-anchor="(\w+)">([^<]*)<\/text>/g;
    const labels = [...svg.matchAll(label())].map((m) => ({ x: Number(m[1]), anchor: m[2], text: m[3] }));
    const loss = labels.find((l) => l.text.startsWith('stop-loss'));
    const gain = labels.find((l) => l.text.startsWith('stop-gain'));
    assert.deepEqual([loss.x, loss.anchor], [4, 'start'], `${width}: the stop-loss label at the left end`);
    assert.deepEqual([gain.x, gain.anchor], [width - 4, 'end'], `${width}: the stop-gain label at the right end`);
  }
});

test('limitRuler: a track with no loss side walls off everything below $0 and says so; a range all above $0 is all paid', () => {
  const svg = String(limitRuler({ ...RULER, low: 120000, high: 900000, limits: { gain: 1000000, loss: 0 }, width: WIDTH }));
  assert.equal((svg.match(/class="chart-ruler__loss"/g) ?? []).length, 0);
  assert.equal((svg.match(/class="chart-ruler__gain"/g) ?? []).length, 1);
  assert.match(svg, />no downside in Track 1</);
  assert.doesNotMatch(svg, /stop-loss/);
  const zeroX = Number(/class="chart-ruler__zero" x1="([\d.]+)"/.exec(svg)[1]);
  const [wall] = [...svg.matchAll(/class="chart-ruler__wall" fill="[^"]+" x="([\d.]+)" y="[\d.]+" width="([\d.]+)"/g)].map((m) => Number(m[1]) + Number(m[2]));
  assert.equal(wall, zeroX, 'the wall runs to $0');
});

test('limitRuler: every plotted value is in its table (limitRulerValues)', () => {
  const svg = limitRuler({ ...RULER, width: WIDTH });
  const rows = limitRulerValues(RULER).map(({ key, value }) => [key, { text: String(value), value: String(value) }]);
  assert.deepEqual(limitRulerValues(RULER).map((r) => r.key), ['low', 'high', 'loss', 'gain']);
  assert.deepEqual(values(svg).sort((a, b) => a - b), [-2300000, -546000, 551000, 2300000]);
  assert.doesNotThrow(() => figure({
    n: 1, takeaway: 't', svg, svgWide: limitRuler({ ...RULER, width: 560 }), source: 's', alt: 'a',
    table: { columns: [{ name: 'What' }, { name: 'Dollars', numeric: true }], rows },
  }));
});

test('limitRuler: its marks carry whole dollars, as limitRulerValues tables them', () => {
  const odd = { ...RULER, low: -546000.376000000004, high: 551000.5, limits: { gain: 2300000.25, loss: 2300000.25 } };
  assert.deepEqual(values(limitRuler({ ...odd, width: WIDTH })).sort((a, b) => a - b), [-2300000, -546000, 551001, 2300000]);
  assert.deepEqual(limitRulerValues(odd).map((r) => r.value), [-546000, 551001, -2300000, 2300000]);
});

test('limitRuler: the map kit every page that can draw it carries (charts-map.css, the hub\'s and every program site\'s) styles each class it draws; no page sheet keeps its own copy', () => {
  const kit = readFileSync(`${REPO_ROOT}${MAP_KIT_STYLE}`, 'utf8');
  // The frame's and the marks' own classes need no rule, nor the wall (its fill is the hatch, set on the element).
  const drawn = new Set([...String(limitRuler({ ...RULER, width: WIDTH })).matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].split(' ')));
  for (const cls of drawn) if (!['chart', 'chart-mark', 'chart-ruler__wall'].includes(cls) && !cls.startsWith('chart--')) assert.ok(kit.includes(`.${cls} `) || kit.includes(`.${cls},`), `the map kit styles .${cls}`);
  const hub = readFileSync(`${REPO_ROOT}hub/styles.css`, 'utf8');
  assert.doesNotMatch(hub, /\.chart-ruler__|\.hh__tmr \.chart-/, 'the hub sheet keeps no copy of the ruler\'s or the kit\'s rules');
});

test('limitRuler: bad input throws', () => {
  assert.throws(() => limitRuler({ ...RULER, low: 10, high: 0, width: WIDTH }), RangeError, 'low above high');
  assert.throws(() => limitRuler({ ...RULER, limits: { gain: 0, loss: 0 }, width: WIDTH }), RangeError);
  assert.throws(() => limitRuler({ ...RULER, high: 3000000, width: WIDTH }), RangeError, 'past the stop-gain');
  assert.throws(() => limitRuler({ ...RULER, id: 'Bad id', width: WIDTH }), RangeError);
});

const RULER_SNAPSHOT = "<svg class=\"chart chart--ruler\" viewBox=\"0 0 300 58\" width=\"100%\" focusable=\"false\" style=\"--vb: 300\"><defs><pattern id=\"chart-band-hatch\" class=\"chart-hatch\" patternUnits=\"userSpaceOnUse\" width=\"6\" height=\"6\" patternTransform=\"rotate(45)\"><rect width=\"1.5\" height=\"6\" fill=\"currentColor\"/></pattern></defs>\n<g class=\"chart-mark\" data-mark data-value=\"-2300000\"><title>loss: -2300000</title><rect class=\"chart-ruler__wall\" fill=\"url(#chart-band-hatch)\" x=\"4\" y=\"18\" width=\"24.33\" height=\"20\"/><line class=\"chart-ruler__limit\" x1=\"28.33\" x2=\"28.33\" y1=\"18\" y2=\"38\"/></g><g class=\"chart-mark\" data-mark data-value=\"2300000\"><title>gain: 2300000</title><rect class=\"chart-ruler__wall\" fill=\"url(#chart-band-hatch)\" x=\"271.67\" y=\"18\" width=\"24.33\" height=\"20\"/><line class=\"chart-ruler__limit\" x1=\"271.67\" x2=\"271.67\" y1=\"18\" y2=\"38\"/></g>\n<line class=\"chart-ruler__axis\" x1=\"4\" x2=\"296\" y1=\"38\" y2=\"38\"/>\n<g class=\"chart-mark\" data-mark data-value=\"-546000 551000\"><title>-546000 to 551000</title><rect class=\"chart-hit\" x=\"121.12\" y=\"20\" width=\"58.03\" height=\"14\"/><rect class=\"chart-ruler__loss\" x=\"121.12\" y=\"20\" width=\"28.88\" height=\"14\"/><rect class=\"chart-ruler__gain\" x=\"150\" y=\"20\" width=\"29.15\" height=\"14\"/></g>\n<line class=\"chart-ruler__zero\" x1=\"150\" x2=\"150\" y1=\"15\" y2=\"42\"/>\n<text class=\"chart-value chart-ruler__end\" x=\"119.12\" y=\"13\" text-anchor=\"end\">−$546K</text><text class=\"chart-value chart-ruler__end\" x=\"181.15\" y=\"13\" text-anchor=\"start\">+$551K</text><text class=\"chart-tick\" x=\"150\" y=\"13\" text-anchor=\"middle\">$0</text>\n<text class=\"chart-tick\" x=\"4\" y=\"53\" text-anchor=\"start\">stop-loss −$2300K</text><text class=\"chart-tick\" x=\"296\" y=\"53\" text-anchor=\"end\">stop-gain +$2300K</text></svg>";
test('limitRuler: the phone drawing matches its inline snapshot', () => {
  assert.equal(String(limitRuler({ ...RULER, width: WIDTH })), RULER_SNAPSHOT);
});
