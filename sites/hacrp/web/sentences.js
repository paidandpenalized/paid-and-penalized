// The plain-language layer of a hospital page, built from its view (view.js). CMS's values are said as "CMS
// reports"; this site's arithmetic as "this site recomputes". Odd rows get CMS's values and notes and nothing more.
import { REDUCTION_TEXT } from './constants.js';
import { fill, t } from './copy.js';

const notes = (list) => list.map((f) => f.text).join(' ');

// What CMS reports, CMS's notes, what the decision means (scored Yes/No only), then what the score is.
export function summary(view) {
  const facts = { fy: String(view.fy), name: view.name, decision: view.decision.text };
  const out = [view.scored
    ? fill('leadScored', { ...facts, total: view.score.text })
    : fill('leadNoScore', facts)];
  if (view.score.footnotes.length) out.push(fill('noteScore', { notes: notes(view.score.footnotes) }));
  if (view.decision.footnotes.length) out.push(fill('noteDecision', { notes: notes(view.decision.footnotes) }));
  if (view.status === 'yes') out.push(fill('whyYes', { pct: REDUCTION_TEXT }));
  if (view.status === 'no') out.push(fill('whyNo'));
  out.push(fill('scoreIs'), fill('notAGrade'));
  return out;
}

export function distanceSentence(view) {
  const d = view.distance;
  if (!d) return null;
  const { highestNo, lowestYes } = view.boundaryText;
  return d.to === 'highestNo'
    ? fill('distanceYes', { distance: d.text, highestNo })
    : fill('distanceNo', { distance: d.text, lowestYes });
}

export function smallNumber(view) {
  return view.oneMeasure ? fill('oneMeasure') : null;
}

export function largestSentence(view) {
  if (!view.largest) return null;
  const { id, short, contributionText } = view.largest;
  return fill('largest', { label: t(`measure${id}`), short, contribution: contributionText });
}

// The note beside a measure CMS assigned (its footnote text sits alongside); null for any other measure.
export function measureNote(measure) {
  return measure.assigned ? fill('assigned') : null;
}
