// The note on a hub or HACRP hospital page for a hospital whose Medicare agreement CMS lists as ended (the hospital
// master's `inactive`, from CMS's Provider of Services file) by the end of the fiscal year its dollars are for, as the
// Readmissions pages say it of theirs. The hospital stays in every total; the note says what its dollars likely were.
import { COPY } from '../copy.js';
import { fillCopy } from './components.js';
import { isoDate } from './format.js';

const fill = (key, values) => fillCopy(COPY, key, values);

// The sentence for when the agreement ended, and its tail for the page's dollars: a cut or a bonus.
const WHEN = {
  before: { key: 'closedBefore', cut: 'closedTailBeforeCut', bonus: 'closedTailBeforeBonus' },
  during: { key: 'closedDuring', cut: 'closedTailDuringCut', bonus: 'closedTailDuringBonus' },
};

// ccn: the hospital's; inactive: the master's { date (YYYY-MM-DD or null), reason } or null; fy: the dollars' fiscal year
// (October 1 of the year before to September 30); dollars: the page's estimated dollars it qualifies (negative a cut,
// positive a bonus, 0 or none for neither). '' for a hospital whose agreement had not ended by the year's end.
export function closedNote({ ccn, inactive, fy, dollars = 0 }) {
  if (!inactive) return '';
  const { date, reason } = inactive;
  if (!date) return fill('closedUndated', { ccn, reason });
  if (date > `${fy}-09-30`) return '';
  const when = WHEN[date < `${fy - 1}-10-01` ? 'before' : 'during'];
  const tail = dollars < 0 ? when.cut : dollars > 0 ? when.bonus : null;
  return fill(when.key, { ccn, date: isoDate(date), reason, fy: String(fy), tail: tail ? fill(tail) : '' });
}
