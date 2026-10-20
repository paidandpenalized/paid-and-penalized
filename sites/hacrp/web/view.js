// One hospital's page data: CMS's values as CMS published them (with a true minus), CMS's footnote text, and this
// site's arithmetic (distance to the line, each measure's part of the score). Plain strings only; pages escape.
import { footnoteList } from '../../../engine/js/footnotes.js';
import { isAssigned, scoredMeasures } from '../../../engine/js/hacrp/hospital.js';
import { MEASURE_IDS } from '../../../engine/js/hacrp/measures.js';
import { cmsText, decimal, signed } from '../../../web/render/format.js';
import { COPY } from './copy.js';
import { SHORT_NAMES } from './constants.js';

const DP = 4;
const round = (x) => Math.round(x * 10 ** DP) / 10 ** DP;
// An error bound shown at 4 decimals is rounded up, so the text never understates it.
const ceilText = (x) => decimal(Math.ceil(x * 10 ** DP - 1e-9) / 10 ** DP, DP);
const upperFirst = (s) => s[0].toUpperCase() + s.slice(1);

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

export function hospitalView({ hospital: h, model, estimate, footnotes, master, fy, periods, released }) {
  if (master.ccn !== h.ccn) throw new RangeError(`master record ${master.ccn} is not hospital ${h.ccn}`);
  const st = status(h);
  const n = scoredMeasures(h).length;
  const totalFootnotes = footnoteList(footnotes, h.totalFootnote);

  const measures = MEASURE_IDS.map((id) => {
    const m = h.measures[id];
    const contribution = m.z === null ? null : m.z / n;
    return {
      id,
      label: upperFirst(COPY[`measure${id}`].text),
      short: SHORT_NAMES[id],
      valueText: cmsText(m.valueText),
      zText: cmsText(m.zText),
      assigned: isAssigned(m),
      tagged: estimate[id].tagged,
      maxErrorText: ceilText(estimate[id].maxError),
      contribution,
      contributionText: contribution === null ? null : signed(contribution, DP),
      footnotes: footnoteList(footnotes, [m.valueFootnote, m.zFootnote].join(',')),
    };
  });

  // The measure that added most, among those with a measured result: never one CMS assigned.
  let largest = null;
  for (const m of measures) {
    if (m.assigned || m.contribution === null || m.contribution <= 0) continue;
    if (!largest || m.contribution > largest.contribution) largest = m;
  }

  const scored = h.total !== null;
  return {
    ccn: h.ccn,
    name: master.name,
    city: master.city,
    state: master.state,
    county: master.county,
    path: `/hacrp/hospital/${h.ccn.toLowerCase()}/`,
    indexable: released === true && scored,
    fy,
    periods,
    status: st,
    total: scored ? { text: cmsText(h.totalText), footnotes: totalFootnotes } : null,
    noScore: scored ? null : { text: h.totalText, footnotes: totalFootnotes },
    decision: { text: h.paymentReduction, footnotes: footnoteList(footnotes, h.paymentReductionFootnote) },
    distance: scored ? distance(st, h.total, model.boundary) : null,
    n,
    oneMeasure: n === 1,
    measures,
    largest: largest && { id: largest.id, contributionText: largest.contributionText },
    whatIf: scored,
  };
}
