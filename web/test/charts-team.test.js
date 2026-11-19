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
  // The gain line runs flat at the stop-gain past its knot: its last two points share a y.
  const gain = /class="chart-payoff__gain" d="([^"]+)"/.exec(svg)[1];
  assert.match(gain, /^M/);
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
