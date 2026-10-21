import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { scaleLinear } from 'd3-scale';
import { parseCsv } from '../../engine/js/csv.js';
import { mulberry32 } from '../../engine/js/test/prng.js';
import { axis } from '../charts/axis.js';
import { contribBars } from '../charts/contribBars.js';
import { dotRange, dotRanges } from '../charts/dotRange.js';
import { figure } from '../charts/figure.js';
import { histogram, histogramBins } from '../charts/histogram.js';
import { ramp } from '../charts/ramp.js';
import { GRID, TILES } from '../charts/states.js';
import { tileMap } from '../charts/tileMap.js';
import { compareRows, scrollState, tableCsv } from '../client/figure.js';
import { citation } from '../render/components.js';
import { Safe } from '../render/html.js';

// Synthetic inputs only: no real hospital, measure values chosen by hand.
const BARS = {
  id: 'c1',
  rows: [
    { id: 'a', label: 'Measure A', value: 0.25 },
    { id: 'b', label: 'Measure B', value: -0.125 },
    { id: 'c', label: 'Measure C <&>', value: 0.5, assigned: true },
  ],
};
const DOT = { value: 1.2, floor: 0.4, cap: 2, median: 0.9, label: 'This hospital', medianLabel: 'Median', sameLabel: 'Scores the same' };
const RAMP = { domain: [-1, 1], actual: 0.3, band: [-0.05, 0.05], labels: { actual: 'This hospital', line: "CMS's line" } };
const HIST = { values: [-0.9, -0.5, -0.45, -0.1, 0, 0.12, 0.2, 0.61, 0.9], bins: 4, boundary: 0.05, markLabel: "CMS's line" };
const STATES = Object.fromEntries(Object.keys(TILES).map((st, i) => [st, { value: (i % 5) / 4, label: `${st} label` }]));
STATES.MD = { value: null, label: 'not subject to the reduction', hatched: true };
const MAP = { id: 'm1', states: STATES, ramp: [0.2, 0.4, 0.6, 0.8], legend: { title: 'Share', high: '1', zero: 'none cut' } };
const TABLE = { columns: [{ name: 'Measure', numeric: false }, { name: 'Part', numeric: true }], rows: [['Measure A', '0.25'], ['Measure B', '-0.125'], ['Measure C', '0.5']] };
const FIG = { n: 1, takeaway: 'Measure C adds the most.', svg: contribBars(BARS), source: 'Synthetic source.', table: TABLE, alt: 'Three bars.' };

const OUTPUTS = () => ({
  axis: axis({ scale: scaleLinear().domain([0, 1]).range([0, 100]), orient: 'bottom', ticks: 2 }),
  contribBars: contribBars(BARS),
  dotRange: dotRange(DOT),
  ramp: ramp(RAMP),
  histogram: histogram(HIST),
  tileMap: tileMap(MAP),
  figure: figure(FIG),
});

