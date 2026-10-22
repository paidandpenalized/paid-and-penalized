// The history's chart kit (web/charts): the proof strips, rule stack, periods chart, roll call, rank-over-years line,
// staircase and chance dots, small multiples, bar rows' label column, mini tile maps, and the year map's projected dots.
// Each one: what it refuses (throws), the marks it draws (counted from the markup), the text it escapes, and that the
// same call gives the same markup with no color value in it. Inputs are invented; no hospital is named.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readPinned } from '../../pipeline/files.js';
import { barRows } from '../charts/barRows.js';
import { dotsD } from '../charts/dots.js';
import { US_MAP_CODES, stateShapes, usPoints, usProjected, usYearMap } from '../charts/geo.js';
import { periodsChart } from '../charts/periods.js';
import { proofBins, proofStrips } from '../charts/proofStrips.js';
import { rankYears } from '../charts/rankYears.js';
import { rollCall } from '../charts/rollCall.js';
import { ruleStack } from '../charts/ruleStack.js';
import { smallLines } from '../charts/smallLines.js';
import { GRID, TILES } from '../charts/states.js';
import { miniTiles } from '../charts/tileMap.js';
import { chanceDots, staircase } from '../charts/yearCharts.js';
import { Safe } from '../render/html.js';

const HEX = /#[0-9a-f]{3,8}\b/i;
const BROKEN = /NaN|Infinity|undefined/;
const count = (s, re) => (s.match(re) ?? []).length;
const viewBox = (s) => /viewBox="0 0 (\d+) (\d+)"/.exec(s).slice(1).map(Number);
// The elements of one class (the whole class attribute), as their opening tags.
const tags = (s, cls) => [...s.matchAll(new RegExp(`<[a-z]+ class="${cls}"[^>]*>`, 'g'))].map((m) => m[0]);
const attr = (tag, name) => new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1];
const num = (tag, name) => Number(attr(tag, name));
// The text of every <text class="cls"> element.
const texts = (s, cls) => [...s.matchAll(new RegExp(`<text class="${cls}"[^>]*>([^<]*)</text>`, 'g'))].map((m) => m[1]);
// What every chart returns: Safe markup in one responsive SVG with no color value and none of JavaScript's non-numbers.
function sound(out, kind) {
  assert.ok(out instanceof Safe, kind);
  const s = String(out);
  assert.match(s, new RegExp(`^<svg class="chart chart--${kind}" viewBox="0 0 \\d+ \\d+" width="100%" focusable="false" style="--vb: \\d+">`), kind);
  assert.doesNotMatch(s, HEX, kind);
  assert.doesNotMatch(s, BROKEN, kind);
  return s;
}
// Every mark carries its tooltip, and a mark's plotted values are in its data-value.
const marks = (s) => [...s.matchAll(/<g class="chart-mark"([^>]*)><title>([^<]*)<\/title>/g)].map((m) => ({ attrs: m[1], tip: m[2] }));

// ---------- the proof strips ----------

test('proofBins: counts in bins centered on zero, a difference past the ends in the end bin', () => {
  const { half, counts } = proofBins([0, 0.00004, 0.00006, -0.00006, 0.5, -0.5, 0.001], { limit: 0.001, step: 0.0001 });
  assert.equal(half, 10);
  assert.equal(counts.length, 21);
  assert.equal(counts[10], 2, 'zero, and 0.4 of a step, share the middle bin');
  assert.equal(counts[11], 1, '0.6 of a step rounds up');
  assert.equal(counts[9], 1);
  assert.equal(counts[20], 2, 'a diff at the limit and one far past it end in the last bin');
  assert.equal(counts[0], 1, 'a diff far below the limit is counted in the first bin');
  assert.equal(counts.reduce((s, c) => s + c, 0), 7, 'nothing is dropped');
  assert.deepEqual(proofBins([], { limit: 0.001, step: 0.0001 }).counts, new Array(21).fill(0));
});

const PROOF = (over = {}) => ({
  rows: [
    { label: 'FY2026', note: '3,000 scores', diffs: [...new Array(1000).fill(0), 0.00003] },
    { label: 'FY2025', note: '1 score', diffs: [0.0002] },
    { label: 'FY2023', note: 'none', diffs: [] },
  ],
  limit: 0.001, step: 0.0001, labels: { fail: 'Fails the build' }, width: 640, format: (v) => `t${v}`, ...over,
});

test('proofStrips refuses no rows, and a limit or step that is not positive or a step past the limit', () => {
  assert.throws(() => proofStrips(PROOF({ rows: [] })), /proofStrips/);
  assert.throws(() => proofStrips(PROOF({ limit: 0 })), /0 < step <= limit/);
  assert.throws(() => proofStrips(PROOF({ limit: -1 })), /proofStrips/);
  assert.throws(() => proofStrips(PROOF({ limit: undefined })), /proofStrips/);
  assert.throws(() => proofStrips(PROOF({ step: 0 })), /proofStrips/);
  assert.throws(() => proofStrips(PROOF({ step: NaN })), /proofStrips/);
  assert.throws(() => proofStrips(PROOF({ step: 0.002 })), /proofStrips/);
  assert.doesNotThrow(() => proofStrips(PROOF({ step: 0.001 })), 'a step equal to the limit is allowed');
});

