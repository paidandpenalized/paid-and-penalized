// The dataset CSV: one row per hospital in CMS's HACRP file, with CMS's text as CMS wrote it (hyphen-minus, CMS's
// decimals, "N/A", footnote codes), the hospital's name and place from the hospital master, then this site's dollar
// estimates in columns named "_modeled" (whole dollars; blank where there is no estimate). Written by the shared toCsv
// (engine/js/csv.js), so a text cell that could read as a spreadsheet formula gets a leading '.
// sites/hacrp/DATA-DICTIONARY.md documents every column; a test keeps the two in step.
import { toCsv } from '../../../engine/js/csv.js';
import { MEASURES } from '../../../engine/js/hacrp/measures.js';
import { fillCopy } from '../../../web/render/components.js';
import { isoDate } from '../../../web/render/format.js';

// Bump when a column is added, removed, renamed or changes meaning (the dictionary states it).
export const CSV_SCHEMA_VERSION = 2;

const text = (name, get) => ({ name, numeric: false, get });
const number = (name, get) => ({ name, numeric: true, get });

// A dollar column: the estimated row's whole dollars as JavaScript writes them, blank without an estimate.
const modeled = (name, key) => number(name, (h, m, d) => (d?.status === 'estimated' ? String(d[key]) : ''));

// The columns, in file order. get(hospital, masterRecord, dollarRow) returns the cell (dollarRow: the hospital's row
// of the dollar estimates, or null).
export const COLUMNS = [
  text('ccn', (h) => h.ccn),
  text('fiscal_year', (h) => h.fiscalYear),
  text('name', (h, m) => m.name),
  text('city', (h, m) => m.city),
  text('state', (h, m) => m.state),
  text('county', (h, m) => m.county),
  number('total_hac_score', (h) => h.totalText),
  text('payment_reduction', (h) => h.paymentReduction),
  text('payment_reduction_footnote', (h) => h.paymentReductionFootnote),
  text('total_footnote', (h) => h.totalFootnote),
  ...MEASURES.flatMap(({ id }) => {
    const k = id.toLowerCase();
    return [
      number(`${k}_value`, (h) => h.measures[id].valueText),
      text(`${k}_value_footnote`, (h) => h.measures[id].valueFootnote),
      number(`${k}_z`, (h) => h.measures[id].zText),
      text(`${k}_z_footnote`, (h) => h.measures[id].zFootnote),
    ];
  }),
  text('psi90_start', (h) => h.periods.psi90.start),
  text('psi90_end', (h) => h.periods.psi90.end),
  text('hai_start', (h) => h.periods.hai.start),
  text('hai_end', (h) => h.periods.hai.end),
  text('dollars_status', (h, m, d) => d?.status ?? ''),
  modeled('inpatient_payment_modeled', 'total'),
  modeled('hrrp_dollars_modeled', 'hrrp'),
  modeled('hvbp_dollars_modeled', 'hvbp'),
  modeled('hac_at_stake_modeled', 'atStake'),
  modeled('hac_dollars_modeled', 'hac'),
  modeled('net_dollars_modeled', 'net'),
];

// hospitals: the emitted file's hospitals, in its order. master: Map of CCN -> hospital master record. dollars: Map of
// CCN -> row of the dollar estimates (the build's has every hospital; a hospital without one gets blank dollar cells).
export function hospitalsCsv(hospitals, master, dollars = new Map()) {
  const rows = hospitals.map((h) => {
    const record = master.get(h.ccn);
    if (!record) throw new RangeError(`CSV: CCN ${h.ccn} has no hospital master record`);
    const d = dollars.get(h.ccn) ?? null;
    return COLUMNS.map((c) => c.get(h, record, d));
  });
  return toCsv(COLUMNS, rows);
}

// The dictionary file with its fiscal year, CMS's dataset id and title (from the pinned manifest) and the release
// date (worded as the pages' source line words it) filled in, so none of them is typed twice. fillCopy's rules hold:
// an unknown placeholder, a missing value, or a value the file doesn't use throws.
export function dictionaryText(raw, { fy, source }) {
  const { id, title, pdcReleased } = source;
  return fillCopy({ dictionary: raw }, 'dictionary', {
    fy: String(fy), source_id: id, source_title: title, pdc_released: pdcReleased && isoDate(pdcReleased),
  }, { plain: true });
}
