// The note on a hub or HACRP hospital page for a hospital whose Medicare agreement CMS lists as ended (the hospital
// master's `inactive`, from CMS's Provider of Services file) by the end of the fiscal year its dollars are for, as the
// Readmissions pages say it of theirs. The hospital stays in every total; the note says what its dollars likely were.
import { COPY } from '../copy.js';
import { fillCopy } from './components.js';
import { isoDate } from './format.js';

const fill = (key, values) => fillCopy(COPY, key, values);

// ccn: the hospital's; inactive: the master's { date (YYYY-MM-DD or null), reason } or null; fy: the dollars' fiscal year
// (October 1 of the year before to September 30); dollars: the page's estimated dollars it qualifies (negative a cut,
// positive a bonus, 0 or none for neither). '' for a hospital whose agreement had not ended by the year's end.
export function closedNote({ ccn, inactive, fy, dollars = 0 }) {
  if (!inactive) return '';
  const { date, reason } = inactive;
  if (!date) return fill('closedUndated', { ccn, reason });
  if (date > `${fy}-09-30`) return '';
  const when = date < `${fy - 1}-10-01` ? 'Before' : 'During';
  const kind = dollars < 0 ? 'Cut' : dollars > 0 ? 'Bonus' : null;
  return fill(`closed${when}`, { ccn, date: isoDate(date), reason, fy: String(fy), tail: kind ? fill(`closedTail${when}${kind}`) : '' });
}