test('proofStrips: a strip, two hatched zones and one silhouette a row, five ticks and the failure label at both ends', () => {
  const out = PROOF();
  const s = sound(proofStrips(out), 'proof');
  assert.equal(count(s, /<g class="chart-proof__row">/g), 3);
  assert.equal(tags(s, 'chart-proof__ruler').length, 3);
  assert.equal(tags(s, 'chart-proof__fail').length, 6, 'a zone past each end of each ruler');
  assert.equal(tags(s, 'chart-proof__spike').length, 3);
  assert.deepEqual(viewBox(s), [640, 22 + 3 * 46 + 24]);
  assert.deepEqual(texts(s, 'chart-tick'), ['t-0.001', 't-0.0005', 't0', 't0.0005', 't0.001']);
  assert.deepEqual(texts(s, 'chart-proof__label'), ['FY2026', 'FY2025', 'FY2023']);
  assert.ok(s.includes('>← Fails the build</text>') && s.includes('>Fails the build →</text>'));
  // A bin with a count is one stepped outline; a row with no differences draws none.
  const spikes = tags(s, 'chart-proof__spike').map((t) => attr(t, 'd'));
  assert.equal(count(spikes[0], /M/g), 1, 'zero and 0.3 of a step share one bin');
  assert.equal(spikes[1].match(/M/g).length, 1);
  assert.equal(spikes[2], '');
  // The tallest bin is the spike's full height; a lone difference beside it keeps a visible sliver.
  const rise = (d, base) => base - Number(/V([\d.]+)h/.exec(d)[1]);
  assert.equal(rise(spikes[0], 22 + 46 - 6), 26);
  assert.equal(rise(spikes[1], 22 + 2 * 46 - 6), 1.5);
  assert.equal(String(proofStrips(out)), s, 'the same call gives the same markup');
});

test('proofStrips: the silhouette is where the differences are, and a difference far past the limit stands in the end bin', () => {
  const draw = (diffs) => String(proofStrips({ ...PROOF(), rows: [{ label: 'x', note: 'y', diffs }] }));
  assert.equal(draw([0.01]), draw([0.001]), 'past the limit is the end bin');
  assert.equal(draw([-0.01]), draw([-0.001]));
  assert.notEqual(draw([0.001]), draw([-0.001]));
  assert.notEqual(draw([0]), draw([0.0002]));
  const s = draw([0]);
  // The zero bin stands on the middle of the ruler: the zero line's x.
  const mid = num(tags(s, 'chart-proof__zero')[0], 'x1');
  const d = attr(tags(s, 'chart-proof__spike')[0], 'd');
  const [, left, w] = /^M([\d.]+) [\d.]+V[\d.]+h([\d.]+)/.exec(d).map(Number);
  assert.ok(Math.abs(left + w / 2 - mid) < 0.02, `${left + w / 2} vs ${mid}`);
});

test('proofStrips escapes a row label and its note', () => {
  const s = String(proofStrips({ ...PROOF(), rows: [{ label: 'A <b> & "c"', note: '<i>n</i>', diffs: [0] }] }));
  assert.ok(s.includes('A &lt;b&gt; &amp; &quot;c&quot;') && s.includes('&lt;i&gt;n&lt;/i&gt;'));
  assert.ok(!s.includes('<b>') && !s.includes('<i>'));
});

// ---------- the rule stack ----------

const SCORES = [-1, -0.5, 0, 0.25, 0.5, 1.5];
const STACK_ROW = (over = {}) => ({ label: 'FY2026', note: '2 of 6 cut', scores: SCORES, yes: [false, false, false, false, true, true], line: 2, ...over });

test('ruleStack refuses no rows', () => {
  assert.throws(() => ruleStack({ rows: [], width: 300 }), /ruleStack: no rows/);
});

test('ruleStack: a row a year, the not-cut hairlines in one ink and the cut ones in the other, the line a short rule through the row', () => {
  const s = sound(ruleStack({ rows: [STACK_ROW(), STACK_ROW({ label: 'FY2025', line: null })], width: 300 }), 'rules');
  assert.equal(count(s, /<g class="chart-rules__row">/g), 2);
  assert.equal(tags(s, 'chart-rule__ink').length, 2);
  assert.equal(tags(s, 'chart-rule__pen').length, 2);
  assert.equal(tags(s, 'chart-rule__bar').length, 2);
  assert.deepEqual(viewBox(s), [300, 4 + 2 * 78]);
  // The line sits before the last `line` scores: 2 of 6, a third of the way in from the right.
  const lines = tags(s, 'chart-rule__line');
  assert.equal(lines.length, 1, 'a year with no line draws none');
  assert.equal(num(lines[0], 'x1'), 200);
  assert.equal(num(lines[0], 'x2'), 200);
  assert.deepEqual(texts(s, 'chart-proof__label'), ['FY2026', 'FY2025']);
  assert.deepEqual(texts(s, 'chart-cap'), ['2 of 6 cut', '2 of 6 cut']);
});

test('ruleStack: decisions out of order with the scores show as extra runs of the other ink', () => {
  const runs = (yes, ink) => {
    const s = String(ruleStack({ rows: [STACK_ROW({ yes, scores: [0, 1, 2, 3, 4, 5] })], width: 300 }));
    const d = tags(s, ink).map((t) => attr(t, 'd'))[0];
    return d ? count(d, /Z/g) : 0;
  };
  assert.equal(runs([false, false, false, true, true, true], 'chart-rule__ink'), 1);
  assert.equal(runs([false, false, false, true, true, true], 'chart-rule__pen'), 1);
  assert.equal(runs([false, true, false, true, true, true], 'chart-rule__ink'), 2, 'a hospital not cut among the cut');
  assert.equal(runs([false, true, false, true, true, true], 'chart-rule__pen'), 2);
  assert.equal(runs([false, false, false, false, false, false], 'chart-rule__pen'), 0, 'no cut, no pen path');
  assert.equal(runs([true, true, true, true, true, true], 'chart-rule__ink'), 0, 'all cut, no ink path');
});