test('every chart part returns Safe markup with no hex color in it', () => {
  for (const [name, out] of Object.entries(OUTPUTS())) {
    assert.ok(out instanceof Safe, name);
    assert.doesNotMatch(String(out), /#[0-9a-fA-F]{3,8}\b/, name);
  }
});

test('each chart is a responsive SVG: a viewBox, width 100%, no fixed height in CSS terms, marks with a tooltip', () => {
  for (const [name, out] of Object.entries(OUTPUTS())) {
    if (name === 'axis' || name === 'figure') continue;
    const s = String(out);
    assert.match(s, /^<svg class="chart chart--[a-z-]+" viewBox="0 0 (\d+) \d+" width="100%" focusable="false" style="--vb: \1">/, name);
    const marks = s.match(/<g class="chart-mark[^"]*" data-mark/g) ?? [];
    const titles = s.match(/<g class="chart-mark[^"]*" data-mark[^>]*><title>[^<]+<\/title>/g) ?? [];
    assert.ok(marks.length > 0, name);
    assert.equal(titles.length, marks.length, `${name}: every mark carries its tooltip`);
  }
});

test('the hatch is an SVG pattern in currentColor with an id from the caller, so two charts never share one', () => {
  const a = String(contribBars(BARS));
  const b = String(contribBars({ ...BARS, id: 'c2' }));
  assert.match(a, /<pattern id="chart-c1-hatch"[^>]*patternTransform="rotate\(45\)"[^>]*><rect[^>]*fill="currentColor"\/><\/pattern>/);
  assert.ok(b.includes('id="chart-c2-hatch"') && !b.includes('chart-c1-hatch'));
  assert.throws(() => contribBars({ ...BARS, id: 'Bad id' }), /id/);
});

test('mark tooltips and labels escape hostile text', () => {
  const s = String(contribBars(BARS));
  assert.ok(s.includes('Measure C &lt;&amp;&gt;'));
  assert.ok(!s.includes('<&>'));
});

test('contribBars keeps the given order, hatches assigned rows, and keeps every bar at most 24px thick', () => {
  const s = String(contribBars(BARS));
  const order = [...s.matchAll(/data-row="(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual(order, ['a', 'b', 'c']);
  const assigned = /data-row="c"[\s\S]*?<\/g>/.exec(s)[0];
  assert.match(assigned, /fill="url\(#chart-c1-hatch\)"/);
  assert.doesNotMatch(/data-row="a"[\s\S]*?<\/g>/.exec(s)[0], /hatch/);
  // A bar's path starts at its top edge on the zero line, runs along it (H) to the data end and closes along its
  // bottom edge (the last A's y); its thickness is bottom - top.
  const path = (id) => new RegExp(`data-row="${id}"[\\s\\S]*?<path class="chart-bar[^"]*"[^>]* d="([^"]+)"`).exec(s)[1];
  for (const id of ['a', 'b', 'c']) {
    const d = path(id);
    const top = Number(/^M[\d.]+ ([\d.]+)/.exec(d)[1]);
    const bottom = Number(/ ([\d.]+)H[\d.]+Z$/.exec(d)[1]);
    assert.ok(bottom - top > 0 && bottom - top <= 24, `${id}: ${bottom - top}`);
  }
  // A negative part grows left from the zero line, a positive one right.
  const zero = Number(/class="chart-zero" x1="([\d.]+)"/.exec(s)[1]);
  const xs = (id) => [...path(id).matchAll(/H([\d.]+)/g)].map((m) => Number(m[1]));
  assert.ok(Math.min(...xs('b')) < zero && Math.max(...xs('a')) > zero && Math.max(...xs('c')) > Math.max(...xs('a')));
});

test('an assigned part of zero still shows a hatched stub at the zero line', () => {
  const s = String(contribBars({ id: 'z1', rows: [{ id: 'a', label: 'A', value: 0.5 }, { id: 'z', label: 'Z', value: 0, assigned: true }] }));
  const z = /data-row="z"[\s\S]*?<\/g>/.exec(s)[0];
  assert.match(z, /class="chart-bar-na" fill="url\(#chart-z1-hatch\)"/);
  assert.doesNotMatch(String(contribBars({ id: 'z2', rows: [{ id: 'z', label: 'Z', value: 0 }] })), /chart-bar/);
});

test('dotRange hatches the values that score the same past the floor and the cap, each with a hairline where it starts', () => {
  const s = String(dotRange(DOT));
  assert.equal(s.match(/<rect class="chart-dead" fill="url\(#chart-range-hatch\)"/g).length, 2, 'below the floor and past the cap');
  assert.equal(s.match(/class="chart-dead__end"/g).length, 2);
  assert.ok(s.includes('<title>Scores the same (0.4, 2)</title>'));
  // A floor at zero starts the axis: nothing to hatch below it, and no room left under zero.
  const sir = String(dotRange({ ...DOT, floor: 0 }));
  assert.equal(sir.match(/class="chart-dead"/g).length, 1, 'past the cap only');
  assert.ok(sir.includes('<title>Scores the same (2)</title>'));
  assert.match(sir, /<text class="chart-axis__label" x="18" y="-12" text-anchor="middle">0\.0<\/text>/, 'the axis starts at zero, its labels clear of the marks');
});

test('dotRange draws the median as an ink tick crossing the axis, drops any axis tick beside it, and this hospital as a triangle under the axis', () => {
  const s = String(dotRange({ ...DOT, floor: 0, median: 1 }));
  assert.match(s, /<line class="chart-median" x1="([\d.]+)" x2="\1" y1="17" y2="31"\/>/);
  const at = /<line class="chart-median" x1="([\d.]+)"/.exec(s)[1];
  assert.doesNotMatch(s, new RegExp(`class="chart-axis__tick" x1="${at}"`), 'no axis tick under the median');
  assert.ok(s.includes(`<text class="chart-axis__label" x="${at}" y="-12" text-anchor="middle">1.0</text>`), 'its label stays');
  assert.match(s, /class="chart-this"/);
  assert.ok(s.includes('>This hospital</text>'));
  assert.ok(!String(dotRange({ ...DOT, value: null })).includes('chart-this'), 'no value, no triangle');
});

test('dotRanges stacks one titled dotRange per row, each on its own scale and format, in one SVG', () => {
  const rows = [
    { id: 'b', title: 'Row B <&>', value: null, floor: 0, cap: 10, median: 5, label: 'This hospital', note: 'no value <here>' },
    { id: 'a', title: 'Row A', ...DOT, format: (v) => v.toFixed(2) },
    { id: 'c', title: 'Row C', ...DOT },
  ];
  const s = String(dotRanges({ rows, medianLabel: 'Median', sameLabel: 'Scores the same' }));
  assert.match(s, /^<svg class="chart chart--dot-ranges" viewBox="0 0 360 \d+"/);
  assert.equal(s.match(/<svg /g).length, 1, 'one SVG');
  assert.equal(s.match(/<defs>/g).length, 1, 'one hatch pattern for every row');
  assert.equal(s.match(/class="chart-median"/g).length, 3);
  assert.equal(s.match(/class="chart-this"/g).length, 2, 'no triangle where the value is null');
  assert.ok(s.includes('>no value &lt;here&gt;</text>'), "a null value's note stands in its place, as text");
  assert.equal(s.match(/>This hospital<\/text>/g).length, 1, "the triangle's label prints once, under the first triangle");
  assert.ok(s.includes('>Row A</text>') && s.includes('>Row B &lt;&amp;&gt;</text>'));
  assert.ok(s.includes('<title>This hospital: 1.20</title>'), 'each row keeps its own format');
  assert.ok(s.includes('<title>This hospital: 1.2</title>'), 'every triangle keeps its tooltip');
  assert.ok(s.includes('<title>Median: 5</title>'));
  assert.throws(() => dotRanges({ rows: [], medianLabel: 'M', sameLabel: 'S' }), /rows/);
});

test('histogramBins puts each value in exactly one bin, with CMS\'s line as a bin edge', () => {
  const rand = mulberry32(11);
  for (let trial = 0; trial < 200; trial++) {
    const n = 1 + Math.floor(rand() * 60);
    const values = Array.from({ length: n }, () => Math.round((rand() * 4 - 2) * 1e4) / 1e4);
    const boundary = Math.round((rand() * 3 - 1.5) * 1e4) / 1e4;
    const bins = histogramBins(values, 1 + Math.floor(rand() * 25), boundary);
    assert.equal(bins.reduce((t, b) => t + b.count, 0), n);
    for (const v of values) {
      const holding = bins.filter((b, i) => v >= b.x0 && (v < b.x1 || (i === bins.length - 1 && v <= b.x1)));
      assert.equal(holding.length, 1, `value ${v} in ${holding.length} bins`);
    }
    for (let i = 1; i < bins.length; i++) assert.equal(bins[i].x0, bins[i - 1].x1);
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    if (boundary > lo && boundary < hi) assert.ok(bins.some((b) => Math.abs(b.x0 - boundary) < 1e-9), 'the line is an edge');
    for (const b of bins) assert.equal(b.above, b.x0 >= boundary - 1e-9);
  }
  // One value: the bins run from the line to it, and it sits in the last one, above the line.
  const one = histogramBins([0.5], 10, 0);
  assert.equal(one[0].x0, 0);
  assert.deepEqual([one.at(-1).count, one.at(-1).above, one.reduce((t, b) => t + b.count, 0)], [1, true, 1]);
  assert.deepEqual(histogramBins([2], 4, 2).map((b) => [b.count, b.above]), [[1, true]]);
  assert.throws(() => histogramBins([1, Number.NaN], 4, 0), /finite/);
});

test('a boundary outside the data is still a bin edge, and the histogram draws its line inside the chart', () => {
  for (const boundary of [10, -10, 3, 1]) {
    const values = [1, 1.5, 2, 2.5, 3];
    const bins = histogramBins(values, 10, boundary);
    assert.ok(bins.some((b) => b.x0 === boundary) || bins.at(-1).x1 === boundary, `edge at ${boundary}`);
    assert.equal(bins.reduce((t, b) => t + b.count, 0), values.length);
    for (const b of bins) assert.equal(b.above, b.x0 >= boundary);
    assert.ok(bins.length <= 30, `${bins.length} bins`);
    // Every value at or past the boundary is in a bin drawn above the line.
    for (const v of values.filter((x) => x >= boundary)) assert.ok(bins.find((b) => v >= b.x0 && v <= b.x1 && b.count).above, `${v}`);
    const s = String(histogram({ values, bins: 10, boundary, markLabel: 'Line' }));
    const x = Number(/class="chart-boundary" x1="([-\d.]+)"/.exec(s)[1]);
    assert.ok(x >= 0 && x <= 360, `line at ${x}`);
  }
});

test('histogram fills bins above the line in pen and the rest neutral, and annotates the line', () => {
  const s = String(histogram(HIST));
  const bins = histogramBins(HIST.values, HIST.bins, HIST.boundary);
  const cols = [...s.matchAll(/<path class="(chart-col[^"]*)"/g)].map((m) => m[1]);
  assert.deepEqual(cols, bins.filter((b) => b.count > 0).map((b) => (b.above ? 'chart-col chart-col--pen' : 'chart-col')));
  assert.match(s, /class="chart-boundary"/);
  assert.ok(s.includes(">CMS&#39;s line</text>"));
});

test('histogram: optional axis titles, and a direct label on each side of the line that never sits on a column', () => {
  const s = String(histogram({ ...HIST, xTitle: 'Score <x>', yTitle: 'Count', groups: { below: 'Below: 5', above: 'Above: 4' } }));
  assert.match(s, /viewBox="0 0 360 216"/, 'room under the axis for its title');
  assert.ok(s.includes('class="chart-axis__title" x="192" y="208" text-anchor="middle">Score &lt;x&gt;</text>'));
  assert.ok(s.includes('class="chart-axis__title" x="0" y="14" text-anchor="start">Count</text>'));
  const labels = [...s.matchAll(/<text class="chart-label chart-label--halo" x="([\d.]+)" y="([\d.]+)" text-anchor="(start|end)">([^<]+)<\/text>/g)];
  assert.deepEqual(labels.map((m) => m[4]), ['Below: 5', 'Above: 4']);
  // Each label's baseline is above every column under its estimated span.
  const cols = [...s.matchAll(/<rect class="chart-hit" x="([\d.]+)" y="[\d.]+" width="([\d.]+)"[^>]*\/><path class="chart-col[^"]*" d="M[\d.]+ [\d.]+V([\d.]+)/g)]
    .map((m) => ({ l: Number(m[1]), r: Number(m[1]) + Number(m[2]), top: Number(m[3]) - 4 }));
  for (const [, x, y, anchor, body] of labels) {
    const w = body.length * 7;
    const [l, r] = anchor === 'end' ? [Number(x) - w, Number(x)] : [Number(x), Number(x) + w];
    for (const c of cols.filter((c) => c.r > l && c.l < r)) assert.ok(Number(y) < c.top, `${body} clears the column at ${c.l}`);
  }
  assert.ok(!String(histogram(HIST)).includes('chart-axis__title'), 'no titles unless given');
});

test('the tile grid holds the 50 states, DC and PR, one cell each', () => {
  const codes = ('AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK '
    + 'OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC PR').split(' ');
  assert.deepEqual(Object.keys(TILES).sort(), [...codes].sort());
  const cells = Object.values(TILES).map(([c, r]) => `${c},${r}`);
  assert.equal(new Set(cells).size, cells.length);
  for (const [c, r] of Object.values(TILES)) assert.ok(c >= 0 && c < GRID.cols && r >= 0 && r < GRID.rows);
});

test('tileMap draws a code with no data hatched with its label, never as zero, and refuses a missing or unknown code', () => {
  const s = String(tileMap(MAP));
  const md = /<g class="chart-mark[^"]*" data-mark data-state="MD"[\s\S]*?<\/g>/.exec(s)[0];
  assert.match(md, /fill="url\(#chart-m1-hatch\)"/);
  assert.ok(md.includes('<title>MD: not subject to the reduction</title>'));
  assert.ok(!md.includes('data-value'));
  assert.ok(s.includes('>Not subject to the reduction</text>'), 'the hatch has a legend label, in sentence case');
  const { CA, ...missing } = STATES;
  assert.throws(() => tileMap({ ...MAP, states: missing }), /CA/);
  assert.throws(() => tileMap({ ...MAP, states: { ...STATES, ZZ: { value: 1, label: 'x' } } }), /ZZ/);
  assert.throws(() => tileMap({ ...MAP, states: { ...STATES, CA: { value: null, label: 'x' } } }), /CA/);
});

test('tileMap draws nothing-to-show as an empty dashed tile, apart from the hatch, each with its own legend swatch', () => {
  const s = String(tileMap({ ...MAP, states: { ...STATES, PR: { empty: true, label: 'none in the file' } } }));
  assert.match(s, /data-state="PR"><title>PR: none in the file<\/title><rect class="chart-tile-empty" x="[\d.]+" y="[\d.]+" width="[\d.]+" height="[\d.]+"\/>/);
  assert.match(s, /<rect class="chart-tile-na" fill="url\(#chart-m1-hatch\)" x="0" y="[\d.]+" width="12" height="12"\/><text[^>]*>Not subject to the reduction<\/text>/);
  assert.match(s, /<rect class="chart-tile-empty" x="0" y="[\d.]+" width="12" height="12"\/><text[^>]*>None in the file<\/text>/);
  assert.throws(() => tileMap({ ...MAP, states: { ...STATES, PR: { empty: true, hatched: true, label: 'x' } } }), /hatched or empty/);
});

test('tileMap: the legend is one stepped bar with each threshold under its edge; showValues prints each valued tile\'s text', () => {
  const s = String(tileMap(MAP));
  const legend = /<g class="chart-legend">([\s\S]*)<\/g>/.exec(s)[1];
  assert.equal(legend.match(/<rect class="chart-tile chart-seq-\d" x="[\d.]+" y="[\d.]+" width="44" height="10"\/>/g).length, 5);
  assert.deepEqual([...legend.matchAll(/class="chart-legend__label" x="([\d.]+)" y="[\d.]+" text-anchor="middle">([^<]+)</g)].map((m) => [m[1], m[2]]),
    [['44', '0.2'], ['88', '0.4'], ['132', '0.6'], ['176', '0.8']]);
  // Its title above it, and the two ends labelled: zero under the left end, legend.high beside the right end.
  assert.match(legend, /<text class="chart-legend__title" x="0" y="[\d.]+" text-anchor="start">Share<\/text>/);
  assert.match(legend, /x="0" y="[\d.]+" text-anchor="start">0<\/text>/);
  assert.match(legend, /x="226" y="[\d.]+" text-anchor="start">1<\/text>/);
  assert.ok(!s.includes('chart-tile__value'), 'no values unless asked');
  const states = { ...STATES, CA: { value: 0.3, label: 'CA label', text: '30.0% <b>' } };
  const shown = String(tileMap({ ...MAP, states, showValues: true }));
  assert.match(shown, /data-state="CA"[\s\S]*?<text class="chart-tile__value[^"]*"[^>]*>30\.0% &lt;b&gt;<\/text>/);
  assert.doesNotMatch(/data-state="MD"[\s\S]*?<\/g>/.exec(shown)[0], /chart-tile__value/, 'a hatched tile prints no value');
});

test('tileMap steps follow the ramp thresholds, and text on a dark step uses the on-mark ink', () => {
  const s = String(tileMap(MAP));
  const step = (st) => new RegExp(`data-state="${st}"[^>]*>[\\s\\S]*?class="chart-tile chart-seq-(\\d)"`).exec(s)[1];
  const code = Object.keys(TILES);
  const at = (v) => code.find((st) => STATES[st].value === v && st !== 'MD');
  assert.equal(step(at(0.25)), '2');
  assert.equal(step(at(0.5)), '3');
  assert.equal(step(at(1)), '5');
});

test('tileMap: a zero share takes the neutral mark, never a ramp step, keyed in the legend; few cases get a dashed inner outline', () => {
  const s = String(tileMap(MAP));
  const zero = Object.keys(TILES).find((st) => STATES[st].value === 0);
  const tile = new RegExp(`data-state="${zero}"[^>]*>[\\s\\S]*?</g>`).exec(s)[0];
  assert.match(tile, /<rect class="chart-tile chart-tile-zero"/);
  assert.doesNotMatch(tile, /chart-seq-/);
  assert.match(s, /<rect class="chart-tile chart-tile-zero" x="0" y="[\d.]+" width="12" height="12"\/><text[^>]*>None cut<\/text>/, 'sentence case');
  assert.throws(() => tileMap({ ...MAP, legend: {} }), /legend\.zero/);
  assert.throws(() => tileMap({ ...MAP, legend: { ...MAP.legend, title: '' } }), /legend\.title/);
  assert.throws(() => tileMap({ ...MAP, legend: { ...MAP.legend, high: undefined } }), /legend\.high/);
  const states = { ...STATES, CA: { value: 0.9, label: 'CA', few: true, text: '4 of 6' } };
  assert.throws(() => tileMap({ ...MAP, states }), /legend\.few/);
  const few = String(tileMap({ ...MAP, states, showValues: true, legend: { ...MAP.legend, few: 'few decisions' } }));
  const ca = /data-state="CA"[\s\S]*?<\/g>/.exec(few)[0];
  assert.match(ca, /<rect class="chart-tile-few chart-tile-few--on"/, 'on a dark step the outline takes the on-mark ink');
  assert.ok(ca.includes('>4 of 6</text>'));
  assert.match(few, />Few decisions<\/text>/);
});

test('tile codes are centered by charts.css, not an attribute on each of the 52 tiles', () => {
  assert.doesNotMatch(String(tileMap(MAP)), /class="chart-tile__code[^"]*"[^>]*text-anchor/);
  const css = readFileSync(new URL('../styles/charts.css', import.meta.url), 'utf8');
  assert.match(css, /\.chart-tile__code \{[^}]*text-anchor: middle;/);
});

test('ramp marks CMS\'s line and this hospital where the what-if ramp would, and clamps a far hypothetical with an arrow', () => {
  const s = String(ramp(RAMP));
  assert.match(s, /class="chart-line"/);
  assert.match(s, /class="chart-this"/);
  assert.ok(!s.includes('chart-hyp'));
  const far = String(ramp({ ...RAMP, hypothetical: 5, labels: { ...RAMP.labels, hypothetical: 'Hypothetical' } }));
  assert.match(far, /class="chart-hyp"/);
  assert.ok(far.includes('>▶</text>'));
});

test('figure: Figure N. and the takeaway, the SVG as an image named by alt, the source, and a Show table toggle', () => {
  const s = String(figure(FIG));
  assert.match(s, /^<figure class="fig" id="figure-1" data-figure>/);
  assert.match(s, /<figcaption class="fig__cap" id="figure-1-cap"><span class="fig__n">Figure 1\.<\/span> Measure C adds the most\.<\/figcaption>/);
  assert.match(s, /<table class="gb" aria-labelledby="figure-1-cap">/, 'the table is named by the caption');
  assert.match(s, /<svg role="img" aria-label="Three bars\." class="chart chart--bars"/);
  assert.ok(s.includes('<p class="source fig__source">Synthetic source.</p>'));
  assert.match(s, /<details class="fig__table"><summary>Show table<\/summary>/);
  assert.ok(s.includes('<button type="button" class="fig__btn" data-figure-csv="figure-1.csv" hidden>Download CSV</button>'));
  assert.ok(!s.includes('fig__claim'), 'official values carry no claim level');
});

test('figure: the table marks numeric columns and keeps the raw value beside the display text (true minus)', () => {
  const s = String(figure(FIG));
  assert.ok(s.includes('<th scope="col">Measure</th><th scope="col" data-numeric>Part</th>'));
  assert.ok(s.includes('<td class="num" data-value="-0.125">−0.125</td>'));
  assert.ok(s.includes('<th scope="row">Measure B</th>'));
});

test('figure: a numeric cell with no raw value keeps no data-value, so the browser falls back to its text', () => {
  const rows = [...TABLE.rows, ['Measure D', { text: 'Not Available', value: null }], ['Measure E', { text: 'N/A' }]];
  const s = String(figure({ ...FIG, table: { ...TABLE, rows } }));
  assert.ok(s.includes('<td class="num">Not Available</td>'));
  assert.ok(s.includes('<td class="num">N/A</td>'));
  assert.ok(!s.includes('data-value="null"') && !s.includes('data-value=""'));
});

test('figure: a claim level other than official leads the source line, as words; an unknown one throws', () => {
  for (const [level, text] of [['recomputed', 'This site recomputes'], ['estimate', 'Estimate'], ['hypothetical', 'Hypothetical']]) {
    const s = String(figure({ ...FIG, claimLevel: level }));
    assert.ok(s.includes(`<p class="source fig__source"><span class="fig__claim">${text}</span> · Synthetic source.</p>`), level);
    assert.ok(!s.includes('class="pill"'), `${level}: not a badge`);
  }
  assert.throws(() => figure({ ...FIG, claimLevel: 'guess' }), /claimLevel/);
});

test('figure: an optional note sits under the chart, as text; a blank or non-text note throws', () => {
  const s = String(figure({ ...FIG, note: 'Not drawn: <b> & co.' }));
  assert.ok(s.includes('</svg>\n<p class="small muted fig__note">Not drawn: &lt;b&gt; &amp; co.</p>\n'));
  assert.ok(!String(figure(FIG)).includes('fig__note'));
  for (const note of ['', 3, {}]) assert.throws(() => figure({ ...FIG, note }), /note/, String(note));
});

test('figure: an optional key names marks above the chart, as text; a bad key throws', () => {
  const s = String(figure({ ...FIG, key: [{ swatch: 'this', label: 'This <one>' }, { swatch: 'same', label: 'Range' }] }));
  assert.ok(s.includes('</figcaption>\n<ul class="fig__key" role="list"><li><span class="fig__swatch fig__swatch--this" aria-hidden="true"></span>This &lt;one&gt;</li>'));
  assert.ok(s.indexOf('fig__key') < s.indexOf('<svg'), 'the key comes before the chart');
  assert.ok(!String(figure(FIG)).includes('fig__key'));
  for (const key of [[], [{ swatch: 'nope', label: 'x' }], [{ swatch: 'this', label: '' }], 'this']) {
    assert.throws(() => figure({ ...FIG, key }), /key/, JSON.stringify(key));
  }
});

test('figure: an optional wide variant rides beside the phone one, both named by alt, both checked against the table', () => {
  const wide = contribBars({ ...BARS, width: 560 });
  const s = String(figure({ ...FIG, svgWide: wide }));
  assert.equal(s.match(/<svg role="img" aria-label="Three bars\." data-fit="(narrow|wide)"/g).length, 2);
  assert.ok(s.indexOf('data-fit="narrow"') < s.indexOf('data-fit="wide"'));
  assert.ok(!String(figure(FIG)).includes('data-fit'), 'one chart, no variants');
  assert.throws(() => figure({ ...FIG, svgWide: 'x' }), /svgWide/);
  const extra = new Safe('<svg class="chart"><g data-mark data-value="9"></g></svg>');
  assert.throws(() => figure({ ...FIG, svgWide: extra }), /not in the table/);
});

test('figure: a chart that is not a kit SVG frames as given, in place of svg, with no alt or plotted-value check', () => {
  const chart = new Safe('<div class="live">bars</div>');
  const s = String(figure({ ...FIG, svg: undefined, alt: undefined, chart }));
  assert.ok(s.includes('</figcaption>\n<div class="live">bars</div>'));
  assert.ok(!s.includes('role="img"'));
  assert.ok(s.includes('<details class="fig__table">'), 'still a table');
  assert.throws(() => figure({ ...FIG, chart }), /in place of svg/);
  assert.throws(() => figure({ ...FIG, svg: undefined, chart: '<div>' }), /Safe/);
});

test('figure: every plotted value must be in the table, or the figure refuses to build', () => {
  for (const svg of [contribBars(BARS), dotRange(DOT), ramp(RAMP), histogram(HIST), tileMap(MAP)]) {
    const values = [...String(svg).matchAll(/data-value="([^"]+)"/g)].flatMap((m) => m[1].split(' '));
    assert.ok(values.length > 0);
    const table = { columns: [{ name: 'Value', numeric: true }], rows: values.map((v) => [v]) };
    assert.doesNotThrow(() => figure({ ...FIG, svg, table }));
    const without = table.rows.filter(([v]) => Number(v) !== Number(values[0]));
    assert.throws(() => figure({ ...FIG, svg, table: { ...table, rows: without } }), /not in the table/);
  }
  // CMS's text with its trailing zero matches the plotted number.
  assert.doesNotThrow(() => figure({ ...FIG, table: { ...TABLE, rows: [['A', '0.2500'], ['B', '-0.1250'], ['C', '0.50']] } }));
  assert.throws(() => figure({ ...FIG, table: { ...TABLE, rows: [] } }), /table/);
});

test('figure: a blank or non-numeric cell never vouches for a plotted value, and a plotted value must be finite', () => {
  const plot = (values) => new Safe(`<svg class="chart"><g data-mark data-value="${values}"></g></svg>`);
  const cols = [{ name: 'Value', numeric: true }];
  const build = (svg, rows) => () => figure({ ...FIG, svg, table: { columns: cols, rows } });
  // Number('') and Number(' ') are 0: a blank cell must not stand in for a plotted 0.
  assert.throws(build(plot('0'), [[{ text: '—', value: '' }]]), /not in the table/);
  assert.throws(build(plot('0'), [[{ text: '—', value: ' ' }]]), /not in the table/);
  assert.doesNotThrow(build(plot('0'), [['0.0000']]));
  // NaN is not a value: neither a NaN cell nor a NaN plotted value passes.
  assert.throws(build(plot('NaN'), [['NaN']]), /not in the table/);
  assert.throws(build(plot('abc'), [['abc']]), /not in the table/);
  assert.throws(build(plot('Infinity'), [['Infinity']]), /not in the table/);
  assert.throws(build(plot(''), [['0']]), /not in the table/);
});

test('figure: hostile takeaway, alt, source and cells render as text', () => {
  const evil = '"><script>x</script>';
  const s = String(figure({ ...FIG, takeaway: evil, alt: evil, source: evil, table: { ...TABLE, rows: [[evil, '0.25'], ['B', '-0.125'], ['C', '0.5']] } }));
  assert.ok(!s.includes('<script>'));
  assert.equal(s.match(/&quot;&gt;&lt;script&gt;/g).length, 4);
});

test('figure refuses a missing number, takeaway, alt, source or SVG, and a bad CSV name', () => {
  assert.throws(() => figure({ ...FIG, n: 0 }), /n/);
  assert.throws(() => figure({ ...FIG, takeaway: '' }), /takeaway/);
  assert.throws(() => figure({ ...FIG, alt: '' }), /alt/);
  assert.throws(() => figure({ ...FIG, source: '' }), /source/);
  assert.throws(() => figure({ ...FIG, csvName: '../x' }), /csvName/);
  assert.throws(() => figure({ ...FIG, svg: '<svg>' }), /svg/);
});

test('the citation block escapes its text and hides its Copy button until the cite script shows it', () => {
  const block = citation({ heading: 'Cite', text: 'A & B', button: 'Copy', copied: 'Copied', failed: 'Not copied' });
  assert.ok(String(block).includes('<p class="cite__text" data-cite-text>A &amp; B</p>'));
  assert.ok(String(block).includes('data-cite-copy hidden>Copy</button>'));
});

// A stand-in for a rendered table: just what tableCsv and compareRows read.
const cell = (text, value) => ({ textContent: text, getAttribute: (k) => (k === 'data-value' ? value ?? null : null), hasAttribute: (k) => k === 'data-numeric' && value === 'numeric' });
const row = (...cells) => ({ cells });
function fakeTable(head, body) {
  return { tHead: { rows: [row(...head)] }, tBodies: [{ rows: body }] };
}

test('the browser CSV comes from the table: column names, raw values over display text, and the formula guard', () => {
  const table = fakeTable([cell('Name'), cell('Score', 'numeric')], [
    row(cell('=Hospital'), cell('−0.2580', '-0.2580')),
    row(cell('Plain, "quoted"'), cell('N/A')),
  ]);
  const text = tableCsv(table);
  assert.equal(text.split('\r\n')[0], 'Name,Score');
  assert.deepEqual(parseCsv(text), [{ Name: "'=Hospital", Score: '-0.2580' }, { Name: 'Plain, "quoted"', Score: 'N/A' }]);
});

test('column sort: numbers by value with non-numbers last either way; text by locale; ties keep their order', () => {
  const rows = [['b', '2'], ['a', '-1'], ['c', 'N/A'], ['a2', '10'], ['d', '2']].map(([t, v]) => row(cell(t), cell(v, v)));
  const names = (list) => list.map((r) => r.cells[0].textContent);
  assert.deepEqual(names([...rows].sort(compareRows(1, true, 1))), ['a', 'b', 'd', 'a2', 'c']);
  assert.deepEqual(names([...rows].sort(compareRows(1, true, -1))), ['a2', 'b', 'd', 'a', 'c']);
  assert.deepEqual(names([...rows].sort(compareRows(0, false, 1))), ['a', 'a2', 'b', 'c', 'd']);
});

test('a scroll box is a region while its table overflows, and fades while more lies to the right', () => {
  const box = (scrollWidth, clientWidth, scrollLeft) => scrollState({ scrollWidth, clientWidth, scrollLeft });
  assert.deepEqual(box(300, 264, 0), { region: true, more: true });
  assert.deepEqual(box(300, 264, 36), { region: true, more: false });
  assert.deepEqual(box(264.5, 264, 0), { region: false, more: false });
});

// Inline snapshots: the exact markup for the fixed synthetic inputs above. A change here is a visible change to every
// figure; look at it in the browser before updating a snapshot.
const SNAPSHOTS = {
  axis: `<g class="chart-axis"><line class="chart-axis__line" x1="0" x2="100" y1="0" y2="0"/><line class="chart-axis__tick" x1="0" x2="0" y1="0" y2="4"/><text class="chart-axis__label" x="0" y="16" text-anchor="middle">0.0</text><line class="chart-axis__tick" x1="50" x2="50" y1="0" y2="4"/><text class="chart-axis__label" x="50" y="16" text-anchor="middle">0.5</text><line class="chart-axis__tick" x1="100" x2="100" y1="0" y2="4"/><text class="chart-axis__label" x="100" y="16" text-anchor="middle">1.0</text></g>`,
  axisLeft: `<g class="chart-axis"><line class="chart-axis__line" x1="0" x2="0" y1="50" y2="0"/><line class="chart-grid" x1="0" x2="80" y1="50" y2="50"/><line class="chart-axis__tick" x1="-4" x2="0" y1="50" y2="50"/><text class="chart-axis__label" x="-7" y="50" dy="0.32em" text-anchor="end">0</text><line class="chart-grid" x1="0" x2="80" y1="0" y2="0"/><line class="chart-axis__tick" x1="-4" x2="0" y1="0" y2="0"/><text class="chart-axis__label" x="-7" y="0" dy="0.32em" text-anchor="end">10</text></g>`,
  contribBars: `<svg class="chart chart--bars" viewBox="0 0 360 92" width="100%" focusable="false" style="--vb: 360"><defs><pattern id="chart-c1-hatch" class="chart-hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)"><rect width="1.5" height="6" fill="currentColor"/></pattern></defs>
<g class="chart-mark" data-mark data-row="a" data-value="0.25"><title>Measure A: 0.25</title><rect class="chart-hit" x="0" y="4" width="360" height="28"/><text class="chart-label" x="0" y="22" text-anchor="start">Measure A</text><path class="chart-bar" d="M204 10H246A4 4 0 0 1 250 14V22A4 4 0 0 1 246 26H204Z"/><text class="chart-value" x="360" y="22" text-anchor="end">0.25</text></g>
<g class="chart-mark" data-mark data-row="b" data-value="-0.125"><title>Measure B: −0.125</title><rect class="chart-hit" x="0" y="32" width="360" height="28"/><text class="chart-label" x="0" y="50" text-anchor="start">Measure B</text><path class="chart-bar" d="M204 38H185A4 4 0 0 0 181 42V50A4 4 0 0 0 185 54H204Z"/><text class="chart-value" x="360" y="50" text-anchor="end">−0.125</text></g>
<g class="chart-mark" data-mark data-row="c" data-value="0.5"><title>Measure C &lt;&amp;&gt;: 0.5</title><rect class="chart-hit" x="0" y="60" width="360" height="28"/><text class="chart-label" x="0" y="78" text-anchor="start">Measure C &lt;&amp;&gt;</text><path class="chart-bar-na" fill="url(#chart-c1-hatch)" d="M204 66H292A4 4 0 0 1 296 70V78A4 4 0 0 1 292 82H204Z"/><text class="chart-value" x="360" y="78" text-anchor="end">0.5</text></g>
<line class="chart-zero" x1="204" x2="204" y1="0" y2="92"/></svg>`,
  dotRange: `<svg class="chart chart--dot-range" viewBox="0 0 360 61" width="100%" focusable="false" style="--vb: 360"><defs><pattern id="chart-range-hatch" class="chart-hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)"><rect width="1.5" height="6" fill="currentColor"/></pattern></defs><g class="chart-mark" data-mark data-value="0.4 2"><title>Scores the same (0.4, 2)</title><rect class="chart-dead" fill="url(#chart-range-hatch)" x="18" y="20" width="27" height="8"/><rect class="chart-dead" fill="url(#chart-range-hatch)" x="315" y="20" width="27" height="8"/><line class="chart-dead__end" x1="45" x2="45" y1="20" y2="28"/><line class="chart-dead__end" x1="315" x2="315" y1="20" y2="28"/></g>
<g transform="translate(0 24)"><g class="chart-axis"><line class="chart-axis__line" x1="18" x2="342" y1="0" y2="0"/><line class="chart-axis__tick" x1="61.88" x2="61.88" y1="0" y2="-4"/><text class="chart-axis__label" x="61.88" y="-12" text-anchor="middle">0.5</text><line class="chart-axis__tick" x1="146.25" x2="146.25" y1="0" y2="-4"/><text class="chart-axis__label" x="146.25" y="-12" text-anchor="middle">1.0</text><line class="chart-axis__tick" x1="230.63" x2="230.63" y1="0" y2="-4"/><text class="chart-axis__label" x="230.63" y="-12" text-anchor="middle">1.5</text><line class="chart-axis__tick" x1="315" x2="315" y1="0" y2="-4"/><text class="chart-axis__label" x="315" y="-12" text-anchor="middle">2.0</text></g></g>
<g class="chart-mark" data-mark data-value="0.9"><title>Median: 0.9</title><rect class="chart-hit" x="123.38" y="16" width="12" height="16"/><line class="chart-median" x1="129.38" x2="129.38" y1="17" y2="31"/></g>
<g class="chart-mark" data-mark data-value="1.2"><title>This hospital: 1.2</title><rect class="chart-hit" x="171" y="31" width="18" height="16"/><path class="chart-this" d="M180 33l6 11h-12z"/></g>
<text class="chart-label" x="180" y="58" text-anchor="middle">This hospital</text></svg>`,
  ramp: `<svg class="chart chart--ramp" viewBox="0 0 360 91" width="100%" focusable="false" style="--vb: 360"><rect class="chart-zone" x="180" y="14" width="162" height="26"/>
<g transform="translate(0 40)"><g class="chart-axis"><line class="chart-axis__line" x1="18" x2="342" y1="0" y2="0"/><line class="chart-axis__tick" x1="18" x2="18" y1="0" y2="4"/><text class="chart-axis__label" x="18" y="14" text-anchor="middle">−1.0</text><line class="chart-axis__tick" x1="99" x2="99" y1="0" y2="4"/><text class="chart-axis__label" x="99" y="14" text-anchor="middle">−0.5</text><line class="chart-axis__tick" x1="180" x2="180" y1="0" y2="4"/><text class="chart-axis__label" x="180" y="14" text-anchor="middle">0.0</text><line class="chart-axis__tick" x1="261" x2="261" y1="0" y2="4"/><text class="chart-axis__label" x="261" y="14" text-anchor="middle">0.5</text><line class="chart-axis__tick" x1="342" x2="342" y1="0" y2="4"/><text class="chart-axis__label" x="342" y="14" text-anchor="middle">1.0</text></g></g>
<g class="chart-mark" data-mark data-value="-0.05 0.05"><title>CMS&#39;s line (−0.05, 0.05)</title><rect class="chart-hit" x="174" y="4" width="12" height="44"/><line class="chart-line" x1="180" x2="180" y1="12" y2="44"/></g>
<text class="chart-label" x="180" y="10" text-anchor="middle">CMS&#39;s line</text>
<g class="chart-mark" data-mark data-value="0.3"><title>This hospital: 0.3</title><rect class="chart-hit" x="219.6" y="55" width="18" height="18"/><path class="chart-this" d="M228.6 59l6 11h-12z"/></g>
<text class="chart-label" x="228.6" y="85" text-anchor="middle">This hospital</text></svg>`,
  histogram: `<svg class="chart chart--histogram" viewBox="0 0 360 200" width="100%" focusable="false" style="--vb: 360"><g transform="translate(36 0)"><g class="chart-axis"><line class="chart-axis__line" x1="0" x2="0" y1="174" y2="30"/><line class="chart-grid" x1="0" x2="312" y1="174" y2="174"/><line class="chart-axis__tick" x1="-4" x2="0" y1="174" y2="174"/><text class="chart-axis__label" x="-7" y="174" dy="0.32em" text-anchor="end">0</text><line class="chart-grid" x1="0" x2="312" y1="126" y2="126"/><line class="chart-axis__tick" x1="-4" x2="0" y1="126" y2="126"/><text class="chart-axis__label" x="-7" y="126" dy="0.32em" text-anchor="end">1</text><line class="chart-grid" x1="0" x2="312" y1="78" y2="78"/><line class="chart-axis__tick" x1="-4" x2="0" y1="78" y2="78"/><text class="chart-axis__label" x="-7" y="78" dy="0.32em" text-anchor="end">2</text><line class="chart-grid" x1="0" x2="312" y1="30" y2="30"/><line class="chart-axis__tick" x1="-4" x2="0" y1="30" y2="30"/><text class="chart-axis__label" x="-7" y="30" dy="0.32em" text-anchor="end">3</text></g></g>
<g class="chart-mark" data-mark data-value="2"><title>−0.95 – −0.45: 2</title><rect class="chart-hit" x="36" y="30" width="78" height="144"/><path class="chart-col" d="M63 174V82A4 4 0 0 1 67 78H83A4 4 0 0 1 87 82V174Z"/></g>
<g class="chart-mark" data-mark data-value="3"><title>−0.45 – 0.05: 3</title><rect class="chart-hit" x="114" y="30" width="78" height="144"/><path class="chart-col" d="M141 174V34A4 4 0 0 1 145 30H161A4 4 0 0 1 165 34V174Z"/></g>
<g class="chart-mark" data-mark data-value="2"><title>0.05 – 0.55: 2</title><rect class="chart-hit" x="192" y="30" width="78" height="144"/><path class="chart-col chart-col--pen" d="M219 174V82A4 4 0 0 1 223 78H239A4 4 0 0 1 243 82V174Z"/></g>
<g class="chart-mark" data-mark data-value="2"><title>0.55 – 1.05: 2</title><rect class="chart-hit" x="270" y="30" width="78" height="144"/><path class="chart-col chart-col--pen" d="M297 174V82A4 4 0 0 1 301 78H317A4 4 0 0 1 321 82V174Z"/></g>
<g transform="translate(0 174)"><g class="chart-axis"><line class="chart-axis__line" x1="36" x2="348" y1="0" y2="0"/><line class="chart-axis__tick" x1="106.2" x2="106.2" y1="0" y2="4"/><text class="chart-axis__label" x="106.2" y="16" text-anchor="middle">−0.5</text><line class="chart-axis__tick" x1="184.2" x2="184.2" y1="0" y2="4"/><text class="chart-axis__label" x="184.2" y="16" text-anchor="middle">0.0</text><line class="chart-axis__tick" x1="262.2" x2="262.2" y1="0" y2="4"/><text class="chart-axis__label" x="262.2" y="16" text-anchor="middle">0.5</text><line class="chart-axis__tick" x1="340.2" x2="340.2" y1="0" y2="4"/><text class="chart-axis__label" x="340.2" y="16" text-anchor="middle">1.0</text></g></g>
<line class="chart-boundary" x1="192" x2="192" y1="18" y2="174"/>
<text class="chart-label" x="192" y="14" text-anchor="middle">CMS&#39;s line</text></svg>`,
  figure: `<figure class="fig" id="figure-1" data-figure>
<figcaption class="fig__cap" id="figure-1-cap"><span class="fig__n">Figure 1.</span> Measure C adds the most.</figcaption>
<svg role="img" aria-label="Three bars." class="chart chart--bars" viewBox="0 0 360 92" width="100%" focusable="false" style="--vb: 360"><defs><pattern id="chart-c1-hatch" class="chart-hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)"><rect width="1.5" height="6" fill="currentColor"/></pattern></defs>
<g class="chart-mark" data-mark data-row="a" data-value="0.25"><title>Measure A: 0.25</title><rect class="chart-hit" x="0" y="4" width="360" height="28"/><text class="chart-label" x="0" y="22" text-anchor="start">Measure A</text><path class="chart-bar" d="M204 10H246A4 4 0 0 1 250 14V22A4 4 0 0 1 246 26H204Z"/><text class="chart-value" x="360" y="22" text-anchor="end">0.25</text></g>
<g class="chart-mark" data-mark data-row="b" data-value="-0.125"><title>Measure B: −0.125</title><rect class="chart-hit" x="0" y="32" width="360" height="28"/><text class="chart-label" x="0" y="50" text-anchor="start">Measure B</text><path class="chart-bar" d="M204 38H185A4 4 0 0 0 181 42V50A4 4 0 0 0 185 54H204Z"/><text class="chart-value" x="360" y="50" text-anchor="end">−0.125</text></g>
<g class="chart-mark" data-mark data-row="c" data-value="0.5"><title>Measure C &lt;&amp;&gt;: 0.5</title><rect class="chart-hit" x="0" y="60" width="360" height="28"/><text class="chart-label" x="0" y="78" text-anchor="start">Measure C &lt;&amp;&gt;</text><path class="chart-bar-na" fill="url(#chart-c1-hatch)" d="M204 66H292A4 4 0 0 1 296 70V78A4 4 0 0 1 292 82H204Z"/><text class="chart-value" x="360" y="78" text-anchor="end">0.5</text></g>
<line class="chart-zero" x1="204" x2="204" y1="0" y2="92"/></svg>
<p class="source fig__source"><span class="fig__claim">Estimate</span> · Synthetic source.</p>
<details class="fig__table"><summary>Show table</summary>
<div class="printout"><div class="printout__scroll"><table class="gb" aria-labelledby="figure-1-cap">
<thead><tr><th scope="col">Measure</th><th scope="col" data-numeric>Part</th></tr></thead>
<tbody><tr><th scope="row">Measure A</th><td class="num" data-value="0.25">0.25</td></tr><tr><th scope="row">Measure B</th><td class="num" data-value="-0.125">−0.125</td></tr><tr><th scope="row">Measure C</th><td class="num" data-value="0.5">0.5</td></tr></tbody>
</table></div></div>
<p class="fig__actions"><button type="button" class="fig__btn" data-figure-csv="figure-1.csv" hidden>Download CSV</button></p>
</details>
</figure>`,
  tileMapEnds: `<svg class="chart chart--tile-map" viewBox="0 0 360 362" width="100%" focusable="false" style="--vb: 360"><defs><pattern id="chart-m1-hatch" class="chart-hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)"><rect width="1.5" height="6" fill="currentColor"/></pattern></defs>
<g class="chart-mark" data-mark data-state="AK" data-value="0"><title>AK: AK label</title><rect class="chart-tile chart-tile-zero" x="0" y="0" width="30.73" height="30.73" rx="2"/><text class="chart-tile__code" x="15.36" y="19.36">AK</text></g>
<g class="chart-mark" data-mark data-state="ME" data-value="0.25"><title>ME: ME label</title><rect class="chart-tile chart-seq-2" x="327.27" y="0" width="30.73" height="30.73" rx="2"/><text class="chart-tile__code" x="342.64" y="19.36">ME</text></g>
<g class="chart-legend"><text class="chart-legend__title" x="0" y="279.82" text-anchor="start">Share</text><rect class="chart-tile chart-seq-1" x="0" y="287.82" width="44" height="10"/><rect class="chart-tile chart-seq-2" x="44" y="287.82" width="44" height="10"/><rect class="chart-tile chart-seq-3" x="88" y="287.82" width="44" height="10"/><rect class="chart-tile chart-seq-4" x="132" y="287.82" width="44" height="10"/><rect class="chart-tile chart-seq-5" x="176" y="287.82" width="44" height="10"/><text class="chart-legend__label" x="44" y="309.82" text-anchor="middle">0.2</text><text class="chart-legend__label" x="88" y="309.82" text-anchor="middle">0.4</text><text class="chart-legend__label" x="132" y="309.82" text-anchor="middle">0.6</text><text class="chart-legend__label" x="176" y="309.82" text-anchor="middle">0.8</text><text class="chart-legend__label" x="0" y="309.82" text-anchor="start">0</text><text class="chart-legend__label" x="226" y="296.82" text-anchor="start">1</text><rect class="chart-tile chart-tile-zero" x="0" y="321.82" width="12" height="12"/><text class="chart-legend__label" x="18" y="331.82" text-anchor="start">None cut</text><rect class="chart-tile-na" fill="url(#chart-m1-hatch)" x="0" y="341.82" width="12" height="12"/><text class="chart-legend__label" x="18" y="351.82" text-anchor="start">Not subject to the reduction</text></g></svg>`,
};

test('each chart part matches its inline snapshot', () => {
  assert.equal(String(axis({ scale: scaleLinear().domain([0, 1]).range([0, 100]), orient: 'bottom', ticks: 2 })), SNAPSHOTS.axis, 'axis');
  assert.equal(String(axis({ scale: scaleLinear().domain([0, 10]).range([50, 0]), orient: 'left', ticks: [0, 10], grid: 80 })), SNAPSHOTS.axisLeft, 'axisLeft');
  assert.equal(String(contribBars(BARS)), SNAPSHOTS.contribBars, 'contribBars');
  assert.equal(String(dotRange(DOT)), SNAPSHOTS.dotRange, 'dotRange');
  assert.equal(String(ramp(RAMP)), SNAPSHOTS.ramp, 'ramp');
  assert.equal(String(histogram(HIST)), SNAPSHOTS.histogram, 'histogram');
  assert.equal(String(figure({ ...FIG, claimLevel: 'estimate' })), SNAPSHOTS.figure, 'figure');
  // The tile map's 52 tiles are alike: its snapshot holds the frame, the first two tiles and the legend.
  const lines = String(tileMap(MAP)).split('\n');
  assert.equal(lines.length, Object.keys(TILES).length + 2);
  assert.equal([...lines.slice(0, 3), lines.at(-1)].join('\n'), SNAPSHOTS.tileMapEnds, 'tileMap');
});

test('figure: a table cell may carry data-* hooks for a script that updates it; a bad name throws', () => {
  const table = { columns: [{ name: 'M' }, { name: 'Part', numeric: true }], rows: [['A', { text: 'same', value: '0.25', data: { part: 'a', same: '' } }], ['B', '0.5'], ['C', '-0.125']] };
  const s = String(figure({ ...FIG, table }));
  assert.ok(s.includes('<td class="num" data-value="0.25" data-part="a" data-same="">same</td>'));
  assert.throws(() => figure({ ...FIG, table: { ...table, rows: [['A', { text: 'x', value: '0.25', data: { 'Bad name': 1 } }], ...table.rows.slice(1)] } }), /data attribute/);
  assert.throws(() => figure({ ...FIG, table: { ...table, rows: [['A', { text: 'x', value: '0.25', data: { value: '1' } }], ...table.rows.slice(1)] } }), /data attribute/);
});
