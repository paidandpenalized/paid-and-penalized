// What the programs' rules fix, and each program's one-sentence dek. The method constants are CMS's rules, the only
// numbers the deks carry: they are written here, not in the copy (web/copy.js has no digit and no number word), and a
// dek prints them through the page's own percent format, or in words where the sentence reads better so.
import { HAC_RATE } from '../engine/js/dollars/whatif.js';
import { has } from '../engine/js/has.js';
import { COPY } from './copy.js';
import { fillCopy } from './render/components.js';
import { fractionWord, pct, spelled } from './render/format.js';

// The most Readmissions can cut a hospital's payments, as a percent of its base payments (the 3% cap).
export const HRRP_CAP_PCT = 3;
// The flat cut hospital-acquired conditions makes to the quarter of hospitals with the highest scores, as a percent of
// their payments: the engine's HAC_RATE (the dollar estimates' own), so the dek and the arithmetic name one rate.
export const HAC_CUT_PCT = HAC_RATE * 100;
// The share of each hospital's base payments value-based purchasing holds back, as a percent, and pays out by score.
export const VBP_WITHHOLD_PCT = 2;

// How long after leaving the hospital Readmissions counts a return, in days.
export const HRRP_WINDOW_DAYS = 30;
// The share of hospitals, from the highest score down, that hospital-acquired conditions cuts: the top quarter.
export const HAC_TOP_SHARE = 0.25;
// The share of its yearly payment increase a hospital loses for not reporting quality data (Quality reporting), and for
// missing electronic health record requirements (Electronic health records).
export const IQR_REDUCTION_SHARE = 0.25;
export const PI_REDUCTION_SHARE = 0.75;
// The number of surgeries whose episodes the surgical episodes program measures.
export const TEAM_SURGERIES = 5;

// A rule's percent as the page writes it: percent(3) is "3%".
const percent = (n) => pct(n / 100, 0);

// The dek of each program, by id: its copy key, and the values that fill the key's placeholders.
const DEKS = {
  hrrp: ['dekHrrp', () => ({ cap: percent(HRRP_CAP_PCT), days: spelled(HRRP_WINDOW_DAYS) })],
  hacrp: ['dekHacrp', () => ({ cut: percent(HAC_CUT_PCT), top: fractionWord(HAC_TOP_SHARE, 'the') })],
  hvbp: ['dekHvbp', () => ({ withhold: percent(VBP_WITHHOLD_PCT) })],
  'wage-index': ['dekWageIndex'],
  dsh: ['dekDsh'],
  ime: ['dekIme'],
  iqr: ['dekIqr', () => ({ share: fractionWord(IQR_REDUCTION_SHARE) })],
  pi: ['dekPi', () => ({ share: fractionWord(PI_REDUCTION_SHARE) })],
  team: ['dekTeam', () => ({ surgeries: spelled(TEAM_SURGERIES) })],
};

// The one-sentence dek of the program with this id (SITE.programs), as plain text. An unknown id throws.
export function programDek(id) {
  if (typeof id !== 'string' || !has(DEKS, id)) throw new RangeError(`programDek: no program "${id}"`);
  const [key, values] = DEKS[id];
  return fillCopy(COPY, key, values?.());
}
