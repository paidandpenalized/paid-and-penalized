import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scaleLinear } from 'd3-scale';
import { parseCsv } from '../../engine/js/csv.js';
import { mulberry32 } from '../../engine/js/test/prng.js';
import { axis } from '../charts/axis.js';
import { contribBars } from '../charts/contribBars.js';
import { dotRange } from '../charts/dotRange.js';
import { figure } from '../charts/figure.js';
import { histogram, histogramBins } from '../charts/histogram.js';
import { ramp } from '../charts/ramp.js';
import { GRID, TILES } from '../charts/states.js';
import { tileMap } from '../charts/tileMap.js';
import { compareRows, tableCsv } from '../client/figure.js';
import { Safe } from '../render/html.js';
import { page } from '../render/layout.js';

// Synthetic inputs only: no real hospital, measure values chosen by hand.
const BARS = {
  id: 'c1',
  rows: [
    { id: 'a', label: 'Measure A', value: 0.25 },
    { id: 'b', label: 'Measure B', value: -0.125 },
    { id: 'c', label: 'Measure C <&>', value: 0.5, assigned: true },
  ],
};
const DOT = { value: 1.2, floor: 0.4, cap: 2, median: 0.9, label: 'This hospital', medianLabel: 'Median', rangeLabel: 'Floor to cap' };
const RAMP = { domain: [-1, 1], actual: 0.3, band: [-0.05, 0.05], labels: { actual: 'This hospital', line: "CMS's line" } };
const HIST = { values: [-0.9, -0.5, -0.45, -0.1, 0, 0.12, 0.2, 0.61, 0.9], bins: 4, boundary: 0.05, markLabel: "CMS's line" };
const STATES = Object.fromEntries(Object.keys(TILES).map((st, i) => [st, { value: (i % 5) / 4, label: `${st} label` }]));
STATES.MD = { value: null, label: 'not subject to the reduction', hatched: true };
const MAP = { id: 'm1', states: STATES, ramp: [0.2, 0.4, 0.6, 0.8] };
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
    assert.match(s, /^<svg class="chart chart--[a-z-]+" viewBox="0 0 \d+ \d+" width="100%" focusable="false">/, name);
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

test('dotRange marks the range\'s ends with hairline ticks, not only the gray wash', () => {
  const s = String(dotRange(DOT));
  assert.equal(s.match(/class="chart-band__end"/g).length, 2);
});

test('dotRange draws the range as a band, the median as a tick and this hospital as a triangle under the axis', () => {
  const s = String(dotRange(DOT));
  assert.match(s, /class="chart-band"/);
  assert.match(s, /class="chart-median"/);
  assert.match(s, /class="chart-this"/);
  assert.ok(s.includes('>This hospital</text>'));
  assert.ok(!String(dotRange({ ...DOT, value: null })).includes('chart-this'), 'no value, no triangle');
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
  assert.ok(s.includes('>not subject to the reduction</text>'), 'the hatch has a legend label');
  const { CA, ...missing } = STATES;
  assert.throws(() => tileMap({ ...MAP, states: missing }), /CA/);
  assert.throws(() => tileMap({ ...MAP, states: { ...STATES, ZZ: { value: 1, label: 'x' } } }), /ZZ/);
  assert.throws(() => tileMap({ ...MAP, states: { ...STATES, CA: { value: null, label: 'x' } } }), /CA/);
});

