// The TEAM program page's two kit charts: the tracks' limits (web/charts/trackLimits.js) and the payoff of one
// hospital's year against its spending (web/charts/payoff.js). Synthetic inputs; each chart's every plotted value is in
// the table its figure carries (figure() throws when one is not).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { figure } from '../charts/figure.js';
import { payoff, payoffPoints } from '../charts/payoff.js';
import { trackLimits, trackRows } from '../charts/trackLimits.js';
import { WIDTH } from '../charts/svg.js';

const TRACKS = { 1: { gain: 0.1, loss: 0 }, 2: { gain: 0.05, loss: 0.05 }, 3: { gain: 0.2, loss: 0.2 } };
const pctText = (x) => `${Math.round(x * 100)}%`;
const TL_WORDS = {
  name: (k) => `Track ${k}`,
  sub: { 1: 'upside only', 2: 'two-sided, small', 3: 'two-sided' },
  gain: (x) => `+${pctText(x)}`,
  loss: (x) => `−${pctText(x)}`,
  none: 'no repayment',
  tip: (k, side, x) => `Track ${k}, ${side}: ${pctText(x)}`,
  axis: pctText,
};
const values = (svg) => [...String(svg).matchAll(/data-value="([^"]*)"/g)].flatMap((m) => m[1].split(' ').map(Number));

test('trackLimits: one mark per limit, gains up and losses down from one zero line, a track with no loss says so', () => {
  const svg = String(trackLimits({ tracks: TRACKS, words: TL_WORDS, width: 560 }));
  assert.match(svg, /^<svg class="chart chart--tracks"/);
  // Track 1's loss side is no bar: five marks, each its limit in percent.
  assert.deepEqual(values(svg).sort((a, b) => a - b), [5, 5, 10, 20, 20]);
  assert.equal((svg.match(/chart-tracks__gain/g) ?? []).length, 3);
  assert.equal((svg.match(/chart-tracks__loss/g) ?? []).length, 2);
  assert.match(svg, />no repayment</);
  assert.match(svg, />Track 3</);
  assert.match(svg, />two-sided, small</);
  assert.equal((svg.match(/class="chart-zero"/g) ?? []).length, 1);
  // The bars scale to the largest limit: Track 3's gain bar is twice Track 1's.
  const heights = [...svg.matchAll(/class="chart-tracks__gain" x="[\d.]+" y="[\d.]+" width="[\d.]+" height="([\d.]+)"/g)].map((m) => Number(m[1]));
  assert.equal(heights.length, 3);
  assert.ok(Math.abs(heights[2] - 2 * heights[0]) < 0.02, heights.join(' '));
});

