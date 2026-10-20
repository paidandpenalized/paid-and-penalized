// Synthetic hospitals for the HACRP page tests: invented names, CCNs 990001-990099 (no real hospital), CMS's real
// footnote crosswalk (CMS text, no hospital in it), and a tiny model with a made-up line.
import { parseFootnotes } from '../../../engine/js/footnotes.js';
import { toHospital } from '../../../engine/js/hacrp/hospital.js';
import { MEASURES } from '../../../engine/js/hacrp/measures.js';
import { syntheticRow } from '../../../engine/js/test/hacrp/synthetic.js';
import { readPinned } from '../../../pipeline/files.js';

export const FY = 2026;
export const PERIODS = {
  psi90: { start: '07/01/2022', end: '06/30/2024' },
  hai: { start: '01/01/2023', end: '12/31/2024' },
};
export const MODEL = { boundary: { highestNo: 0.25, lowestYes: 0.2507 } };
// CMS's text for the two boundary scores, as boundaryText() reads it from the file.
export const BOUNDARY_TEXT = { highestNo: '0.2500', lowestYes: '0.2507' };
export const ESTIMATE = {
  PSI90: { tagged: true, maxError: 0.00204 },
  CLABSI: { tagged: false, maxError: 0.00061 },
  CAUTI: { tagged: false, maxError: 0.0008 },
  SSI: { tagged: false, maxError: 0.00005 },
  CDI: { tagged: true, maxError: 0.0021 },
  MRSA: { tagged: false, maxError: 0.00005 },
};
export const FOOTNOTES = parseFootnotes(readPinned('y9us-9xdf'));

// Measure cells: a measured result, one with no result (CMS's usual footnotes), and one CMS assigned.
export const measured = (value, z) => ({ value, valueFootnote: '', z, zFootnote: '' });
export const unscored = (valueFootnote = '13') => ({ value: 'N/A', valueFootnote, z: 'N/A', zFootnote: '5' });
export const assigned = (z, code = '18') => ({ value: 'N/A', valueFootnote: code, z, zFootnote: code });

export function hospital(ccn, { total, decision, totalFootnote = '', decisionFootnote = '', state = 'AL', measures }) {
  const overrides = {
    'Facility ID': ccn,
    'Facility Name': 'EXAMPLE GENERAL HOSPITAL',
    State: state,
    'Total HAC Score': total,
    'Total HAC Score Footnote': totalFootnote,
    'Payment Reduction': decision,
    'Payment Reduction Footnote': decisionFootnote,
  };
  for (const m of MEASURES) {
    const cell = measures[m.id] ?? unscored();
    overrides[m.value] = cell.value;
    overrides[m.valueFootnote] = cell.valueFootnote;
    overrides[m.z] = cell.z;
    overrides[m.zFootnote] = cell.zFootnote;
  }
  return toHospital(syntheticRow(overrides));
}

export function master(ccn, overrides = {}) {
  return {
    ccn,
    name: 'Example General Hospital',
    city: 'Exampleton',
    state: 'AL',
    county: 'Example County',
    programs: { hacrp: { inProgram: true, reason: null } },
    ...overrides,
  };
}

const NONE_SCORED = {};

// One synthetic hospital per status and per edge case. Totals are the mean of the z-scores, as CMS computes them.
export const CASES = {
  yes: hospital('990001', {
    total: '0.3000', decision: 'Yes',
    measures: {
      PSI90: measured('1.0600', '0.5000'), CLABSI: measured('0.990', '0.9000'), CAUTI: measured('0.464', '-0.2000'),
      SSI: measured('0.909', '0.1000'), CDI: measured('0.481', '0.4000'), MRSA: measured('0.745', '0.1000'),
    },
  }),
  no: hospital('990002', {
    total: '-0.1000', decision: 'No',
    measures: {
      PSI90: measured('0.9455', '-0.3000'), CLABSI: measured('0.658', '0.1200'), CAUTI: measured('0.340', '-0.5000'),
      SSI: unscored('12'), CDI: measured('0.429', '0.2000'), MRSA: measured('0.688', '-0.0200'),
    },
  }),
  maryland: hospital('990003', {
    total: '0.4000', decision: 'N/A', decisionFootnote: 'a', state: 'MD',
    measures: {
      PSI90: measured('1.0744', '0.6000'), CLABSI: measured('0.692', '0.2000'), CAUTI: measured('0.713', '0.4000'),
      SSI: measured('1.084', '0.4000'), CDI: measured('0.481', '0.4000'), MRSA: measured('0.889', '0.4000'),
    },
  }),
  noScore: hospital('990004', { total: 'N/A', totalFootnote: '5', decision: 'No', measures: NONE_SCORED }),
  yesNoScore: hospital('990005', { total: 'N/A', totalFootnote: '5', decision: 'Yes', measures: NONE_SCORED }),
  oneMeasure: hospital('990006', {
    total: '0.3500', decision: 'Yes',
    measures: { PSI90: measured('1.0386', '0.3500') },
  }),
  assignedLargest: hospital('990007', {
    total: '0.3250', decision: 'Yes',
    measures: {
      PSI90: measured('1.0028', '0.1000'), CLABSI: measured('0.434', '-0.4000'), CAUTI: measured('0.671', '0.3000'),
      SSI: assigned('2.1717'), CDI: measured('0.326', '-0.2000'), MRSA: measured('0.687', '-0.0217'),
    },
  }),
  allAssigned: hospital('990008', {
    total: '2.2091', decision: 'Yes',
    measures: { CDI: assigned('2.1931', '11'), MRSA: assigned('2.2251', '11') },
  }),
  totalFootnote: hospital('990009', {
    total: '-0.0500', totalFootnote: '23', decision: 'No',
    measures: {
      PSI90: { value: '0.9813', valueFootnote: '23', z: '-0.0500', zFootnote: '23' },
      CLABSI: measured('0.585', '-0.0500'), CAUTI: measured('0.526', '-0.0500'), SSI: measured('0.821', '-0.0500'),
      CDI: measured('0.365', '-0.0500'), MRSA: measured('0.673', '-0.0500'),
    },
  }),
};

// The view inputs for one case, as the page build passes them.
export function inputs(h, overrides = {}) {
  return { hospital: h, model: MODEL, estimate: ESTIMATE, footnotes: FOOTNOTES, master: master(h.ccn, { state: h.state }), fy: FY,
    periods: PERIODS, boundaryText: BOUNDARY_TEXT, ...overrides };
}
