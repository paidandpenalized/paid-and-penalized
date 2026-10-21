// One hospital's page data: CMS's values as CMS published them (with a true minus), CMS's footnote text, and this
// site's arithmetic (distance to the line, each measure's part of the score). Plain strings only; pages escape.
import { footnoteList } from '../../../engine/js/footnotes.js';
import { isAssigned, isDecided, scoredMeasures } from '../../../engine/js/hacrp/hospital.js';
import { MEASURE_IDS } from '../../../engine/js/hacrp/measures.js';
import { SCORE_DECIMALS as DP } from '../../../engine/js/hacrp/score.js';
import { ceilToUnit, toUnit } from '../../../engine/js/stats.js';
import { cmsText, decimal, shown, signed } from '../../../web/render/format.js';
import { SITE } from '../../../web/site.js';
import { measureLabel } from './copy.js';
import { SHORT_NAMES } from './constants.js';
import { hospitalHref } from './hospital-table.js';
import { largestPart } from './whatif-text.js';

// Hospital pages live at <HOSPITALS_PATH><ccn, lowercase>/.
export const HOSPITALS_PATH = `${SITE.sites.hacrp.path}hospital/`;

const round = (x) => toUnit(x, DP);
// An error bound shown at CMS's decimals is rounded up, so the text never understates it.
const ceilText = (x) => decimal(ceilToUnit(x, DP), DP);

function status(h) {
  if (h.paymentReduction === 'N/A') return 'maryland';
  if (h.total === null) return h.paymentReduction === 'Yes' ? 'yes-no-score' : 'no-score';
  return h.paymentReduction === 'Yes' ? 'yes' : 'no';
}

function distance(st, total, { highestNo, lowestYes }) {
  if (st === 'yes') {
    const value = round(total - highestNo);
    return { to: 'highestNo', value, text: decimal(value, DP) };
  }
  if (st === 'no') {
    const value = round(lowestYes - total);
    return { to: 'lowestYes', value, text: decimal(value, DP) };
  }
  return null;
}

// CMS's own text for the two scores that bound the line: the published Total HAC Score of a hospital CMS marked No
// at highestNo, and of one it marked Yes at lowestYes. loadHacrp() reads it once; every view carries it.
export function boundaryText(hospitals, { highestNo, lowestYes }) {
  const find = (decision, total) => {
    const h = hospitals.find((x) => x.paymentReduction === decision && x.total === total);
    if (!h) throw new RangeError(`no hospital marked ${decision} at the boundary score ${total}`);
    return cmsText(h.totalText);
  };
  return { highestNo: find('No', highestNo), lowestYes: find('Yes', lowestYes) };
}

export function hospitalView({ hospital: h, model, estimate, footnotes, master, fy, periods, boundaryText: bt }) {
  if (master.ccn !== h.ccn) throw new RangeError(`master record ${master.ccn} is not hospital ${h.ccn}`);
  if (!bt) throw new TypeError('hospitalView: boundaryText is required (from boundaryText())');
  const st = status(h);
  const n = scoredMeasures(h).length;

  const measures = MEASURE_IDS.map((id) => {
    const m = h.measures[id];
    const contribution = m.z === null ? null : m.z / n;
    return {
      id,
      label: measureLabel(id),
      short: SHORT_NAMES[id],
      valueText: cmsText(m.valueText),
      zText: cmsText(m.zText),
      // CMS's text as published (hyphen-minus): a figure's table keeps it for sorting and its CSV.
      valueRaw: m.valueText,
      zRaw: m.zText,
      // Whether CMS published a number (the parsed value is null for blank and "N/A"); the page shows a dash if not.
      hasValue: m.value !== null,
      hasZ: m.z !== null,
      assigned: isAssigned(m),
      tagged: estimate[id].tagged,
      maxErrorText: ceilText(estimate[id].maxError),
      contribution,
      contributionText: contribution === null ? null : signed(contribution, DP),
      // The number that text shows, for a figure to plot.
      contributionRaw: contribution === null ? null : shown(contribution, DP),
      footnotes: footnoteList(footnotes, [m.valueFootnote, m.zFootnote].join(',')),
    };
  });

  // The measure that added most, among those with a measured result: never one CMS assigned (its view entry).
  const largest = largestPart(measures);

  const scored = h.total !== null;
  return {
    ccn: h.ccn,
    name: master.name,
    city: master.city,
    state: master.state,
    zip: master.zip ?? '',
    county: master.county,
    path: hospitalHref(HOSPITALS_PATH, h.ccn),
    fy,
    periods,
    status: st,
    // A hospital with a score gets the distance sentence, the what-if and (on a released site) indexing.
    scored,
    // Scored, with a Yes or No decision: counted in penalty sentences (the engine's isDecided).
    decided: isDecided(h),
    // CMS's Total HAC Score text ("N/A" when CMS published none) with a true minus, as published (raw), and its
    // footnotes.
    score: { text: cmsText(h.totalText), raw: h.totalText, footnotes: footnoteList(footnotes, h.totalFootnote) },
    decision: { text: h.paymentReduction, footnotes: footnoteList(footnotes, h.paymentReductionFootnote) },
    distance: scored ? distance(st, h.total, model.boundary) : null,
    boundaryText: bt,
    n,
    oneMeasure: n === 1,
    measures,
    largest,
  };
}

// Per state (the master's code), over hospital views: { hospitals, decided (scored, Yes or No: the view's decided),
// yes, na (scored, decision N/A) }. The program page's tile grid draws it (figures.js statesFigure).
export function stateCounts(views) {
  const out = {};
  for (const v of views) {
    const s = (out[v.state] ??= { hospitals: 0, decided: 0, yes: 0, na: 0 });
    s.hospitals += 1;
    if (v.decided) {
      s.decided += 1;
      if (v.decision.text === 'Yes') s.yes += 1;
    }
    if (v.scored && v.decision.text === 'N/A') s.na += 1;
  }
  return out;
}
