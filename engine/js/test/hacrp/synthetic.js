// Synthetic HACRP rows for unit tests: every CSV column present, values made up.
import { toHospital } from '../../hacrp/hospital.js';
import { MEASURES } from '../../hacrp/measures.js';
import { zFromValue } from '../../hacrp/params.js';
import { classify, totalFromZ } from '../../hacrp/score.js';

// CMS's 4 decimals for z-scores and totals.
export const round4 = (x) => Math.round(x * 1e4) / 1e4;

// The periods every synthetic row carries.
export const SYNTH_PERIODS = {
  psi90: { start: '07/01/2022', end: '06/30/2024' },
  hai: { start: '01/01/2023', end: '12/31/2024' },
};

export function syntheticRow(overrides = {}) {
  const row = {
    'Facility Name': 'SYNTHETIC GENERAL HOSPITAL',
    'Facility ID': '000123', // state code 00 is unassigned, so no real hospital has this CCN
    State: 'AL',
    'Fiscal Year': '2026',
    'PSI 90 Start Date': SYNTH_PERIODS.psi90.start,
    'PSI 90 End Date': SYNTH_PERIODS.psi90.end,
    'HAI Measures Start Date': SYNTH_PERIODS.hai.start,
    'HAI Measures End Date': SYNTH_PERIODS.hai.end,
    'Total HAC Score': '0.1000',
    'Total HAC Score Footnote': '',
    'Payment Reduction': 'No',
    'Payment Reduction Footnote': '',
  };
  for (const m of MEASURES) {
    row[m.value] = m.id === 'PSI90' ? '1.0000' : '1.000';
    row[m.valueFootnote] = '';
    row[m.z] = '0.1000';
    row[m.zFootnote] = '';
  }
  return { ...row, ...overrides };
}

// Measure values for modelHospital that land where the what-if tests need them on the FY2026 model: below the line
// (no), above it (yes), with MRSA past CMS's cap and the rest low (capped), at the last value that keeps No
// (noCushion), and with SSI assigned (assigned).
const BASE_VALUES = Object.freeze({ PSI90: 1.0, CLABSI: 0.8, CAUTI: 0.6, SSI: 0.9, CDI: 0.5, MRSA: 0.9 });
export const SYNTH_VALUES = Object.freeze({
  no: BASE_VALUES,
  yes: Object.freeze({ PSI90: 1.05, CLABSI: 1.2, CAUTI: 0.8, SSI: 1.0, CDI: 0.6, MRSA: 1.2 }),
  capped: Object.freeze({ PSI90: 0.75, CLABSI: 0.3, CAUTI: 0.2, SSI: 0.5, CDI: 0.2, MRSA: 1.9 }),
  noCushion: Object.freeze({ ...BASE_VALUES, CLABSI: 1.073 }),
  assigned: Object.freeze({ ...BASE_VALUES, SSI: 'assigned' }),
});

// A synthetic Hospital that agrees with a fitted model, for what-if tests: each z is the model's z of the value at
// CMS's 4 decimals (CMS's worst z, zMax, for a measure marked 'assigned'), and the total is their mean. A measure
// left out of values is unscored; with none scored, the total is N/A. The decision defaults to the model's line.
export function modelHospital(model, ccn, { values, decision, state = 'AL' }) {
  const overrides = { 'Facility ID': ccn, State: state };
  const zs = [];
  for (const m of MEASURES) {
    const p = model.params[m.id];
    const v = values[m.id];
    let z = null;
    if (v === 'assigned') z = p.zMax;
    else if (v !== undefined) z = round4(zFromValue(v, p));
    if (z !== null) zs.push(z);
    overrides[m.value] = typeof v === 'number' ? v.toFixed(p.decimals) : 'N/A';
    overrides[m.valueFootnote] = v === 'assigned' ? '18' : v === undefined ? '13' : '';
    overrides[m.z] = z === null ? 'N/A' : z.toFixed(4);
    overrides[m.zFootnote] = v === 'assigned' ? '18' : v === undefined ? '5' : '';
  }
  const total = zs.length ? round4(totalFromZ(zs)) : null;
  overrides['Total HAC Score'] = total === null ? 'N/A' : total.toFixed(4);
  overrides['Payment Reduction'] = decision ?? classify(total, model.boundary);
  return toHospital(syntheticRow(overrides));
}
