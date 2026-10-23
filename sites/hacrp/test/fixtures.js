// Synthetic hospitals for the HACRP page tests: invented names, CCNs 990001-990099 (no real hospital), CMS's real
// footnote crosswalk (CMS text, no hospital in it), and a tiny model with a made-up line.
import assert from 'node:assert/strict';
import { parseFootnotes } from '../../../engine/js/footnotes.js';
import { toHospital } from '../../../engine/js/hacrp/hospital.js';
import { MEASURES } from '../../../engine/js/hacrp/measures.js';
import { SYNTH_PERIODS, syntheticRow } from '../../../engine/js/test/hacrp/synthetic.js';
import { readPinned } from '../../../pipeline/files.js';
import { hospitalMoney } from '../web/money.js';
import { whatIfTexts } from '../web/whatif-text.js';

export const FY = 2026;
// The dollars of a page with no estimate (the impact file has no usable row for the hospital): what a synthetic
// hospital's page takes, since no row of the dollar estimates covers it.
export const NO_ESTIMATE = hospitalMoney({ status: 'no-inputs', cut: false });
// Asset paths for rendering pages: the CSS, the shared scripts and both HACRP page scripts.
export const ASSETS = { css: '/assets/site.test.css', js: { theme: '/assets/theme.test.js', figure: '/assets/figure.test.js', cite: '/assets/cite.test.js', share: '/assets/share.test.js', topbar: '/assets/topbar.test.js', 'hacrp-program': '/assets/hacrp-program.test.js', 'hacrp-place': '/assets/hacrp-place.test.js','hacrp-hospital': '/assets/hacrp-hospital.test.js', 'hacrp-search': '/assets/hacrp-search.test.js' } };
export const PERIODS = SYNTH_PERIODS;
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

// The two standing lines, verbatim (Global Constraints): under every flag, and under every what-if.
export const STANDING = "A penalty reflects how CMS’s formula scored relative performance; it is not a verdict on the quality of care.";
export const WHATIF_STANDING = "A what-if shows the formula’s arithmetic, not what a hospital could realistically change or how. "
  + "CMS’s real result also depends on other hospitals.";

// A page's markup as the words a reader sees. markupText: each tag a space, the word joiners (which keep a range on one
// line) gone, white space collapsed. strippedText: each tag removed, the escapes of & and ' undone, white space collapsed.
export const markupText = (safe) => String(safe).replace(/<[^>]+>/g, ' ').replace(/\u2060/g, '').replace(/\s+/g, ' ');
export const strippedText = (s) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/\s+/g, ' ');

// HTML escaping, written out on its own so the tests check web/render/html.js rather than reuse it.
export const esc = (s) => s.replaceAll('&', '&amp;').replaceAll("'", '&#39;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

// The first pinned row with a property; fails the test, naming the property, if there is none.
export function pick(hospitals, pred, what) {
  const h = hospitals.find(pred);
  assert.ok(h, `no pinned row: ${what}`);
  return h;
}

// The what-if's words for a synthetic hospital on a hospital page (data: loadHacrp()). A sandbox passes name null,
// its path and baseline 'sandbox'.
export const textsFor = (data, h, { name = 'Example General Hospital', path = `/hacrp/hospital/${h.ccn.toLowerCase()}/`, baseline = 'cms' } = {}) =>
  whatIfTexts({ hospital: h, model: data.model, name, fy: data.fy, path, source: data.source, boundaryText: data.boundaryText, baseline });
