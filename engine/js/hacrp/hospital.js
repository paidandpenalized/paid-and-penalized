// One row of CMS's HACRP hospital file -> a Hospital record. Numbers are parsed; CMS's own text is kept
// alongside so pages can show CMS's decimals and footnotes verbatim.
import { MEASURES, MEASURE_IDS } from './measures.js';

const FLAGS = new Set(['Yes', 'No', 'N/A']);
const DECIMAL = /^-?\d+(\.\d+)?$/;

function column(row, name) {
  const text = row[name];
  if (text === undefined) throw new RangeError(`HACRP: missing column "${name}"`);
  return text;
}

function number(row, name) {
  const text = column(row, name);
  if (text === '' || text === 'N/A') return null;
  if (!DECIMAL.test(text)) throw new RangeError(`HACRP: "${name}" is not a number: "${text}"`);
  return Number(text);
}

export function toHospital(row) {
  const paymentReduction = column(row, 'Payment Reduction');
  if (!FLAGS.has(paymentReduction)) throw new RangeError(`HACRP: unexpected Payment Reduction "${paymentReduction}"`);

  const measures = {};
  for (const m of MEASURES) {
    measures[m.id] = {
      value: number(row, m.value),
      valueText: column(row, m.value),
      valueFootnote: column(row, m.valueFootnote),
      z: number(row, m.z),
      zText: column(row, m.z),
      zFootnote: column(row, m.zFootnote),
    };
  }

  return {
    ccn: column(row, 'Facility ID'),
    name: column(row, 'Facility Name'),
    state: column(row, 'State'),
    fiscalYear: column(row, 'Fiscal Year'),
    measures,
    total: number(row, 'Total HAC Score'),
    totalText: column(row, 'Total HAC Score'),
    totalFootnote: column(row, 'Total HAC Score Footnote'),
    paymentReduction,
    paymentReductionFootnote: column(row, 'Payment Reduction Footnote'),
    periods: {
      psi90: { start: column(row, 'PSI 90 Start Date'), end: column(row, 'PSI 90 End Date') },
      hai: { start: column(row, 'HAI Measures Start Date'), end: column(row, 'HAI Measures End Date') },
    },
  };
}

// Measures that count toward the hospital's score: those with a published z-score.
export function scoredMeasures(hospital) {
  return MEASURE_IDS.filter((id) => hospital.measures[id].z !== null);
}

// CMS assigned the worst z-score because the hospital didn't submit the measure: a z with no published value.
export function isAssigned(measure) {
  return measure.z !== null && measure.value === null;
}
