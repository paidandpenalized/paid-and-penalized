// Ported from Thirty Day Readmissions (web/src/js/model.js, views/hospital.js and views/scope.js at 33d1959).
// The Readmissions site's sentences. Every word is a key of copy.js; numbers are formatted here and filled in.
// Typesetting (copy.js text goes through fillCopy) turns a straight apostrophe into a curly one, so sentences that
// hold one differ from the source's by that character alone.
import { CONDS, MIN_DISCHARGES, verdict } from '../../../engine/js/hrrp/formula.js';
import { noEstimate, rankPct } from '../../../engine/js/hrrp/summary.js';
import { capitalize, ordinal, spelled } from '../../../web/render/format.js';
import { fill, t } from './copy.js';
import { fmtDate, fmtInt, fmtPct } from './numbers.js';

export { ordinal };
export const upFirst = capitalize;

// "1 hospital", "2,912 hospitals". one and many are words (read them from copy); many defaults to one plus s.
export const plural = (n, one, many = `${one}s`) => `${fmtInt(n)} ${n === 1 ? one : many}`;
const hospitals = (n) => plural(n, t('nounHospital'), t('nounHospitals'));

// Condition label inside a sentence: acronyms stay, words go lowercase.
export const inSentence = (label) => (label === label.toUpperCase() ? label : label.toLowerCase());

// The share penalized of a summarize() result whose hospitals are none of them measured on any condition (pctPen is null).
export const noneMeasured = (sm) => t(sm.n === 1 ? 'noneMeasuredOne' : 'noneMeasuredMany');

// "83% of 2,798 measured", from a summarize() result; noneMeasured() when no hospital is.
export const penalizedOfMeasured = (sm) => (sm.pctPen == null ? noneMeasured(sm)
  : fill('penalizedOfMeasured', { pct: fmtPct(sm.pctPen, 0), n: fmtInt(sm.nMeasured) }));

// "+0.05 pts vs nation", compared after rounding to what is shown. The minus is the true minus, as in the source.
export function vsLabel(a, b, dp, unit, word = t('vsNation')) {
  const d = Number(a.toFixed(dp)) - Number(b.toFixed(dp));
  if (Math.abs(d) < 10 ** -(dp + 2)) return fill('vsSame', { word });
  return fill('vsDiff', { delta: `${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(dp)}`, unit, word });
}

// Short clause for a dollar total's note; empty when every hospital has an estimate.
export function noEstimateNote(list) {
  const n = noEstimate(list);
  if (!n) return '';
  return fill(n === 1 ? 'noEstimateOne' : 'noEstimateMany', { n: fmtInt(n) });
}

// "Larger cut than N% of hospitals" for one hospital. ctx: { hospitals, byState (Map: state to its hospitals),
// sortedRed (every hospital's cut, ascending), states (state code to name) }.
export function rankLine(h, ctx) {
  const asc = (list) => list.map((y) => y.red).sort((a, b) => a - b);
  if (h.red <= 0) {
    const others = ctx.hospitals.filter((y) => y.red <= 0).length - 1;
    return fill(others === 1 ? 'rankNoneOne' : 'rankNone', { n: fmtInt(others) });
  }
  const inState = asc(ctx.byState.get(h.st));
  const inPeer = asc(ctx.hospitals.filter((y) => y.peer === h.peer));
  return fill('rankLine', {
    nation: String(rankPct(ctx.sortedRed, h.red)),
    state: String(rankPct(inState, h.red)),
    stateCount: fmtInt(inState.length),
    stateName: ctx.states[h.st],
    peer: String(rankPct(inPeer, h.red)),
    group: String(h.peer),
  });
}

// The verdict sentence. edition: { label ("FY2027"), payLong (the payment year's first day, spelled out), conditions
// (the data's condition list: key and short name) }. An inactive hospital's cut is stated without promising a year of payments.
export function summarySentence(h, meta, edition) {
  const v = verdict(h, meta);
  const base = { name: h.name, edition: edition.label };
  if (v.status === 'none-measured') {
    return fill('sumNoneMeasured', { ...base, conditions: spelled(CONDS.length), minCases: String(MIN_DISCHARGES) });
  }
  if (v.status === 'none-below') return fill('sumNoneBelow', { ...base, nMeasured: String(v.nMeasured) });
  const short = (k) => inSentence(edition.conditions.find((c) => c.key === k).short);
  if (v.status === 'none-rounded') {
    const names = v.above.map(short).join(t('and'));
    return fill('sumNoneRounded', { ...base, names: upFirst(names), share: t(v.above.length > 1 ? 'shareMany' : 'shareOne') });
  }
  const lead = h.inactive ? fill('leadInactive', { ...base, pct: fmtPct(h.red) })
    : fill('leadPaid', { name: h.name, pct: fmtPct(h.red), pay: edition.payLong });
  return lead + fill('sumPenalized', { nAbove: String(v.nAbove), nMeasured: String(v.nMeasured), top: short(v.top) });
}

// For a hospital whose Medicare agreement CMS lists as ended (the date can be missing). It stays in every ranking and total.
export function inactiveSentence(h, edition) {
  const { date, reason } = h.inactive;
  return fill('inactive', {
    ccn: h.id,
    when: date ? fill('inactiveOn', { date: fmtDate(date, 'long') }) : '',
    reason,
    edition: edition.label,
    tail: h.red > 0 ? t('inactiveTail') : '',
  });
}

// The area deck's share penalized, or noneMeasured() when none is ("it is not measured on any condition" for a
// one-hospital area, so the deck's first sentence stays whole).
const deckShare = (sm) => (sm.pctPen == null ? (sm.n === 1 ? fill('deckShareNone', { none: noneMeasured(sm) }) : noneMeasured(sm))
  : fill('deckShare', { pct: fmtPct(sm.pctPen, 0), n: fmtInt(sm.nMeasured) }));

// The deck's first sentence. Its subject is singular when one hospital takes a cut or the area has only one.
export const deckLead = (sm, label) => fill(sm.nPen === 1 || sm.n === 1 ? 'deckLeadOne' : 'deckLeadMany',
  { nPen: fmtInt(sm.nPen), hospitals: hospitals(sm.n), label, share: deckShare(sm) });

// The Penalized KPI's note: measured count and the gap to the nation, or no comparison when nothing here is measured.
export const penalizedNote = (sm, nation) => (sm.pctPen == null ? fill('penalizedNote', { n: fmtInt(sm.nMeasured) })
  : fill('penalizedNoteVs', { n: fmtInt(sm.nMeasured), vs: vsLabel(sm.pctPen, nation.pctPen, 0, t('unitPts')) }));
