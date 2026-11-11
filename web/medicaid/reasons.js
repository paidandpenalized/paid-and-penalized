// A Medicaid work-requirement reason (engine/js/medicaid/hospital.js reasonOf) in words: its stamp and its sentence
// (copy.js), as the work-requirement pages and the hub's hospital pages both give them. Pure: no DOM, file or clock.
import { fill, t } from './copy.js';

// The stamp each reason gets (copy stamp_<group>).
const REASON_STAMP = Object.freeze({
  away_inactive: 'away', away_kind: 'away', not_expansion: 'none', no_viii_group: 'none', all_payer: 'notModeled', territory: 'notModeled',
  no_cost_report: 'noReport', negative: 'screened', exceeds: 'screened', no_medicaid: 'noLoss', no_npr: 'noLoss', no_share: 'noLoss', tiny: 'noLoss',
  unforeseen: 'noLoss', // the browser's fallback only (reasonOf's lenient)
});
// Every reason a build may give (unforeseen is the browser's alone).
export const REASONS = Object.freeze(Object.keys(REASON_STAMP).filter((r) => r !== 'unforeseen'));

export const reasonStamp = (reason) => t(`stamp_${REASON_STAMP[reason]}`);

// The reason's sentence. at: { stateName, fy }: the hospital's state's name (a class's sentence names it) and the cost
// reports' year (a cost report's sentence gives it); each sentence takes only what it names.
const NAMES_STATE = new Set(['not_expansion', 'no_viii_group']);
const NAMES_NOTHING = new Set(['away_inactive', 'away_kind', 'all_payer', 'territory', 'no_share', 'unforeseen']);
export function reasonWhy(reason, { stateName, fy }) {
  if (!(reason in REASON_STAMP)) throw new RangeError(`no words for the reason "${reason}"`);
  if (NAMES_STATE.has(reason)) return fill(`why_${reason}`, { state: stateName });
  return fill(`why_${reason}`, NAMES_NOTHING.has(reason) ? {} : { fy: String(fy) });
}