test('ruleStack: each row has its own height, so a year on another scale still spans the row; an empty or all-zero year draws nothing broken', () => {
  const s = sound(ruleStack({
    rows: [
      STACK_ROW({ scores: [0, 25, 50, 75, 100, 200], yes: new Array(6).fill(false), line: null }),
      STACK_ROW({ scores: [0, 0.1, 0.2, 0.3, 0.4, 0.5], yes: new Array(6).fill(false), line: null }),
    ],
    width: 300,
  }), 'rules');
  const tops = tags(s, 'chart-rule__ink').map((t) => Math.min(...[...attr(t, 'd').matchAll(/L[\d.-]+ ([\d.-]+)/g)].map((m) => Number(m[1]))));
  assert.deepEqual(tops, [4 + 16, 4 + 78 + 16], 'the highest score reaches the top of its own row');
  // A year CMS scored no one: no scores, no line.
  const none = sound(ruleStack({ rows: [{ label: 'FY2023', note: 'none', scores: [], yes: [], line: null }], width: 300 }), 'rules');
  assert.equal(tags(none, 'chart-rule__ink').length + tags(none, 'chart-rule__pen').length, 0);
  assert.equal(tags(none, 'chart-rule__bar').length, 1, 'the baseline is still there');
  // All scores zero: no scale to find, the shape lies on the baseline.
  const flat = sound(ruleStack({ rows: [STACK_ROW({ scores: [0, 0, 0, 0, 0, 0], yes: new Array(6).fill(false), line: null })], width: 300 }), 'rules');
  assert.equal(tags(flat, 'chart-rule__ink').length, 1);
  // All-negative scores hang below the baseline.
  const below = sound(ruleStack({ rows: [STACK_ROW({ scores: [-3, -2, -1], yes: [false, false, false], line: null })], width: 300 }), 'rules');
  assert.ok(Math.min(...[...attr(tags(below, 'chart-rule__ink')[0], 'd').matchAll(/L[\d.-]+ ([\d.-]+)/g)].map((m) => Number(m[1]))) >= 4 + 16 + 40, 'at or below the baseline');
});

test('ruleStack escapes a row label and its note', () => {
  const s = String(ruleStack({ rows: [STACK_ROW({ label: '<x>', note: 'a & b' })], width: 300 }));
  assert.ok(s.includes('&lt;x&gt;') && s.includes('a &amp; b'));
  assert.ok(!s.includes('<x>'));
});

// ---------- the periods chart ----------

const SPAN = (kind, start, end, tip = `${kind} tip`) => ({ kind, start, end, tip });
const PERIODS = (over = {}) => ({
  rows: [
    { label: 'FY2025', spans: [SPAN('psi', [2022, 7, 1], [2024, 6, 30]), SPAN('hai', [2023, 1, 1], [2024, 12, 31]), SPAN('pay', [2024, 10, 1], [2025, 9, 30])] },
    { label: 'FY2024', spans: [SPAN('hai', [2022, 1, 1], [2023, 12, 31]), SPAN('pay', [2023, 10, 1], [2024, 9, 30])] },
  ],
  kinds: ['psi', 'hai', 'pay'], width: 640, ...over,
});

test('periodsChart refuses no rows and no kinds', () => {
  assert.throws(() => periodsChart(PERIODS({ rows: [] })), /periodsChart: rows and kinds/);
  assert.throws(() => periodsChart(PERIODS({ kinds: [] })), /periodsChart: rows and kinds/);
});

test('periodsChart: a bar for every span, each a mark with its tooltip, on one calendar axis of whole years', () => {
  const s = sound(periodsChart(PERIODS()), 'periods');
  assert.equal(marks(s).length, 5);
  assert.equal(tags(s, 'chart-periods__psi').length, 1);
  assert.equal(tags(s, 'chart-periods__hai').length, 2);
  assert.equal(tags(s, 'chart-periods__pay').length, 2);
  assert.deepEqual(marks(s).map((m) => m.tip), ['psi tip', 'hai tip', 'pay tip', 'hai tip', 'pay tip']);
  assert.deepEqual(viewBox(s), [640, 8 + 2 * 22 + 22]);
  // The axis runs from January 1 of the first year to January 1 after the last, a gridline at each; each year is labelled.
  assert.equal(tags(s, 'chart-grid').length, 5, '2022 to 2026');
  assert.deepEqual(texts(s, 'chart-tick'), ['2022', '2023', '2024', '2025']);
  assert.deepEqual(texts(s, 'chart-proof__label'), ['FY2025', 'FY2024']);
  // A later span sits to the right of an earlier one; a longer one is wider.
  const bar = (cls, i = 0) => tags(s, cls)[i];
  assert.ok(num(bar('chart-periods__pay'), 'x') > num(bar('chart-periods__psi'), 'x'));
  assert.ok(num(bar('chart-periods__pay', 1), 'x') < num(bar('chart-periods__pay', 0), 'x'), 'the older year first on the axis');
  assert.ok(num(bar('chart-periods__psi'), 'width') > num(bar('chart-periods__pay'), 'width'));
  // Each kind has its own lane within the row: the kinds' order from the top.
  const y = (cls) => num(bar(cls), 'y');
  assert.ok(y('chart-periods__psi') < y('chart-periods__hai') && y('chart-periods__hai') < y('chart-periods__pay'));
  assert.equal(String(periodsChart(PERIODS())), s, 'the same call gives the same markup');
});

test('periodsChart: a span is its first day through its last, so a whole calendar year fills its year of the axis', () => {
  const s = String(periodsChart({ rows: [{ label: 'x', spans: [SPAN('hai', [2024, 1, 1], [2024, 12, 31])] }], kinds: ['hai'], width: 300 }));
  const bar = tags(s, 'chart-periods__hai')[0];
  assert.equal(num(bar, 'x'), 58, 'the label column, then the year starts');
  assert.equal(num(bar, 'width'), 300 - 58);
});

test('periodsChart: a phone width labels every other year with two digits; the tooltips are escaped', () => {
  const narrow = String(periodsChart(PERIODS({ width: 300 })));
  assert.deepEqual(texts(narrow, 'chart-tick'), ['22', '24']);
  const hostile = String(periodsChart(PERIODS({ rows: [{ label: '<FY>', spans: [SPAN('psi', [2024, 1, 1], [2024, 12, 31], 'from <a> & "b"')] }], kinds: ['psi'] })));
  assert.ok(hostile.includes('from &lt;a&gt; &amp; &quot;b&quot;') && hostile.includes('&lt;FY&gt;'));
});

// ---------- the roll call ----------

const YEARS = ['2024', '2025', '2026'];

