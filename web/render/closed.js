// The note on a hub or HACRP hospital page for a hospital whose Medicare agreement CMS lists as ended (the hospital
// master's `inactive`, from CMS's Provider of Services file) by the end of the fiscal year its dollars are for: the kind of
// note the Readmissions pages carry (sites/hrrp/web/wording.js inactiveSentence, which speaks of a coming year), said of a
// year that has passed. The hospital stays in every total; the note says what its dollars likely were.
import { COPY } from '../copy.js';
import { fillAround, fillCopy } from './components.js';
import { isoDate } from './format.js';
import { html } from './html.js';

const fill = (key, values) => fillCopy(COPY, key, values);

// The sentence for when the agreement ended, and its tail for the page's dollars: a cut or a bonus.
const WHEN = {
  before: { key: 'closedBefore', cut: 'closedTailBeforeCut', bonus: 'closedTailBeforeBonus' },
  during: { key: 'closedDuring', cut: 'closedTailDuringCut', bonus: 'closedTailDuringBonus' },
};

// The note's copy key, the words for its placeholders and its tail's words apart ('' for none, null for a note with no
// place for one), or null for a hospital whose agreement had not ended by the year's end. ccn: the hospital's; inactive:
// the master's { date (YYYY-MM-DD or null), reason } or null; fy: the dollars' fiscal year (October 1 of the year before
// to September 30); dollars: the page's estimated dollars it qualifies (negative a cut, positive a bonus, 0 or none for
// neither).
function noteOf({ ccn, inactive, fy, dollars = 0 }) {
  if (!inactive) return null;
  const { date, reason } = inactive;
  if (!date) return { key: 'closedUndated', values: { ccn, reason }, tail: null };
  if (date > `${fy}-09-30`) return null;
  const when = WHEN[date < `${fy - 1}-10-01` ? 'before' : 'during'];
  const tail = dollars < 0 ? when.cut : dollars > 0 ? when.bonus : null;
  return { key: when.key, values: { ccn, date: isoDate(date), reason, fy: String(fy) }, tail: tail ? fill(tail) : '' };
}

// The note as text; '' for a hospital whose agreement had not ended by the year's end.
export function closedNote(args) {
  const note = noteOf(args);
  if (!note) return '';
  return fill(note.key, note.tail === null ? note.values : { ...note.values, tail: note.tail });
}

// The note as markup, its tail (what the page's dollars likely were) in a span of class tailClass, so a page whose reader
// can change those dollars hides the tail alone and keeps the sentence on when the agreement ended; '' as closedNote.
export function closedNoteMarkup(args, tailClass) {
  const note = noteOf(args);
  if (!note) return '';
  if (!note.tail) return html`${closedNote(args)}`;
  return fillAround((marks) => fill(note.key, { ...note.values, ...marks }), { tail: html`<span class="${tailClass}">${note.tail}</span>` });
}
