// TEAM's reconciliation for one hospital's performance year (42 CFR 512.550), plus the scenario band, the "What would it
// take?" solver and the marginal figures the calculator and the hub band show. Pure: imports only params.js; no DOM,
// fs or clock. Cheap enough to run on every slider input.
//
// A category (`Cat`) is {key, target, spend, lowVolume}:
//   target    its reconciliation target price, summed over the year's episodes (standardized dollars, >= 0);
//   spend     how far spending lands from that target, as a share: +0.05 is 5% over, -0.05 is 5% under;
//   lowVolume fewer than LOW_VOLUME baseline episodes, so spending over target is capped at target (§ 512.550(c)(9)).
//
// The order follows § 512.550: each category's target minus spending; low-volume categories floored at 0; summed into
// the reconciliation amount; Track 1's negative amount set to 0 (it owes nothing, § 512.550(g)(3)(i)); the quality
// adjustment on that sum (§ 512.550(d)); then the stop-gain and stop-loss limits as shares of the summed target of
// every category, low-volume ones included (§ 512.550(e), and § 512.505's aggregated target price). The adjustment
// for high post-episode spending (§ 512.550(f)) needs CMS's own data, so it is not modelled: `postEpisode` is always 0.
import { BAND_DEFAULT, SOLVE_SPAN, TRACKS } from './params.js';

const fail = (what) => {
  throw new RangeError(`TEAM reconciliation: ${what}`);
};

function checked({ cats, cqs, track }) {
  if (!Array.isArray(cats)) fail('cats must be an array');
  cats.forEach((c, i) => {
    if (!Number.isFinite(c?.target) || c.target < 0) fail(`cats[${i}].target must be a finite number >= 0`);
    if (!Number.isFinite(c.spend)) fail(`cats[${i}].spend must be a finite number`);
  });
  if (!Number.isFinite(cqs) || cqs < 0 || cqs > 100) fail('cqs must be a number from 0 to 100');
  if (!Number.isInteger(track) || !TRACKS[track]) fail('track must be 1, 2 or 3');
  return TRACKS[track];
}

/**
 * @param {{cats: Array<{key: string, target: number, spend: number, lowVolume: boolean}>, cqs: number, track: 1|2|3}} input
 * @returns {{target: number, raw: number, qadj: number, quality: number, result: number, capped: 'gain'|'loss'|null,
 *   limits: {gain: number, loss: number}, postEpisode: 0}} dollars throughout. `raw` is the reconciliation amount after
 *   the low-volume caps and Track 1's floor; `qadj` the quality adjustment added to it; `quality` their sum; `result`
 *   that clamped to the limits (positive: CMS pays; negative: the hospital repays). `limits` are positive dollars.
 *   A $0 target (or no categories) gives 0 everywhere.
 * @throws {RangeError} on a non-finite or negative target, a non-finite spend, a CQS outside 0..100, or a track
 *   other than 1, 2 or 3. The caller clamps reader input first.
 */
export function reconcile(input) {
  const t = checked(input);
  const { cats, cqs } = input;
  let target = 0;
  let raw = 0;
  for (const c of cats) {
    const amount = -c.spend * c.target;
    target += c.target;
    raw += c.lowVolume ? Math.max(0, amount) : amount;
  }
  if (t.loss === 0 && raw < 0) raw = 0;
  // A gain loses up to qGain as the CQS falls; a loss is forgiven up to qLoss as it rises (§ 512.550(d)).
  const p = raw >= 0 ? t.qGain * (1 - cqs / 100) : t.qLoss * (cqs / 100);
  const qadj = 0 - p * raw; // `0 -` keeps a zero amount's adjustment +0, never -0
  const quality = raw + qadj;
  const limits = { gain: t.gain * target, loss: t.loss * target };
  const result = Math.min(Math.max(quality, -limits.loss), limits.gain);
  const capped = quality > limits.gain ? 'gain' : quality < -limits.loss ? 'loss' : null;
  return { target, raw, qadj, quality, result, capped, limits, postEpisode: 0 };
}

const atSpend = (cats, s) => cats.map((c) => ({ ...c, spend: s }));
const resultAt = ({ cats, cqs, track }, s) => reconcile({ cats: atSpend(cats, s), cqs, track }).result;

/**
 * The scenario band: the result with every category `width` over target (low) and `width` under (high), around
 * break-even. The categories' own spends are ignored; their low-volume flags still apply.
 * @returns {{low: number, high: number}} dollars
 */
export function bandOf({ cats, cqs, track, width }) {
  checked({ cats, cqs, track });
  if (!Number.isFinite(width) || width < 0) fail('width must be a finite number >= 0');
  const input = { cats, cqs, track };
  return { low: resultAt(input, width), high: resultAt(input, -width) };
}

/**
 * "What would it take?": the spend s, the same for every category, at which the reconciliation reaches `result`.
 *
 * The result falls (never rises) as s rises, is continuous, and is 0 at s = 0. It can be flat over a range of s: at a
 * limit, on Track 1's loss side, and over target when every category is low volume. So the answer is the s closest to
 * zero that reaches `result`; at a limit that is the spending at which the stop-gain or stop-loss starts to bind. The
 * search is bisection over ±SOLVE_SPAN, run to about the precision of a double, so the answer reproduces `result` to
 * well under a dollar.
 *
 * @returns {number|null} the spend (+0.05 is 5% over), 0 for a result of 0, or null when no s in ±SOLVE_SPAN reaches
 *   `result`: past a limit, any loss on Track 1, or a loss larger than the non-low-volume categories can make.
 */
export function solveSpend({ cats, cqs, track, result }) {
  checked({ cats, cqs, track });
  if (!Number.isFinite(result)) fail('result must be a finite number');
  if (result === 0) return 0;
  const input = { cats, cqs, track };
  // Keep `near` (between 0 and the answer) short of result and `far` at or past it; the boundary is the answer.
  const sign = result > 0 ? -1 : 1;
  const reaches = (s) => (sign < 0 ? resultAt(input, s) >= result : resultAt(input, s) <= result);
  let far = sign * SOLVE_SPAN;
  if (!reaches(far)) return null;
  let near = 0;
  // About 53 halvings: down to the spacing of doubles near SOLVE_SPAN, so the dollar error is target × 1e-16.
  while (Math.abs(far - near) > SOLVE_SPAN * Number.EPSILON) {
    const mid = (near + far) / 2;
    if (reaches(mid)) far = mid;
    else near = mid;
  }
  return far;
}

/**
 * The marginal figures, in dollars, each >= 0:
 *   perPctUnder  what landing 1% under target everywhere adds, from break-even;
 *   perPctOver   what landing 1% over target everywhere costs, from break-even;
 *   per10Quality what 10 more CQS points (capped at 100) add, at the reader's scenario when any category's spend is
 *                set, else with every category BAND_DEFAULT over target.
 */
export function marginal({ cats, cqs, track }) {
  checked({ cats, cqs, track });
  const input = { cats, cqs, track };
  const even = resultAt(input, 0);
  const scenario = cats.some((c) => c.spend !== 0) ? cats : atSpend(cats, BAND_DEFAULT);
  const quality = (q) => reconcile({ cats: scenario, cqs: q, track }).result;
  return {
    perPctUnder: resultAt(input, -0.01) - even,
    perPctOver: even - resultAt(input, 0.01),
    per10Quality: quality(Math.min(100, cqs + 10)) - quality(cqs),
  };
}
