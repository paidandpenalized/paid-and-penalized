// What the programs' rules fix, and each program's one-sentence dek. The method constants are CMS's rules, the only
// numbers the deks carry: they are written here, not in the copy (web/copy.js has no digit), and a dek prints them
// through the page's own percent format.
import { has } from '../engine/js/has.js';
import { COPY } from './copy.js';
import { fillCopy } from './render/components.js';
import { pct } from './render/format.js';

// The most Readmissions can cut a hospital's payments, as a percent of its base payments (the 3% cap).
export const HRRP_CAP_PCT = 3;
// The flat cut hospital-acquired conditions makes to the quarter of hospitals with the highest scores, as a percent of
// their payments.
export const HAC_CUT_PCT = 1;
// The share of each hospital's base payments value-based purchasing holds back, as a percent, and pays out by score.
export const VBP_WITHHOLD_PCT = 2;

// A rule's percent as the page writes it: percent(3) is "3%".
const percent = (n) => pct(n / 100, 0);

// The dek of each program, by id: its copy key, and the values that fill the key's placeholders.
const DEKS = {
  hrrp: ['dekHrrp', () => ({ cap: percent(HRRP_CAP_PCT) })],
  hacrp: ['dekHacrp', () => ({ cut: percent(HAC_CUT_PCT) })],
  hvbp: ['dekHvbp', () => ({ withhold: percent(VBP_WITHHOLD_PCT) })],
  'wage-index': ['dekWageIndex'],
  dsh: ['dekDsh'],
  ime: ['dekIme'],
  iqr: ['dekIqr'],
  pi: ['dekPi'],
  team: ['dekTeam'],
};

// The one-sentence dek of the program with this id (SITE.programs), as plain text. An unknown id throws.
export function programDek(id) {
  if (typeof id !== 'string' || !has(DEKS, id)) throw new RangeError(`programDek: no program "${id}"`);
  const [key, values] = DEKS[id];
  return fillCopy(COPY, key, values?.());
}