test('rollCall refuses no hospitals, no years, and a record whose length is not the number of years', () => {
  assert.throws(() => rollCall({ records: [], years: YEARS, width: 300 }), /rollCall: one record per hospital/);
  assert.throws(() => rollCall({ records: ['YNN'], years: [], width: 300 }), /rollCall/);
  assert.throws(() => rollCall({ records: ['YNN', 'YN'], years: YEARS, width: 300 }), /one character per year/);
  assert.throws(() => rollCall({ records: ['YNNN'], years: YEARS, width: 300 }), /rollCall/);
});

// One path's cells: the M moves in it.
const cells = (s, cls) => count(attr(tags(s, cls)[0], 'd'), /M/g);

test('rollCall: a cell for every hospital with a decision, in the ink of its decision, none where there is none', () => {
  const s = sound(rollCall({ records: ['YN.', 'YNN', 'NY.'], years: YEARS, width: 300 }), 'roll');
  // Row 2024: Y Y N; row 2025: N N Y; row 2026: . N .
  assert.equal(cells(s, 'chart-roll__yes'), 3);
  assert.equal(cells(s, 'chart-roll__no'), 4);
  assert.deepEqual(texts(s, 'chart-roll__year'), YEARS);
  assert.deepEqual(viewBox(s), [300, 4 + 3 * 16 + 6], 'no brackets, no room for them');
  assert.equal(String(rollCall({ records: ['YN.', 'YNN', 'NY.'], years: YEARS, width: 300 })), s, 'the same call gives the same markup');
});

test('rollCall: narrow columns merge into runs, one move for each run of the same decision in a row', () => {
  const records = [...new Array(50).fill('YY'), ...new Array(50).fill('YN'), ...new Array(100).fill('N.')];
  const s = sound(rollCall({ records, years: ['2025', '2026'], width: 300 }), 'roll');
  // 2025: 100 cut then 100 not; 2026: 50 cut, 50 not, 100 with none.
  assert.equal(cells(s, 'chart-roll__yes'), 2);
  assert.equal(cells(s, 'chart-roll__no'), 2);
  // The same hospitals in a wide drawing are one cell each.
  const wide = String(rollCall({ records, years: ['2025', '2026'], width: 1180, label: 40 }));
  assert.equal(cells(wide, 'chart-roll__yes'), 100 + 50, '100 cut in 2025, 50 in 2026');
  assert.equal(cells(wide, 'chart-roll__no'), 100 + 50, '100 not cut in 2025, 50 in 2026; the 100 with no decision in 2026 are not drawn');
});

test('rollCall: brackets under the grid, the right margin kept clear, a tick for each highlighted hospital', () => {
  const records = ['YN.', 'YNN', 'NY.', 'NNN'];
  const plain = String(rollCall({ records, years: YEARS, width: 300 }));
  const s = sound(rollCall({
    records, years: YEARS, width: 300, label: 40, right: 70,
    brackets: [{ from: 0, to: 2, label: 'Ever cut: 2', pen: true }, { from: 2, to: 4, label: 'Never cut: 2' }],
    highlight: [1, 3], notes: ['12% · 10%', '', '33% · 30%'],
  }), 'roll');
  assert.equal(count(s, /<path class="chart-roll__bracket( chart-roll__bracket--pen)?"/g), 2);
  assert.equal(tags(s, 'chart-roll__bracket chart-roll__bracket--pen').length, 1);
  assert.ok(s.includes('>Ever cut: 2</text>') && s.includes('>Never cut: 2</text>'));
  assert.equal(count(attr(tags(s, 'chart-roll__hl')[0], 'd'), /M/g), 2);
  assert.doesNotMatch(plain, /chart-roll__hl|chart-roll__bracket/);
  assert.deepEqual(texts(s, 'chart-roll__note'), ['12% · 10%', '', '33% · 30%']);
  assert.ok(viewBox(s)[1] > viewBox(plain)[1], 'a drawing with brackets is taller');
  // No cell reaches into the right margin (each H is a cell's right edge).
  const right = Math.max(...[...attr(tags(s, 'chart-roll__no')[0], 'd').matchAll(/H([\d.]+)/g)].map((m) => Number(m[1])));
  assert.ok(right <= 300 - 70, `${right}`);
});

test('rollCall: a year in which no hospital had a decision says so, only when asked', () => {
  const records = ['Y.N', 'N.N'];
  const s = String(rollCall({ records, years: YEARS, width: 300, blank: 'No cut this year' }));
  assert.equal(texts(s, 'chart-roll__blank').length, 1);
  assert.deepEqual(texts(s, 'chart-roll__blank'), ['No cut this year']);
  assert.doesNotMatch(String(rollCall({ records, years: YEARS, width: 300 })), /chart-roll__blank/);
  assert.equal(texts(String(rollCall({ records: ['YNN'], years: YEARS, width: 300, blank: 'x' })), 'chart-roll__blank').length, 0, 'every year had a decision');
});

test('rollCall escapes year labels, bracket labels and notes', () => {
  const s = String(rollCall({ records: ['YN'], years: ['<a>', 'b&c'], width: 300, brackets: [{ from: 0, to: 1, label: '"q" <z>' }], notes: ['<n>', ''] }));
  for (const bad of ['<a>', '<z>', '<n>']) assert.ok(!s.includes(bad), bad);
  for (const good of ['&lt;a&gt;', 'b&amp;c', '&quot;q&quot; &lt;z&gt;', '&lt;n&gt;']) assert.ok(s.includes(good), good);
});

// ---------- the line through the years ----------

const rankYear = (label, share, over = {}) => ({ label, share, cut: false, line: share === null ? null : 0.75, tip: `${label} tip`, value: share, ...over });
const RANK_LABELS = { top: 'Highest', mid: 'Middle', bottom: 'Lowest', none: 'No scores' };

