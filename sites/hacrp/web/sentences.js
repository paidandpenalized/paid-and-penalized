// The plain-language layer of a hospital page, built from its view (view.js). CMS's values are said as "CMS
// reports"; this site's arithmetic as "this site recomputes". Odd rows get CMS's values and notes and nothing more.
import { REDUCTION_TEXT } from './constants.js';
import { fill } from './copy.js';

const notes = (list) => list.map((f) => f.text).join(' ');

// What CMS reports. decision: the text set in the decision's place (CMS's own, by default; a page may pass a marker to
// set it apart in markup).
export function leadSentence(view, decision = view.decision.text) {
  const facts = { fy: String(view.fy), name: view.name, decision };
  return view.scored ? fill('leadScored', { ...facts, total: view.score.text }) : fill('leadNoScore', facts);
}

// What the decision means: scored Yes or No only.
export function whySentences(view) {
  if (view.status === 'yes') return [fill('whyYes', { pct: REDUCTION_TEXT })];
  if (view.status === 'no') return [fill('whyNo')];
  return [];
}

// CMS's notes on the score and the decision, verbatim.
export function noteSentences(view) {
  const out = [];
  if (view.score.footnotes.length) out.push(fill('noteScore', { notes: notes(view.score.footnotes) }));
  if (view.decision.footnotes.length) out.push(fill('noteDecision', { notes: notes(view.decision.footnotes) }));
  return out;
}

// This site's distance from the score to CMS's line, quoting CMS's text for the line's two scores; null without one.
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

// The note beside a measure CMS assigned (its footnote text sits alongside); null for any other measure.
export function measureNote(measure) {
  return measure.assigned ? fill('assigned') : null;
}
