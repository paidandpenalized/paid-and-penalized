// The plain-language layer of a hospital page, built from its view (view.js). CMS's values are said as "CMS
// reports"; this site's arithmetic as "this site recomputes". Odd rows get CMS's values and notes and nothing more.
import { MEASURE_IDS } from '../../../engine/js/hacrp/measures.js';
import { count, decimal, pct } from '../../../web/render/format.js';
import { REDUCTION_PCT } from './constants.js';
import { COPY, fill } from './copy.js';

const DP = 4;
const notes = (list) => list.map((f) => f.text).join(' ');

// What CMS reports, CMS's notes, what the decision means (scored Yes/No only), then what the score is.
export function summary(view) {
  const facts = { fy: String(view.fy), name: view.name, decision: view.decision.text };
  const out = [view.total
    ? fill('leadScored', { ...facts, total: view.total.text })
    : fill('leadNoScore', facts)];
  const scoreNotes = (view.total ?? view.noScore).footnotes;
  if (scoreNotes.length) out.push(fill('noteScore', { notes: notes(scoreNotes) }));
  if (view.decision.footnotes.length) out.push(fill('noteDecision', { notes: notes(view.decision.footnotes) }));
  if (view.status === 'yes') out.push(fill('whyYes', { pct: pct(REDUCTION_PCT / 100, 0) }));
  if (view.status === 'no') out.push(fill('whyNo'));
  out.push(fill('scoreIs', { measureCount: count(MEASURE_IDS.length) }));
  return out;
}

export function distanceSentence(view, model) {
  const d = view.distance;
  if (!d) return null;
  const { highestNo, lowestYes } = model.boundary;
  return d.to === 'highestNo'
    ? fill('distanceYes', { distance: d.text, highestNo: decimal(highestNo, DP) })
    : fill('distanceNo', { distance: d.text, lowestYes: decimal(lowestYes, DP) });
}

export function smallNumber(view) {
  return view.oneMeasure ? fill('oneMeasure') : null;
}

export function largestSentence(view) {
  if (!view.largest) return null;
  const { id, contributionText } = view.largest;
  const m = view.measures.find((x) => x.id === id);
  return fill('largest', { label: COPY[`measure${id}`].text, short: m.short, contribution: contributionText });
}

// The note beside a measure CMS assigned (its footnote text sits alongside); null for any other measure.
export function measureNote(measure) {
  return measure.assigned ? fill('assigned') : null;
}