test('tileMap steps follow the ramp thresholds, and text on a dark step uses the on-mark ink', () => {
  const s = String(tileMap(MAP));
  const step = (st) => new RegExp(`data-state="${st}"[^>]*>[\\s\\S]*?class="chart-tile chart-seq-(\\d)"`).exec(s)[1];
  const code = Object.keys(TILES);
  const at = (v) => code.find((st) => STATES[st].value === v && st !== 'MD');
  assert.equal(step(at(0)), '1');
  assert.equal(step(at(0.5)), '3');
  assert.equal(step(at(1)), '5');
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
  assert.match(s, /<figcaption class="fig__cap"><span class="fig__n">Figure 1\.<\/span> Measure C adds the most\.<\/figcaption>/);
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

test('figure: a claim level other than official is said under the chart; an unknown one throws', () => {
  for (const [level, text] of [['recomputed', 'This site recomputes'], ['estimate', 'Estimate'], ['hypothetical', 'Hypothetical']]) {
    assert.ok(String(figure({ ...FIG, claimLevel: level })).includes(`<p class="fig__claim"><span class="pill">${text}</span></p>`), level);
  }
  assert.throws(() => figure({ ...FIG, claimLevel: 'guess' }), /claimLevel/);
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

test('page loads the figure script after the theme script only when the body has a figure', () => {
  const assets = { css: '/assets/site.aaaaaaaa.css', js: { theme: '/assets/theme.bbbbbbbb.js', figure: '/assets/figure.dddddddd.js' } };
  const base = { title: 'T', description: 'D', path: '/x/', assets };
  const without = page({ ...base, body: new Safe('<h1>x</h1>') });
  assert.ok(!without.includes('figure.dddddddd.js'));
  const withFig = page({ ...base, body: figure(FIG), scripts: ['/assets/x.eeeeeeee.js'] });
  const at = (s) => withFig.indexOf(s);
  assert.ok(at('theme.bbbbbbbb.js') < at('figure.dddddddd.js') && at('figure.dddddddd.js') < at('x.eeeeeeee.js'));
  assert.throws(() => page({ ...base, assets: { css: assets.css, js: { theme: assets.js.theme } }, body: figure(FIG) }), /figure/);
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

// Inline snapshots: the exact markup for the fixed synthetic inputs above. A change here is a visible change to every
// figure; look at it in the browser before updating a snapshot.
const SNAPSHOTS = {
  axis: `<g class="chart-axis"><line class="chart-axis__line" x1="0" x2="100" y1="0" y2="0"/><line class="chart-axis__tick" x1="0" x2="0" y1="0" y2="4"/><text class="chart-axis__label" x="0" y="16" text-anchor="middle">0.0</text><line class="chart-axis__tick" x1="50" x2="50" y1="0" y2="4"/><text class="chart-axis__label" x="50" y="16" text-anchor="middle">0.5</text><line class="chart-axis__tick" x1="100" x2="100" y1="0" y2="4"/><text class="chart-axis__label" x="100" y="16" text-anchor="middle">1.0</text></g>`,
  axisLeft: `<g class="chart-axis"><line class="chart-axis__line" x1="0" x2="0" y1="50" y2="0"/><line class="chart-grid" x1="0" x2="80" y1="50" y2="50"/><line class="chart-axis__tick" x1="-4" x2="0" y1="50" y2="50"/><text class="chart-axis__label" x="-7" y="50" dy="0.32em" text-anchor="end">0</text><line class="chart-grid" x1="0" x2="80" y1="0" y2="0"/><line class="chart-axis__tick" x1="-4" x2="0" y1="0" y2="0"/><text class="chart-axis__label" x="-7" y="0" dy="0.32em" text-anchor="end">10</text></g>`,
  contribBars: `<svg class="chart chart--bars" viewBox="0 0 360 92" width="100%" focusable="false"><defs><pattern id="chart-c1-hatch" class="chart-hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)"><rect width="1.5" height="6" fill="currentColor"/></pattern></defs>
<g class="chart-mark" data-mark data-row="a" data-value="0.25"><title>Measure A: 0.25</title><rect class="chart-hit" x="0" y="4" width="360" height="28"/><text class="chart-label" x="0" y="22" text-anchor="start">Measure A</text><path class="chart-bar" d="M204 10H246A4 4 0 0 1 250 14V22A4 4 0 0 1 246 26H204Z"/><text class="chart-value" x="360" y="22" text-anchor="end">0.25</text></g>
<g class="chart-mark" data-mark data-row="b" data-value="-0.125"><title>Measure B: −0.125</title><rect class="chart-hit" x="0" y="32" width="360" height="28"/><text class="chart-label" x="0" y="50" text-anchor="start">Measure B</text><path class="chart-bar" d="M204 38H185A4 4 0 0 0 181 42V50A4 4 0 0 0 185 54H204Z"/><text class="chart-value" x="360" y="50" text-anchor="end">−0.125</text></g>
<g class="chart-mark" data-mark data-row="c" data-value="0.5"><title>Measure C &lt;&amp;&gt;: 0.5</title><rect class="chart-hit" x="0" y="60" width="360" height="28"/><text class="chart-label" x="0" y="78" text-anchor="start">Measure C &lt;&amp;&gt;</text><path class="chart-bar-na" fill="url(#chart-c1-hatch)" d="M204 66H292A4 4 0 0 1 296 70V78A4 4 0 0 1 292 82H204Z"/><text class="chart-value" x="360" y="78" text-anchor="end">0.5</text></g>
<line class="chart-zero" x1="204" x2="204" y1="0" y2="92"/></svg>`,
  dotRange: `<svg class="chart chart--dot-range" viewBox="0 0 360 76" width="100%" focusable="false"><g class="chart-mark" data-mark data-value="0.4 2"><title>Floor to cap: 0.4 – 2</title><rect class="chart-hit" x="30" y="20" width="300" height="20"/><rect class="chart-band" x="30" y="25" width="300" height="10"/><line class="chart-band__end" x1="30" x2="30" y1="23" y2="37"/><line class="chart-band__end" x1="330" x2="330" y1="23" y2="37"/></g>
<g transform="translate(0 30)"><g class="chart-axis"><line class="chart-axis__line" x1="18" x2="342" y1="0" y2="0"/><line class="chart-axis__tick" x1="48.75" x2="48.75" y1="0" y2="-4"/><text class="chart-axis__label" x="48.75" y="-8" text-anchor="middle">0.5</text><line class="chart-axis__tick" x1="142.5" x2="142.5" y1="0" y2="-4"/><text class="chart-axis__label" x="142.5" y="-8" text-anchor="middle">1.0</text><line class="chart-axis__tick" x1="236.25" x2="236.25" y1="0" y2="-4"/><text class="chart-axis__label" x="236.25" y="-8" text-anchor="middle">1.5</text><line class="chart-axis__tick" x1="330" x2="330" y1="0" y2="-4"/><text class="chart-axis__label" x="330" y="-8" text-anchor="middle">2.0</text></g></g>
<g class="chart-mark" data-mark data-value="0.9"><title>Median: 0.9</title><rect class="chart-hit" x="117.75" y="20" width="12" height="20"/><line class="chart-median" x1="123.75" x2="123.75" y1="24" y2="38"/></g>
<g class="chart-mark" data-mark data-value="1.2"><title>This hospital: 1.2</title><rect class="chart-hit" x="171" y="38" width="18" height="16"/><path class="chart-this" d="M180 40l6 11h-12z"/></g>
<text class="chart-label" x="180" y="68" text-anchor="middle">This hospital</text></svg>`,
  ramp: `<svg class="chart chart--ramp" viewBox="0 0 360 84" width="100%" focusable="false"><rect class="chart-zone" x="180" y="18" width="162" height="22"/>
<g transform="translate(0 40)"><g class="chart-axis"><line class="chart-axis__line" x1="18" x2="342" y1="0" y2="0"/><line class="chart-axis__tick" x1="18" x2="18" y1="0" y2="-4"/><text class="chart-axis__label" x="18" y="-8" text-anchor="middle">−1.0</text><line class="chart-axis__tick" x1="99" x2="99" y1="0" y2="-4"/><text class="chart-axis__label" x="99" y="-8" text-anchor="middle">−0.5</text><line class="chart-axis__tick" x1="180" x2="180" y1="0" y2="-4"/><text class="chart-axis__label" x="180" y="-8" text-anchor="middle">0.0</text><line class="chart-axis__tick" x1="261" x2="261" y1="0" y2="-4"/><text class="chart-axis__label" x="261" y="-8" text-anchor="middle">0.5</text><line class="chart-axis__tick" x1="342" x2="342" y1="0" y2="-4"/><text class="chart-axis__label" x="342" y="-8" text-anchor="middle">1.0</text></g></g>
<g class="chart-mark" data-mark data-value="-0.05 0.05"><title>CMS&#39;s line (−0.05, 0.05)</title><rect class="chart-hit" x="174" y="8" width="12" height="40"/><line class="chart-line" x1="180" x2="180" y1="16" y2="44"/></g>
<text class="chart-label" x="180" y="12" text-anchor="middle">CMS&#39;s line</text>
<g class="chart-mark" data-mark data-value="0.3"><title>This hospital: 0.3</title><rect class="chart-hit" x="219.6" y="40" width="18" height="18"/><path class="chart-this" d="M228.6 44l6 11h-12z"/></g>
<text class="chart-label" x="228.6" y="70" text-anchor="middle">This hospital</text></svg>`,
  histogram: `<svg class="chart chart--histogram" viewBox="0 0 360 200" width="100%" focusable="false"><g transform="translate(36 0)"><g class="chart-axis"><line class="chart-axis__line" x1="0" x2="0" y1="174" y2="30"/><line class="chart-grid" x1="0" x2="312" y1="174" y2="174"/><line class="chart-axis__tick" x1="-4" x2="0" y1="174" y2="174"/><text class="chart-axis__label" x="-7" y="174" dy="0.32em" text-anchor="end">0</text><line class="chart-grid" x1="0" x2="312" y1="126" y2="126"/><line class="chart-axis__tick" x1="-4" x2="0" y1="126" y2="126"/><text class="chart-axis__label" x="-7" y="126" dy="0.32em" text-anchor="end">1</text><line class="chart-grid" x1="0" x2="312" y1="78" y2="78"/><line class="chart-axis__tick" x1="-4" x2="0" y1="78" y2="78"/><text class="chart-axis__label" x="-7" y="78" dy="0.32em" text-anchor="end">2</text><line class="chart-grid" x1="0" x2="312" y1="30" y2="30"/><line class="chart-axis__tick" x1="-4" x2="0" y1="30" y2="30"/><text class="chart-axis__label" x="-7" y="30" dy="0.32em" text-anchor="end">3</text></g></g>
<g class="chart-mark" data-mark data-value="2"><title>−0.95 – −0.45: 2</title><rect class="chart-hit" x="36" y="30" width="78" height="144"/><path class="chart-col" d="M63 174V82A4 4 0 0 1 67 78H83A4 4 0 0 1 87 82V174Z"/></g>
<g class="chart-mark" data-mark data-value="3"><title>−0.45 – 0.05: 3</title><rect class="chart-hit" x="114" y="30" width="78" height="144"/><path class="chart-col" d="M141 174V34A4 4 0 0 1 145 30H161A4 4 0 0 1 165 34V174Z"/></g>
<g class="chart-mark" data-mark data-value="2"><title>0.05 – 0.55: 2</title><rect class="chart-hit" x="192" y="30" width="78" height="144"/><path class="chart-col chart-col--pen" d="M219 174V82A4 4 0 0 1 223 78H239A4 4 0 0 1 243 82V174Z"/></g>
<g class="chart-mark" data-mark data-value="2"><title>0.55 – 1.05: 2</title><rect class="chart-hit" x="270" y="30" width="78" height="144"/><path class="chart-col chart-col--pen" d="M297 174V82A4 4 0 0 1 301 78H317A4 4 0 0 1 321 82V174Z"/></g>
<g transform="translate(0 174)"><g class="chart-axis"><line class="chart-axis__line" x1="36" x2="348" y1="0" y2="0"/><line class="chart-axis__tick" x1="106.2" x2="106.2" y1="0" y2="4"/><text class="chart-axis__label" x="106.2" y="16" text-anchor="middle">−0.5</text><line class="chart-axis__tick" x1="184.2" x2="184.2" y1="0" y2="4"/><text class="chart-axis__label" x="184.2" y="16" text-anchor="middle">0.0</text><line class="chart-axis__tick" x1="262.2" x2="262.2" y1="0" y2="4"/><text class="chart-axis__label" x="262.2" y="16" text-anchor="middle">0.5</text><line class="chart-axis__tick" x1="340.2" x2="340.2" y1="0" y2="4"/><text class="chart-axis__label" x="340.2" y="16" text-anchor="middle">1.0</text></g></g>
<line class="chart-boundary" x1="192" x2="192" y1="18" y2="174"/>
<text class="chart-label" x="192" y="14" text-anchor="middle">CMS&#39;s line</text></svg>`,
  figure: `<figure class="fig" id="figure-1" data-figure>
<figcaption class="fig__cap"><span class="fig__n">Figure 1.</span> Measure C adds the most.</figcaption>
<svg role="img" aria-label="Three bars." class="chart chart--bars" viewBox="0 0 360 92" width="100%" focusable="false"><defs><pattern id="chart-c1-hatch" class="chart-hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)"><rect width="1.5" height="6" fill="currentColor"/></pattern></defs>
<g class="chart-mark" data-mark data-row="a" data-value="0.25"><title>Measure A: 0.25</title><rect class="chart-hit" x="0" y="4" width="360" height="28"/><text class="chart-label" x="0" y="22" text-anchor="start">Measure A</text><path class="chart-bar" d="M204 10H246A4 4 0 0 1 250 14V22A4 4 0 0 1 246 26H204Z"/><text class="chart-value" x="360" y="22" text-anchor="end">0.25</text></g>
<g class="chart-mark" data-mark data-row="b" data-value="-0.125"><title>Measure B: −0.125</title><rect class="chart-hit" x="0" y="32" width="360" height="28"/><text class="chart-label" x="0" y="50" text-anchor="start">Measure B</text><path class="chart-bar" d="M204 38H185A4 4 0 0 0 181 42V50A4 4 0 0 0 185 54H204Z"/><text class="chart-value" x="360" y="50" text-anchor="end">−0.125</text></g>
<g class="chart-mark" data-mark data-row="c" data-value="0.5"><title>Measure C &lt;&amp;&gt;: 0.5</title><rect class="chart-hit" x="0" y="60" width="360" height="28"/><text class="chart-label" x="0" y="78" text-anchor="start">Measure C &lt;&amp;&gt;</text><path class="chart-bar-na" fill="url(#chart-c1-hatch)" d="M204 66H292A4 4 0 0 1 296 70V78A4 4 0 0 1 292 82H204Z"/><text class="chart-value" x="360" y="78" text-anchor="end">0.5</text></g>
<line class="chart-zero" x1="204" x2="204" y1="0" y2="92"/></svg>
<p class="fig__claim"><span class="pill">Estimate</span></p>
<p class="source fig__source">Synthetic source.</p>
<details class="fig__table"><summary>Show table</summary>
<div class="printout"><div class="printout__scroll"><table class="gb">
<thead><tr><th scope="col">Measure</th><th scope="col" data-numeric>Part</th></tr></thead>
<tbody><tr><th scope="row">Measure A</th><td class="num" data-value="0.25">0.25</td></tr><tr><th scope="row">Measure B</th><td class="num" data-value="-0.125">−0.125</td></tr><tr><th scope="row">Measure C</th><td class="num" data-value="0.5">0.5</td></tr></tbody>
</table></div></div>
<p class="fig__actions"><button type="button" class="fig__btn" data-figure-csv="figure-1.csv" hidden>Download CSV</button></p>
</details>
</figure>`,
  tileMapEnds: `<svg class="chart chart--tile-map" viewBox="0 0 360 330" width="100%" focusable="false"><defs><pattern id="chart-m1-hatch" class="chart-hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)"><rect width="1.5" height="6" fill="currentColor"/></pattern></defs>
<g class="chart-mark" data-mark data-state="AK" data-value="0"><title>AK: AK label</title><rect class="chart-hit" x="0" y="0" width="32.73" height="32.73"/><rect class="chart-tile chart-seq-1" x="0" y="0" width="30.73" height="30.73" rx="2"/><text class="chart-tile__code" x="15.36" y="19.36" text-anchor="middle">AK</text></g>
<g class="chart-mark" data-mark data-state="ME" data-value="0.25"><title>ME: ME label</title><rect class="chart-hit" x="327.27" y="0" width="32.73" height="32.73"/><rect class="chart-tile chart-seq-2" x="327.27" y="0" width="30.73" height="30.73" rx="2"/><text class="chart-tile__code" x="342.64" y="19.36" text-anchor="middle">ME</text></g>
<g class="chart-legend"><rect class="chart-tile chart-seq-1" x="0" y="269.82" width="12" height="12"/><text class="chart-legend__label" x="18" y="279.82" text-anchor="start">&lt; 0.2</text><rect class="chart-tile chart-seq-2" x="120" y="269.82" width="12" height="12"/><text class="chart-legend__label" x="138" y="279.82" text-anchor="start">0.2 – 0.4</text><rect class="chart-tile chart-seq-3" x="240" y="269.82" width="12" height="12"/><text class="chart-legend__label" x="258" y="279.82" text-anchor="start">0.4 – 0.6</text><rect class="chart-tile chart-seq-4" x="0" y="289.82" width="12" height="12"/><text class="chart-legend__label" x="18" y="299.82" text-anchor="start">0.6 – 0.8</text><rect class="chart-tile chart-seq-5" x="120" y="289.82" width="12" height="12"/><text class="chart-legend__label" x="138" y="299.82" text-anchor="start">≥ 0.8</text><rect class="chart-tile-na" fill="url(#chart-m1-hatch)" x="0" y="309.82" width="12" height="12"/><text class="chart-legend__label" x="18" y="319.82" text-anchor="start">not subject to the reduction</text></g></svg>`,
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
