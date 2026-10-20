// Synthetic HACRP rows for unit tests: every CSV column present, values made up.
import { MEASURES } from '../../hacrp/measures.js';

export function syntheticRow(overrides = {}) {
  const row = {
    'Facility Name': 'SYNTHETIC GENERAL HOSPITAL',
    'Facility ID': '000123', // state code 00 is unassigned, so no real hospital has this CCN
    State: 'AL',
    'Fiscal Year': '2026',
    'PSI 90 Start Date': '07/01/2022',
    'PSI 90 End Date': '06/30/2024',
    'HAI Measures Start Date': '01/01/2023',
    'HAI Measures End Date': '12/31/2024',
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