test('rankYears: a dot for each year with a score, in the cut ink when cut; a year without a score breaks the line', () => {
  const years = [rankYear('15', 0.1), rankYear('16', 0.5, { cut: true }), rankYear('17', null), rankYear('18', 1), rankYear('19', 0)];
  const s = sound(rankYears({ years, labels: RANK_LABELS, width: 640 }), 'rank');
  assert.equal(marks(s).length, 4);
  assert.equal(tags(s, 'chart-rank__dot').length, 3);
  assert.equal(tags(s, 'chart-rank__dot chart-rank__dot--cut').length, 1);
  assert.deepEqual(marks(s).map((m) => m.tip), ['15 tip', '16 tip', '18 tip', '19 tip']);
  assert.deepEqual(marks(s).map((m) => /data-value="([^"]*)"/.exec(m.attrs)[1]), ['0.1', '0.5', '1', '0']);
  const d = attr(tags(s, 'chart-rank__path')[0], 'd');
  assert.equal(count(d, /M/g), 2, 'two runs: 15-16 and 18-19');
  assert.equal(count(d, /L/g), 2);
  // The top of the scale is the highest share, the bottom the lowest.
  const dots = [...s.matchAll(/<circle class="chart-rank__dot[^"]*" cx="[\d.]+" cy="([\d.]+)" r="(\d+)"/g)].map((m) => [Number(m[1]), Number(m[2])]);
  assert.deepEqual(dots.map(([y]) => y), [22 + 150 * 0.9, 22 + 150 * 0.5, 22, 172]);
  assert.ok(dots.every(([, r]) => r === 5));
  assert.deepEqual(texts(s, 'chart-tick').slice(0, 3), ['Highest', 'Middle', 'Lowest']);
  assert.deepEqual(texts(s, 'chart-tick').slice(3), ['15', '16', '17', '18', '19']);
  assert.deepEqual(viewBox(s), [640, 22 + 150 + 26]);
  assert.equal(String(rankYears({ years, labels: RANK_LABELS, width: 640 })), s, 'the same call gives the same markup');
});

test('rankYears: each year with a cut line is shaded from the line up; a year with no scores at all says so, once', () => {
  const years = [rankYear('15', 0.2), rankYear('16', null), rankYear('17', 0.9, { line: null })];
  const s = sound(rankYears({ years, labels: RANK_LABELS, width: 300 }), 'rank');
  assert.equal(tags(s, 'chart-rank__zone').length, 1, 'the year with no cut has no zone');
  const zone = tags(s, 'chart-rank__zone')[0];
  assert.equal(num(zone, 'y'), 22);
  assert.equal(num(zone, 'height'), 150 * (1 - 0.75));
  assert.equal(count(s, /rotate\(-90\)/g), 1);
  assert.ok(s.includes('>No scores</text>'));
  assert.doesNotMatch(String(rankYears({ years, labels: { ...RANK_LABELS, none: '' }, width: 300 })), /rotate\(-90\)/, 'no word, no label');
  assert.ok(Number(/r="(\d+)"/.exec(tags(s, 'chart-rank__dot')[0])[1]) === 4, 'smaller dots on a phone');
});

test('rankYears: rule changes are dashed lines with their labels; a phone with many years labels every other one', () => {
  const years = Array.from({ length: 10 }, (_, i) => rankYear(String(15 + i), (i % 5) / 4));
  const narrow = String(rankYears({ years, breaks: [{ at: 3, label: 'z-scores' }, { at: 5, label: 'equal' }], labels: RANK_LABELS, width: 300 }));
  assert.equal(tags(narrow, 'chart-rank__break').length, 2);
  assert.ok(narrow.includes('>z-scores</text>') && narrow.includes('>equal</text>'));
  assert.deepEqual(texts(narrow, 'chart-tick').slice(3), ['16', '18', '20', '22', '24'], 'the newest year is always labelled');
  const wide = String(rankYears({ years, labels: RANK_LABELS, width: 640 }));
  assert.equal(texts(wide, 'chart-tick').length, 3 + 10);
  assert.equal(tags(wide, 'chart-rank__break').length, 0);
});

test('rankYears escapes tooltips and labels', () => {
  const s = String(rankYears({ years: [rankYear('<y>', 0.5, { tip: 'a & <b>' })], labels: { ...RANK_LABELS, top: '<top>' }, width: 300 }));
  for (const bad of ['<y>', '<b>', '<top>']) assert.ok(!s.includes(bad), bad);
  assert.ok(s.includes('a &amp; &lt;b&gt;'));
});

// ---------- the staircase and the chance dots ----------

const COLS = [
  { label: '15', cut: 700, ever: 700, tip: 'FY2015: 700 · 700' },
  { label: '16', cut: 500, ever: 900, tip: 'FY2016: 500 · 900' },
  { label: '17', cut: 0, ever: 900, tip: 'FY2017: 0 · 900' },
  { label: '18', cut: 400, ever: 1100, tip: 'FY2018: 400 · 1,100' },
];

test('staircase: a pale column of everyone cut by the year and a red one in front of it, a mark for each year with both numbers', () => {
  const s = sound(staircase({ cols: COLS, width: 640, format: (v) => `n${v}` }), 'stair');
  assert.equal(marks(s).length, 4);
  assert.deepEqual(marks(s).map((m) => /data-value="([^"]*)"/.exec(m.attrs)[1]), ['700 700', '500 900', '0 900', '400 1100']);
  assert.deepEqual(marks(s).map((m) => m.tip), COLS.map((c) => c.tip));
  assert.equal(tags(s, 'chart-stair__ever').length, 4);
  assert.equal(tags(s, 'chart-col--pen').length, 4);
  assert.deepEqual(texts(s, 'chart-value chart-value--mark'), ['n700', 'n900', 'n900', 'n1100']);
  assert.deepEqual(texts(s, 'chart-tick'), ['15', '16', '17', '18']);
  assert.deepEqual(viewBox(s), [640, 26 + 200 + 24]);
  // A year that cut no one has no red column; the pale one is as tall as the year before's.
  const d = (cls, i) => attr(tags(s, cls)[i], 'd');
  assert.equal(d('chart-col--pen', 2), '');
  assert.notEqual(d('chart-col--pen', 1), '');
  const top = (p) => Number(/^M[\d.]+ [\d.]+V([\d.]+)/.exec(p)[1]);
  assert.ok(top(d('chart-stair__ever', 3)) < top(d('chart-stair__ever', 1)) && top(d('chart-stair__ever', 1)) === top(d('chart-stair__ever', 2)));
  assert.equal(String(staircase({ cols: COLS, width: 640, format: (v) => `n${v}` })), s, 'the same call gives the same markup');
});

test('staircase: on a phone every other number and year is left off, ending on the newest', () => {
  const s = String(staircase({ cols: COLS, width: 300, format: String }));
  assert.deepEqual(texts(s, 'chart-value chart-value--mark'), ['700', '', '900', '']);
  assert.deepEqual(texts(s, 'chart-tick'), ['', '16', '', '18']);
});

const KS = [
  { k: 0, observed: 900, chance: 600.5, tip: 'cut 0 times' },
  { k: 1, observed: 100, chance: 300, tip: 'cut once' },
  { k: 2, observed: 50, chance: 50, tip: 'cut twice' },
  { k: 3, observed: 10, chance: 0.4, tip: 'cut three times' },
];

test('chanceDots: a dot for what happened and a ring for what chance gives, joined by a stem, a mark for each count', () => {
  const s = sound(chanceDots({ ks: KS, labels: { x: 'Times cut' }, width: 640, format: (v) => `v${v}` }), 'chance');
  assert.equal(marks(s).length, 4);
  assert.deepEqual(marks(s).map((m) => /data-value="([^"]*)"/.exec(m.attrs)[1]), ['900 600.5', '100 300', '50 50', '10 0.4']);
  assert.equal(tags(s, 'chart-chance__dot').length, 4);
  assert.equal(tags(s, 'chart-chance__ring').length, 4);
  assert.equal(tags(s, 'chart-chance__stem').length + tags(s, 'chart-chance__stem chart-chance__stem--up').length, 4);
  assert.equal(tags(s, 'chart-chance__stem chart-chance__stem--up').length, 2, 'more than chance: k = 0 and k = 3');
  const dot = (i) => num(tags(s, 'chart-chance__dot')[i], 'cy');
  const ring = (i) => num(tags(s, 'chart-chance__ring')[i], 'cy');
  assert.ok(dot(0) < ring(0) && dot(1) > ring(1) && dot(2) === ring(2) && dot(3) < ring(3), 'higher on the page is more');
  assert.deepEqual(texts(s, 'chart-tick').filter((t) => /^\d$/.test(t)), ['0', '1', '2', '3']);
  assert.ok(texts(s, 'chart-axis__label').length > 1 && texts(s, 'chart-axis__label').every((t) => /^v\d+$/.test(t)), 'the axis prints its values with the caller\'s format');
  assert.equal(tags(s, 'chart-grid').length, texts(s, 'chart-axis__label').length, 'a gridline at each');
  assert.ok(s.includes('>Times cut</text>'));
  assert.equal(num(tags(s, 'chart-chance__dot')[0], 'r'), 5);
  assert.equal(num(tags(String(chanceDots({ ks: KS, labels: { x: 'x' }, width: 300, format: String })), 'chart-chance__dot')[0], 'r'), 3.5, 'smaller dots on a phone');
  assert.deepEqual(viewBox(s), [640, 14 + 200 + 40]);
  assert.equal(String(chanceDots({ ks: KS, labels: { x: 'Times cut' }, width: 640, format: (v) => `v${v}` })), s, 'the same call gives the same markup');
});

test('chanceDots escapes the axis name and tooltips', () => {
  const s = String(chanceDots({ ks: [{ k: 0, observed: 2, chance: 1, tip: '<t> & u' }], labels: { x: '<x>' }, width: 300, format: String }));
  assert.ok(s.includes('&lt;t&gt; &amp; u') && s.includes('&lt;x&gt;'));
  assert.ok(!s.includes('<x>') && !s.includes('<t>'));
});

// ---------- small multiples ----------

const pts = (ys, xs = [2020, 2021, 2022, 2023, 2024]) => ys.map((y, i) => ({ x: xs[i], y, tip: y === null ? '' : `${xs[i]}: ${y}` }));
const LINES = (over = {}) => ({
  panels: [
    { label: 'Measure A', points: pts([1.2, 1, null, 0.8, 0.6]), change: '−50%', pen: true },
    { label: 'Measure B', points: pts([0.5, 0.6, 0.7, 0.8, 0.9]), change: '+80%', under: pts([0.4, 0.4, 0.5, 0.5, 0.6]), underLabel: 'Nation' },
    { label: 'Measure C <&>', points: pts([null, null, null, null, null]), change: '' },
  ],
  xs: [2020, 2021, 2022, 2023, 2024], yMax: 1.5, ref: 1, labels: { ref: 'As predicted', x: (v) => `’${String(v).slice(-2)}` }, width: 640, format: (v) => `f${v}`, ...over,
});

test('smallLines: a panel each, a dot for each year with a value, a gap in the line where there is none', () => {
  const s = sound(smallLines(LINES()), 'lines');
  assert.equal(tags(s, 'chart-lines__line chart-lines__line--pen').length, 1);
  assert.equal(tags(s, 'chart-lines__line').length, 2);
  assert.equal(marks(s).length, 4 + 5 + 0, 'one mark per value, none for a panel with none');
  assert.equal(tags(s, 'chart-lines__dot chart-lines__dot--pen').length, 4);
  const lines = [...s.matchAll(/<path class="chart-lines__line(?: chart-lines__line--pen)?" d="([^"]*)"/g)].map((m) => m[1]);
  assert.deepEqual(lines.map((d) => count(d, /M/g)), [2, 1, 0], 'the missing year breaks the first line in two; the empty panel has no line');
  assert.deepEqual(texts(s, 'chart-label'), ['Measure A', 'Measure B', 'Measure C &lt;&amp;&gt;']);
  assert.deepEqual(texts(s, 'chart-value chart-value--mark(?: chart-label--pen)?'), ['−50%', '+80%'], 'an empty change prints nothing');
  assert.equal(tags(s, 'chart-lines__under').length, 1);
  assert.ok(s.includes('>Nation</text>'));
  assert.deepEqual(viewBox(s), [640, 18 + 120 + 30], 'three panels across a wide drawing: one row');
  assert.equal(String(smallLines(LINES())), s, 'the same call gives the same markup');
});

test('smallLines: the reference line crosses every panel and is named once; without one the top of the scale is printed', () => {
  const s = String(smallLines(LINES()));
  assert.equal(tags(s, 'chart-ref').length, 3);
  assert.equal(texts(s, 'chart-cap').filter((t) => t === 'As predicted').length, 1);
  const none = String(smallLines(LINES({ ref: null })));
  assert.equal(tags(none, 'chart-ref').length, 0);
  assert.equal(texts(none, 'chart-tick').filter((t) => t === 'f1.5').length, 3, 'the top of the shared scale on each panel');
  // One scale for every panel: a value of yMax is the top of any panel, zero its baseline.
  const top = String(smallLines(LINES({ panels: [{ label: 'a', points: pts([1.5, 0, 1.5, 0, 1.5]), change: '' }], ref: null })));
  assert.deepEqual([...top.matchAll(/<circle class="chart-lines__dot" cx="[\d.]+" cy="([\d.]+)"/g)].map((m) => Number(m[1])), [22, 138, 22, 138, 22]);
});

test('smallLines: two panels across on a phone, so more rows; a tall panel is taller; the years are thinned out', () => {
  const narrow = sound(smallLines(LINES({ width: 300 })), 'lines');
  assert.deepEqual(viewBox(narrow), [300, 2 * (18 + 120 + 30)]);
  assert.deepEqual(viewBox(sound(smallLines(LINES({ cols: 1 })), 'lines')), [640, 3 * (18 + 120 + 30)]);
  assert.deepEqual(viewBox(sound(smallLines(LINES({ tall: true, cols: 1 })), 'lines')), [640, 3 * (18 + 204 + 30)]);
  const ticks = (s) => texts(s, 'chart-tick').filter((t) => t.startsWith('’'));
  assert.deepEqual(ticks(String(smallLines(LINES()))).slice(0, 3), ['’20', '’22', '’24'], 'every other year, ending on the newest');
  assert.deepEqual(ticks(narrow).slice(0, 2), ['’21', '’24'], 'every third on a phone');
});

test('smallLines: a second line with no values draws no label; panel labels and tooltips are escaped', () => {
  const s = String(smallLines(LINES({ panels: [{ label: '<p>', points: pts([1, 1, 1, 1, 1]).map((p) => ({ ...p, tip: 'a <b>' })), under: pts([null, null, null, null, null]), underLabel: 'Nation' }] })));
  assert.ok(!s.includes('>Nation<'), 'nothing to label');
  assert.ok(s.includes('&lt;p&gt;') && s.includes('a &lt;b&gt;'));
  assert.ok(!s.includes('<p>') && !s.includes('<b>'));
});

// ---------- bar rows' label column ----------

test('barRows: the label column is the width asked for, else by the width of the drawing', () => {
  const rows = [{ label: 'Everyone', value: 0.2, valueText: '20%', tip: 'all' }, { label: 'Only <one>', value: 0.4, valueText: '40%', tip: 'one', pen: true }];
  const track = (s) => num(tags(s, 'chart-track')[0], 'x');
  const wide = sound(barRows({ rows, max: 0.5, width: 640 }), 'bars');
  const narrow = sound(barRows({ rows, max: 0.5, width: 300 }), 'bars');
  assert.equal(track(wide), 96);
  assert.equal(track(narrow), 70);
  const custom = sound(barRows({ rows, max: 0.5, width: 300, labelW: 150 }), 'bars');
  assert.equal(track(custom), 150, 'the track starts where the labels end');
  assert.equal(num(tags(custom, 'chart-track')[0], 'width'), 300 - 44 - 150);
  assert.deepEqual([...custom.matchAll(/<text class="chart-punch__row" x="([\d.]+)"/g)].map((m) => Number(m[1])), [142, 142], 'labels end 8 units before the track');
  assert.ok(attr(tags(custom, 'chart-bar')[0], 'd').startsWith('M150 '), 'the bar grows from the track');
  assert.equal(marks(custom).length, 2);
  assert.equal(tags(custom, 'chart-bar chart-col--pen').length, 1, 'the marked row in the penalty ink');
  assert.ok(custom.includes('Only &lt;one&gt;') && !custom.includes('<one>'));
  // The track and the bar's end move together: a value of max reaches the track's end.
  const full = String(barRows({ rows: [{ label: 'a', value: 0.5, valueText: '50%', tip: 't' }], max: 0.5, width: 300, labelW: 150 }));
  assert.match(attr(tags(full, 'chart-bar')[0], 'd'), /A[\d. ]+ 256 /, 'ends at width − 44 = 256');
  assert.equal(String(barRows({ rows, max: 0.5, width: 300, labelW: 150 })), custom, 'the same call gives the same markup');
});

// ---------- mini tile maps ----------

const TILE_CODES = Object.keys(TILES);
const MINI = (over = {}) => ({
  states: Object.fromEntries(TILE_CODES.map((code, i) => [code, { value: (i % 5) * 20 + 10, label: `${code} label` }])),
  ramp: [20, 40, 60, 80], width: 220, ...over,
});

test('miniTiles refuses a state with no entry, an unknown code, a tile that is both hatched and empty, and one with no value', () => {
  const { states } = MINI();
  const { AK, ...missing } = states;
  assert.throws(() => miniTiles(MINI({ states: missing })), /no entry for AK/);
  assert.throws(() => miniTiles(MINI({ states: { ...states, XX: { value: 1, label: 'x' } } })), /unknown code XX/);
  assert.throws(() => miniTiles(MINI({ states: { ...states, AK: { hatched: true, empty: true, label: 'x' } } })), /hatched or empty/);
  assert.throws(() => miniTiles(MINI({ states: { ...states, AK: { value: null, label: 'x' } } })), /AK has no value/);
  assert.throws(() => miniTiles(MINI({ states: { ...states, AK: { value: NaN, label: 'x' } } })), /AK has no value/);
  assert.doesNotThrow(() => miniTiles(MINI({ states: { ...states, AK: { empty: true, label: 'x' } } })));
});

test('miniTiles: a tile for every state, a mark for each one with a value, no codes and no legend', () => {
  const states = { ...MINI().states, AK: { empty: true, label: 'no hospitals' }, HI: { hatched: true, label: 'not in the program' }, VT: { value: 0, label: 'none cut' }, NH: { value: 20, label: 'at a threshold' }, ME: { value: 19.9, label: 'just under' }, MA: { value: 85, label: 'top <step>' } };
  const out = miniTiles({ states, ramp: [20, 40, 60, 80], width: 220 });
  const s = sound(out, 'mini-tiles');
  const pitch = 220 / GRID.cols;
  assert.deepEqual(viewBox(s), [220, Math.round(GRID.rows * pitch)]);
  assert.equal(count(s, /<rect /g), TILE_CODES.length, 'one square a state');
  assert.equal(tags(s, 'chart-tile-empty').length, 2, 'an empty tile and a hatched one are outlines');
  assert.equal(marks(s).length, TILE_CODES.length - 2);
  assert.equal(count(s, /data-state="/g), TILE_CODES.length - 2);
  assert.deepEqual(marks(s).find((m) => m.attrs.includes('data-state="VT"')).tip, 'VT: none cut');
  assert.match(s, /data-state="VT"[^>]*>[\s\S]*?class="chart-tile chart-tile-zero"/, 'a zero takes the neutral mark');
  const step = (code) => new RegExp(`data-state="${code}"[^>]*>[\\s\\S]*?chart-seq-(\\d)`).exec(s)[1];
  assert.equal(step('ME'), '1', 'below the first threshold');
  assert.equal(step('NH'), '2', 'a value at a threshold takes the step above');
  assert.equal(step('MA'), '5');
  assert.ok(s.includes('top &lt;step&gt;') && !s.includes('<step>'));
  assert.doesNotMatch(s, /<text|chart-legend|<defs/, 'tiles only: the figure carries the one legend');
  assert.equal(String(miniTiles({ states, ramp: [20, 40, 60, 80], width: 220 })), s, 'the same call gives the same markup');
});

// ---------- the year map's dots ----------

const TOPO = JSON.parse(readPinned('us-atlas-counties-3.0.1'));
const shapes = stateShapes(TOPO);
// Invented places: a point in each of Kansas, Missouri and the Alaska and Hawaii insets, and ones the map has no place for.
const PLACES = [[-98.0, 38.5], [-92.5, 38.6], [-150, 61.5], [-157.9, 21.4], [0, 0], null, undefined, [NaN, 38], 'x'];

test('usProjected: a place on the map for each point to a tenth of a unit, and null where the projection has none', () => {
  const at = usProjected(shapes, PLACES, 960);
  assert.equal(at.length, PLACES.length);
  assert.deepEqual(at.slice(4), [null, null, null, null, null]);
  const [w, h] = viewBox(String(usYearMap({ shapes, groups: [], size: 3, width: 960 })));
  for (const p of at.slice(0, 4)) {
    assert.equal(p.length, 2);
    assert.ok(p[0] > 0 && p[0] < w && p[1] > 0 && p[1] < h, `inside the ${w} by ${h} frame: ${p}`);
    for (const v of p) assert.equal(Math.round(v * 10) / 10, v, 'a tenth of a unit');
  }
  assert.ok(at[2][0] < at[0][0] && at[3][0] < at[0][0], 'the Alaska and Hawaii insets sit at the left of the lower 48');
  assert.ok(at[1][0] > at[0][0], 'Missouri is east of Kansas');
  assert.notDeepEqual(usProjected(shapes, PLACES, 300).slice(0, 4), at.slice(0, 4), 'a different width is a different drawing');
  assert.deepEqual(usProjected(shapes, [], 960), []);
  assert.deepEqual(usProjected(shapes, PLACES, 960), at, 'the same call gives the same places');
});

test('usProjected puts a dot where usPoints would put it at the same width', () => {
  const placed = usProjected(shapes, PLACES, 560).filter(Boolean);
  const svg = String(usPoints({ shapes, points: PLACES.map((point) => ({ point, cls: 'a' })), sizes: { a: 3 }, width: 560 }));
  assert.equal(attr(/<path class="chart-dots a"[^>]*>/.exec(svg)[0], 'd'), dotsD(placed));
});

test('usYearMap: the land as a faint path for each state and DC, then one path of dots for each class that has any, in the order given', () => {
  const [a, b] = [[100.04, 80.25], [210.5, 90]];
  const groups = [{ cls: 'chart-dots--years-clear', points: [a, b] }, { cls: 'chart-dots--years-scar', points: [] }, { cls: 'chart-dots--pen', points: [b] }];
  const out = usYearMap({ shapes, groups, size: 4.2, width: 960 });
  const s = sound(out, 'us-years');
  assert.equal(count(/<g class="chart-years__land">[\s\S]*?<\/g>/.exec(s)[0], /<path d="M/g), US_MAP_CODES.length);
  const dots = [...s.matchAll(/<path class="chart-dots ([\w-]+)" stroke-width="([\d.]+)" d="([^"]+)"/g)].map((m) => [m[1], m[2], m[3]]);
  assert.deepEqual(dots.map(([cls]) => cls), ['chart-dots--years-clear', 'chart-dots--pen'], 'a class with no hospital draws no path; the last class sits on top');
  assert.deepEqual(dots.map(([, w]) => w), ['4.2', '4.2']);
  assert.deepEqual(dots.map(([, , d]) => d), [dotsD([a, b]), dotsD([b])]);
  assert.equal(attr(tags(s, 'chart-years__dots')[0], 'data-size'), '4.2');
  assert.equal(String(usYearMap({ shapes, groups, size: 4.2, width: 960 })), s, 'the same call gives the same markup');
  assert.equal(count(String(usYearMap({ shapes, groups: [], size: 4.2, width: 960 })), /chart-dots /g), 0);
});