test('trackLimits: the narrow drawing keeps every label; its table holds every plotted value', () => {
  const narrow = trackLimits({ tracks: TRACKS, words: TL_WORDS, width: WIDTH });
  const wide = trackLimits({ tracks: TRACKS, words: TL_WORDS, width: 560 });
  assert.match(String(narrow), /viewBox="0 0 300 /);
  const rows = trackRows(TRACKS, { name: TL_WORDS.name, sub: TL_WORDS.sub, pct: pctText, none: '0%' });
  assert.equal(rows.length, 3);
  assert.doesNotThrow(() => figure({
    n: 1, takeaway: 't', svg: narrow, svgWide: wide, source: 's', alt: 'a',
    table: { columns: [{ name: 'Track' }, { name: 'Who' }, { name: 'Gain', numeric: true }, { name: 'Loss', numeric: true }], rows },
  }));
});

// A two-category hospital on Track 3: the result is the engine's, here a stand-in with the same shape (linear in s,
// clamped at the limits), so the chart is tested apart from the engine.
const LIMITS = { gain: 2e6, loss: 2e6 };
const at = (s) => Math.max(-LIMITS.loss, Math.min(LIMITS.gain, -s * 10e6 * 0.95));
const PAY_WORDS = {
  under: '← under target', over: 'over target →', on: 'on target',
  stopGain: 'stop-gain', stopLoss: 'stop-loss', band: '±5%',
  x: (s) => (s === 0 ? 'on target' : `${s > 0 ? '+' : '−'}${pctText(Math.abs(s))}`),
  y: (v) => `$${v / 1e6}M`,
  tip: (s, v) => `${s}: ${v}`,
};
const PAY = { at, limits: LIMITS, span: 0.3, step: 0.05, band: 0.05, words: PAY_WORDS };

test('payoffPoints: every step from span under target to span over, each result rounded to the dollar', () => {
  const pts = payoffPoints(PAY);
  assert.equal(pts.length, 13);
  assert.deepEqual(pts.map((p) => p.s), [-0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3]);
  for (const p of pts) assert.equal(p.result, Math.round(at(p.s)) + 0);
  assert.ok(Object.is(pts[6].result, 0), 'on target is +0, never −0');
});

test('payoff: a gain line and a loss line meeting on target, flat where the limits hold, the band shaded and both limits dashed and named', () => {
  const svg = String(payoff({ ...PAY, width: 560 }));
  assert.match(svg, /^<svg class="chart chart--payoff"/);
  assert.equal((svg.match(/class="chart-payoff__gain"/g) ?? []).length, 1);
  assert.equal((svg.match(/class="chart-payoff__loss"/g) ?? []).length, 1);
  assert.equal((svg.match(/class="chart-payoff__limit"/g) ?? []).length, 2);
  assert.match(svg, />stop-gain</);
  assert.match(svg, />stop-loss</);
  assert.match(svg, /class="chart-payoff__band"/);
  assert.match(svg, />±5%</);
  // Every tabled step is a mark carrying its result.
  assert.deepEqual(values(svg), payoffPoints(PAY).map((p) => p.result));
  // Flat where the limits hold: the gain line's first two points (from span under target to where the stop-gain starts
  // to bind) sit on the stop-gain's dashed line, and the loss line's last two on the stop-loss's.
  const pointsOf = (cls) => /^M(.*)$/.exec(new RegExp(`class="${cls}" d="([^"]+)"`).exec(svg)[1])[1].split('L').map((p) => p.split(' ').map(Number));
  const [gainY, lossY] = [...svg.matchAll(/class="chart-payoff__limit" x1="[^"]+" x2="[^"]+" y1="([^"]+)"/g)].map((m) => Number(m[1]));
  const gain = pointsOf('chart-payoff__gain');
  const loss = pointsOf('chart-payoff__loss');
  assert.deepEqual([gain[0][1], gain[1][1]], [gainY, gainY], 'flat at the stop-gain');
  assert.deepEqual([loss.at(-2)[1], loss.at(-1)[1]], [lossY, lossY], 'flat at the stop-loss');
  // Between the flats the line moves: on target it is at zero, between the two limits.
  assert.ok(gain.at(-1)[1] > gainY && loss[0][1] < lossY);
  // The flat ends where the limit starts to bind (2,000,000 / 9,500,000 of target: 21.05% either side), to the trace's
  // tenth of a percent.
  const xOf = (s) => 52 + ((s + 0.3) / 0.6) * (560 - 52 - 6);
  assert.ok(Math.abs(gain[1][0] - xOf(-2 / 9.5)) < 1.5, `${gain[1][0]} vs ${xOf(-2 / 9.5)}`);
  assert.ok(Math.abs(loss.at(-2)[0] - xOf(2 / 9.5)) < 1.5, `${loss.at(-2)[0]} vs ${xOf(2 / 9.5)}`);
});

// The dollar axis's gridlines fall on round amounts (d3's nice ticks over the drawing's range: $1M steps for limits of
// $2.3M), never on the limits' own odd amounts; each limit keeps its own name and amount on its dashed line. Both names
// sit above their lines, so the stop-loss's never meets the spending axis's labels under the plot.
test('payoff: round dollar gridlines, and each limit named above its own dashed line', () => {
  const limits = { gain: 2.3e6, loss: 2.3e6 };
  const at23 = (s) => Math.max(-limits.loss, Math.min(limits.gain, -s * 11.5e6));
  for (const width of [WIDTH, 560]) {
    const svg = String(payoff({ ...PAY, at: at23, limits, width }));
    const ticks = [...svg.matchAll(/<text class="chart-tick" x="[\d.]+" y="[\d.]+" text-anchor="end">\$(-?[\d.]+)M<\/text>/g)].map((m) => Number(m[1]));
    assert.deepEqual(ticks, [2, 1, 0, -1, -2], `${width}: the gridlines' labels`);
    const lines = [...svg.matchAll(/class="chart-payoff__limit" x1="[^"]+" x2="[^"]+" y1="([^"]+)"/g)].map((m) => Number(m[1]));
    const names = ['stop-gain', 'stop-loss'].map((w) => Number(new RegExp(`y="([\\d.]+)"[^>]*>${w}<`).exec(svg)[1]));
    names.forEach((y, i) => assert.ok(y < lines[i] && y > lines[i] - 8, `${width}: the ${i ? 'stop-loss' : 'stop-gain'} name just above its line`));
  }
});

test('payoff: the marked point is drawn on the line, and a track with no loss side draws no stop-loss', () => {
  const svg = String(payoff({ ...PAY, marker: -0.05, width: 560 }));
  assert.equal((svg.match(/class="chart-payoff__marker"/g) ?? []).length, 1);
  const noLoss = String(payoff({ ...PAY, at: (s) => Math.max(0, at(s)), limits: { gain: 1e6, loss: 0 }, width: WIDTH }));
  assert.equal((noLoss.match(/class="chart-payoff__limit"/g) ?? []).length, 1);
  assert.doesNotMatch(noLoss, />stop-loss</);
});

test('payoff: its figure holds every plotted value in the table', () => {
  const rows = payoffPoints(PAY).map((p) => [PAY_WORDS.x(p.s), { text: String(p.result), value: String(p.result) }]);
  assert.doesNotThrow(() => figure({
    n: 3, takeaway: 't', svg: payoff({ ...PAY, width: WIDTH }), svgWide: payoff({ ...PAY, width: 560 }), source: 's', alt: 'a',
    table: { columns: [{ name: 'Spending' }, { name: 'Result', numeric: true }], rows },
  }));
});

test('payoff: bad input throws', () => {
  assert.throws(() => payoff({ ...PAY, span: 0 }), RangeError);
  assert.throws(() => payoff({ ...PAY, step: 0.07 }), RangeError, 'a step that does not divide the span');
  assert.throws(() => payoff({ ...PAY, limits: { gain: -1, loss: 0 } }), RangeError);
});

// The phone drawing's exact markup for the inputs above (a sub with a comma on two lines). A change here is a visible
// change to Figure 2: look at it in the browser before updating the snapshot.
const TRACKS_SNAPSHOT = "<svg class=\"chart chart--tracks\" viewBox=\"0 0 300 202\" width=\"100%\" focusable=\"false\" style=\"--vb: 300\"><line class=\"chart-grid\" x1=\"30\" x2=\"300\" y1=\"91\" y2=\"91\"/><text class=\"chart-tick\" x=\"25\" y=\"95\" text-anchor=\"end\">+10%</text><line class=\"chart-grid\" x1=\"30\" x2=\"300\" y1=\"161\" y2=\"161\"/><text class=\"chart-tick\" x=\"25\" y=\"165\" text-anchor=\"end\">−10%</text><line class=\"chart-grid\" x1=\"30\" x2=\"300\" y1=\"56\" y2=\"56\"/><text class=\"chart-tick\" x=\"25\" y=\"60\" text-anchor=\"end\">+20%</text><line class=\"chart-grid\" x1=\"30\" x2=\"300\" y1=\"196\" y2=\"196\"/><text class=\"chart-tick\" x=\"25\" y=\"200\" text-anchor=\"end\">−20%</text>\n<line class=\"chart-zero\" x1=\"30\" x2=\"300\" y1=\"126\" y2=\"126\"/><text class=\"chart-tick\" x=\"25\" y=\"130\" text-anchor=\"end\">0</text>\n<text class=\"chart-label\" x=\"36\" y=\"14\" text-anchor=\"start\">Track 1</text><text class=\"chart-tick\" x=\"36\" y=\"29\" text-anchor=\"start\">upside only</text>\n<g class=\"chart-mark\" data-mark data-value=\"10\"><title>Track 1, gain: 10%</title><rect class=\"chart-hit\" x=\"36\" y=\"91\" width=\"30\" height=\"35\"/><rect class=\"chart-tracks__gain\" x=\"36\" y=\"91\" width=\"30\" height=\"35\"/><text class=\"chart-value\" x=\"70\" y=\"102\" text-anchor=\"start\">+10%</text></g>\n<text class=\"chart-tick\" x=\"36\" y=\"141\" text-anchor=\"start\">no repayment</text>\n<text class=\"chart-label\" x=\"126\" y=\"14\" text-anchor=\"start\">Track 2</text><text class=\"chart-tick\" x=\"126\" y=\"29\" text-anchor=\"start\">two-sided,</text><text class=\"chart-tick\" x=\"126\" y=\"41\" text-anchor=\"start\">small</text>\n<g class=\"chart-mark\" data-mark data-value=\"5\"><title>Track 2, gain: 5%</title><rect class=\"chart-hit\" x=\"126\" y=\"108.5\" width=\"30\" height=\"17.5\"/><rect class=\"chart-tracks__gain\" x=\"126\" y=\"108.5\" width=\"30\" height=\"17.5\"/><text class=\"chart-value\" x=\"160\" y=\"119.5\" text-anchor=\"start\">+5%</text></g>\n<g class=\"chart-mark\" data-mark data-value=\"5\"><title>Track 2, loss: 5%</title><rect class=\"chart-hit\" x=\"126\" y=\"126\" width=\"30\" height=\"17.5\"/><rect class=\"chart-tracks__loss\" x=\"126\" y=\"126\" width=\"30\" height=\"17.5\"/><text class=\"chart-value\" x=\"160\" y=\"140.5\" text-anchor=\"start\">−5%</text></g>\n<text class=\"chart-label\" x=\"216\" y=\"14\" text-anchor=\"start\">Track 3</text><text class=\"chart-tick\" x=\"216\" y=\"29\" text-anchor=\"start\">two-sided</text>\n<g class=\"chart-mark\" data-mark data-value=\"20\"><title>Track 3, gain: 20%</title><rect class=\"chart-hit\" x=\"216\" y=\"56\" width=\"30\" height=\"70\"/><rect class=\"chart-tracks__gain\" x=\"216\" y=\"56\" width=\"30\" height=\"70\"/><text class=\"chart-value\" x=\"250\" y=\"67\" text-anchor=\"start\">+20%</text></g>\n<g class=\"chart-mark\" data-mark data-value=\"20\"><title>Track 3, loss: 20%</title><rect class=\"chart-hit\" x=\"216\" y=\"126\" width=\"30\" height=\"70\"/><rect class=\"chart-tracks__loss\" x=\"216\" y=\"126\" width=\"30\" height=\"70\"/><text class=\"chart-value\" x=\"250\" y=\"193\" text-anchor=\"start\">−20%</text></g>\n</svg>";

test('trackLimits: the phone drawing matches its inline snapshot', () => {
  assert.equal(String(trackLimits({ tracks: TRACKS, words: TL_WORDS, width: WIDTH })), TRACKS_SNAPSHOT);
});

// The payoff's phone drawing for the inputs above, the worked example's spending ringed (every other tick labeled, the band
// unnamed). A change here is a visible change to Figure 3: look at it in the browser before updating the snapshot.
const PAYOFF_SNAPSHOT = "<svg class=\"chart chart--payoff\" viewBox=\"0 0 300 204\" width=\"100%\" focusable=\"false\" style=\"--vb: 300\"><rect class=\"chart-payoff__band\" x=\"148.17\" y=\"18\" width=\"41.66\" height=\"150\"/>\n<line class=\"chart-grid\" x1=\"44\" x2=\"294\" y1=\"30.5\" y2=\"30.5\"/><text class=\"chart-tick\" x=\"39\" y=\"34.5\" text-anchor=\"end\">$2M</text><line class=\"chart-grid\" x1=\"44\" x2=\"294\" y1=\"61.75\" y2=\"61.75\"/><text class=\"chart-tick\" x=\"39\" y=\"65.75\" text-anchor=\"end\">$1M</text><line class=\"chart-grid\" x1=\"44\" x2=\"294\" y1=\"93\" y2=\"93\"/><text class=\"chart-tick\" x=\"39\" y=\"97\" text-anchor=\"end\">$0M</text><line class=\"chart-grid\" x1=\"44\" x2=\"294\" y1=\"124.25\" y2=\"124.25\"/><text class=\"chart-tick\" x=\"39\" y=\"128.25\" text-anchor=\"end\">$-1M</text><line class=\"chart-grid\" x1=\"44\" x2=\"294\" y1=\"155.5\" y2=\"155.5\"/><text class=\"chart-tick\" x=\"39\" y=\"159.5\" text-anchor=\"end\">$-2M</text>\n<line class=\"chart-grid\" x1=\"44\" x2=\"44\" y1=\"18\" y2=\"168\"/><line class=\"chart-grid\" x1=\"85.67\" x2=\"85.67\" y1=\"18\" y2=\"168\"/><text class=\"chart-tick\" x=\"85.67\" y=\"182\" text-anchor=\"middle\">−20%</text><line class=\"chart-grid\" x1=\"127.33\" x2=\"127.33\" y1=\"18\" y2=\"168\"/><line class=\"chart-grid\" x1=\"169\" x2=\"169\" y1=\"18\" y2=\"168\"/><text class=\"chart-tick\" x=\"169\" y=\"182\" text-anchor=\"middle\">on target</text><line class=\"chart-grid\" x1=\"210.67\" x2=\"210.67\" y1=\"18\" y2=\"168\"/><line class=\"chart-grid\" x1=\"252.33\" x2=\"252.33\" y1=\"18\" y2=\"168\"/><text class=\"chart-tick\" x=\"252.33\" y=\"182\" text-anchor=\"middle\">+20%</text><line class=\"chart-grid\" x1=\"294\" x2=\"294\" y1=\"18\" y2=\"168\"/>\n<line class=\"chart-zero\" x1=\"44\" x2=\"294\" y1=\"93\" y2=\"93\"/>\n<line class=\"chart-payoff__limit\" x1=\"44\" x2=\"294\" y1=\"30.5\" y2=\"30.5\"/><text class=\"chart-tick chart-label--halo\" x=\"294\" y=\"26.5\" text-anchor=\"end\">stop-gain</text><line class=\"chart-payoff__limit\" x1=\"44\" x2=\"294\" y1=\"155.5\" y2=\"155.5\"/><text class=\"chart-tick chart-label--halo\" x=\"48\" y=\"151.5\" text-anchor=\"start\">stop-loss</text>\n<path class=\"chart-payoff__gain\" d=\"M44 30.5L81.08 30.5L81.5 30.66L169 93\"/><path class=\"chart-payoff__loss\" d=\"M169 93L256.5 155.34L256.92 155.5L294 155.5\"/>\n<g class=\"chart-mark\" data-mark data-value=\"2000000\"><title>-0.3: 2000000</title><rect class=\"chart-hit\" x=\"38\" y=\"24.5\" width=\"12\" height=\"12\"/><circle class=\"chart-payoff__pt\" cx=\"44\" cy=\"30.5\" r=\"3\"/></g><g class=\"chart-mark\" data-mark data-value=\"2000000\"><title>-0.25: 2000000</title><rect class=\"chart-hit\" x=\"58.83\" y=\"24.5\" width=\"12\" height=\"12\"/><circle class=\"chart-payoff__pt\" cx=\"64.83\" cy=\"30.5\" r=\"3\"/></g><g class=\"chart-mark\" data-mark data-value=\"1900000\"><title>-0.2: 1900000</title><rect class=\"chart-hit\" x=\"79.67\" y=\"27.63\" width=\"12\" height=\"12\"/><circle class=\"chart-payoff__pt\" cx=\"85.67\" cy=\"33.63\" r=\"3\"/></g><g class=\"chart-mark\" data-mark data-value=\"1425000\"><title>-0.15: 1425000</title><rect class=\"chart-hit\" x=\"100.5\" y=\"42.47\" width=\"12\" height=\"12\"/><circle class=\"chart-payoff__pt\" cx=\"106.5\" cy=\"48.47\" r=\"3\"/></g><g class=\"chart-mark\" data-mark data-value=\"950000\"><title>-0.1: 950000</title><rect class=\"chart-hit\" x=\"121.33\" y=\"57.31\" width=\"12\" height=\"12\"/><circle class=\"chart-payoff__pt\" cx=\"127.33\" cy=\"63.31\" r=\"3\"/></g><g class=\"chart-mark\" data-mark data-value=\"475000\"><title>-0.05: 475000</title><rect class=\"chart-hit\" x=\"142.17\" y=\"72.16\" width=\"12\" height=\"12\"/><circle class=\"chart-payoff__pt\" cx=\"148.17\" cy=\"78.16\" r=\"3\"/></g><g class=\"chart-mark\" data-mark data-value=\"0\"><title>0: 0</title><rect class=\"chart-hit\" x=\"163\" y=\"87\" width=\"12\" height=\"12\"/><circle class=\"chart-payoff__pt\" cx=\"169\" cy=\"93\" r=\"3\"/></g><g class=\"chart-mark\" data-mark data-value=\"-475000\"><title>0.05: -475000</title><rect class=\"chart-hit\" x=\"183.83\" y=\"101.84\" width=\"12\" height=\"12\"/><circle class=\"chart-payoff__pt\" cx=\"189.83\" cy=\"107.84\" r=\"3\"/></g><g class=\"chart-mark\" data-mark data-value=\"-950000\"><title>0.1: -950000</title><rect class=\"chart-hit\" x=\"204.67\" y=\"116.69\" width=\"12\" height=\"12\"/><circle class=\"chart-payoff__pt\" cx=\"210.67\" cy=\"122.69\" r=\"3\"/></g><g class=\"chart-mark\" data-mark data-value=\"-1425000\"><title>0.15: -1425000</title><rect class=\"chart-hit\" x=\"225.5\" y=\"131.53\" width=\"12\" height=\"12\"/><circle class=\"chart-payoff__pt\" cx=\"231.5\" cy=\"137.53\" r=\"3\"/></g><g class=\"chart-mark\" data-mark data-value=\"-1900000\"><title>0.2: -1900000</title><rect class=\"chart-hit\" x=\"246.33\" y=\"146.38\" width=\"12\" height=\"12\"/><circle class=\"chart-payoff__pt\" cx=\"252.33\" cy=\"152.38\" r=\"3\"/></g><g class=\"chart-mark\" data-mark data-value=\"-2000000\"><title>0.25: -2000000</title><rect class=\"chart-hit\" x=\"267.17\" y=\"149.5\" width=\"12\" height=\"12\"/><circle class=\"chart-payoff__pt\" cx=\"273.17\" cy=\"155.5\" r=\"3\"/></g><g class=\"chart-mark\" data-mark data-value=\"-2000000\"><title>0.3: -2000000</title><rect class=\"chart-hit\" x=\"288\" y=\"149.5\" width=\"12\" height=\"12\"/><circle class=\"chart-payoff__pt\" cx=\"294\" cy=\"155.5\" r=\"3\"/></g>\n<circle class=\"chart-payoff__marker\" cx=\"148.17\" cy=\"78.16\" r=\"5\"/>\n<text class=\"chart-axis__title\" x=\"44\" y=\"198\" text-anchor=\"start\">← under target</text><text class=\"chart-axis__title\" x=\"294\" y=\"198\" text-anchor=\"end\">over target →</text></svg>";

test('payoff: the phone drawing matches its inline snapshot', () => {
  assert.equal(String(payoff({ ...PAY, marker: -0.05, width: WIDTH })), PAYOFF_SNAPSHOT);
});
