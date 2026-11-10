// The numbers behind a hospital page's what-if (figures/whatif.js draws them; client/hospital.js runs them in the browser).
// One function, whatIfPaf (engine/js/hrrp/whatif.js), gives the factor for any set of ratios; the browser calls the same one, so
// the page as built and the page as moved agree to the digit. Peer medians, payment weights and the neutrality modifier stay at
// their edition values (the what-if is an approximation, and says so). Pure.
import { CAP, CONDS, cutPct, isMeasured, peerMedian, weightPublished } from '../../../../engine/js/hrrp/formula.js';
import { r2 } from '../../../../web/charts/svg.js';
import { moneyShown } from '../../../../web/render/format.js';
import { sliderRange, whatIfPaf } from '../../../../engine/js/hrrp/whatif.js';
import { conditionShort } from '../derive.js';
import { fill, t } from '../hospital/copy.js';
import { FACTOR_STEP, factor4, fmtMoney, fmtPct } from '../numbers.js';
import { waterfallData, worksheetRows } from '../worksheet.js';
import { hospitalOf, sheetRow } from './worksheet-data.js';

// A slider's step, in ratio.
export const WI_STEP = 0.001;
// The page data's script id (the page writes it, figures/whatif.js, and the script reads it).
export const WHATIF_DATA_ID = 'hrrp-hospital';
// One step of the payment adjustment factor (numbers.js, beside factor4), for the what-if's note.
export { FACTOR_STEP };

// What a result field reads at a state ({ paf, cut, dollars }); the browser writes the same words.
export const resultWords = (state) => ({
  cut: fmtPct(state.cut),
  factor: factor4(state.paf),
  dollars: state.dollars === null ? t('cellNone') : fmtMoney(state.dollars),
});

// The status line a screen reader hears when the ratios settle.
export const liveWords = (state) => {
  const words = resultWords(state);
  return state.dollars === null ? fill('wiLiveNoDollars', words) : fill('wiLive', words);
};

// "Bring all to median" for one slider: where a ratio at its current value goes. Over its peer median (to the median itself, exactly)
// it comes down to the median; at or under it, or with no median published, null: it stays where the reader put it.
export const medianTarget = (current, median) => (median !== null && median !== undefined && current > median ? median : null);

// The conditions the what-if can move (the hospital's measured ones), by key.
export const measuredKeys = (h) => CONDS.filter((k) => isMeasured(h.c[k]));

// The state at these ratios (over: { condition: ratio } for the ones moved; the rest stay at the hospital's own): CMS's factor moved
// by the recomputed change, the cut it makes in percent and the dollars it takes (null without base payments).
export function whatIfState(h, meta, over = {}) {
  const paf = whatIfPaf(h, meta, over);
  return { paf, cut: cutPct(paf), dollars: h.base == null ? null : Math.round(h.base * (1 - paf)) };
}

// The hospital with these ratios, for Worksheet R's rows and the waterfall: a moved condition's flag follows the ratio (over its
// peer median, CMS would flag it), so a condition brought under the median reads "at or under its median", not "rounds to nothing".
export function movedHospital(h, meta, over = {}) {
  const c = { ...h.c };
  for (const [k, err] of Object.entries(over)) {
    // A condition with no published peer median is never over it (formula.js counts nothing for it either).
    const med = peerMedian(meta, h.peer, k);
    if (c[k]) c[k] = { ...c[k], err, flag: med !== null && err > med ? 1 : 0 };
  }
  return { ...h, c };
}

// The waterfall's numbers at these ratios.
export const whatIfWaterfall = (h, meta, conditions, over = {}) => waterfallData(worksheetRows(movedHospital(h, meta, over), meta), conditions);

// Each measured condition: the slider's bounds (widened to hold the ratio), the median, and, for one over its median, its escape
// value (the ratio that reaches the median) and what reaching it alone would save (percent of base payments, and dollars).
export function sliderRows(h, meta, conditions) {
  const now = whatIfState(h, meta).dollars;
  return measuredKeys(h).map((k) => {
    const c = h.c[k];
    const med = peerMedian(meta, h.peer, k);
    const [min, max] = sliderRange(c.err);
    const over = med !== null && c.err > med;
    let escape = null;
    if (over) {
      const { paf, dollars: after } = whatIfState(h, meta, { [k]: med });
      escape = {
        ratio: med,
        // CMS counted it, but without a published payment weight its share cannot be recomputed here.
        saveCut: weightPublished(c) ? r2(cutPct(h.paf) - cutPct(paf)) : null,
        saveDollars: !weightPublished(c) || after === null || now === null ? null : now - after,
        // Nothing saved while the other conditions alone keep the cut at its cap.
        atCap: paf < 1 && 1 - paf >= CAP - 1e-9,
      };
    }
    return { cond: k, short: conditionShort(conditions, k), err: c.err, med, min, max, over, escape };
  });
}

// Why the savings the rows print add up to more than the cut at the actual ratios, or null where they don't. sliders: sliderRows();
// start: whatIfState() at the actual ratios. Each saving is worked out with that condition alone moved, on a factor that moves in
// whole steps, so the steps the rows save can add up to more than the cut's: 'steps' (the percents as printed, exact at two
// decimals, add up past the cut's). Else 'rounded' where only the dollars as printed (money(): "about $62K") do.
export function savingsOverCut(sliders, start) {
  const saved = sliders.map((s) => s.escape).filter((e) => e?.saveCut > 0);
  const steps = (pct) => Math.round(pct / 100 / FACTOR_STEP);
  if (saved.reduce((n, e) => n + steps(e.saveCut), 0) > steps(start.cut)) return 'steps';
  if (start.dollars === null) return null;
  const shown = saved.filter((e) => e.saveDollars !== null).reduce((n, e) => n + moneyShown(e.saveDollars), 0);
  return shown > moneyShown(start.dollars) ? 'rounded' : null;
}

// The hospital page's what-if, as data. The rows, the starting state and why the rows' savings add up to more than the cut (`over`,
// with one step of the cut in dollars, null without base payments); `client` is what the browser needs to recompute (the
// hospital's worksheet row, its base payments, the neutrality modifier and its own peer group's medians). The browser redraws the
// result and the waterfall, never the rows' savings, so `over` holds at every ratio the reader tries.
export function whatIfData(h, ctx) {
  const { meta, edition } = ctx;
  const sliders = sliderRows(h, meta, edition.conditions);
  const state = whatIfState(h, meta);
  return {
    sliders,
    start: { ...state, actualCut: h.red, actualPaf: h.paf, pen: h.pen ?? null },
    over: { why: savingsOverCut(sliders, state), step: h.base == null ? null : h.base * FACTOR_STEP },
    wf: whatIfWaterfall(h, meta, edition.conditions),
    client: {
      row: sheetRow(h), base: h.base ?? null,
      meta: { nm: meta.nm, peerMedians: { [h.peer]: meta.peerMedians[h.peer] } },
      conditions: edition.conditions, edition: edition.label,
    },
  };
}

// The hospital (and meta) the browser rebuilds from `client`.
export function clientHospital({ row, base, meta }) {
  return { h: { ...hospitalOf(row), base }, meta };
}
