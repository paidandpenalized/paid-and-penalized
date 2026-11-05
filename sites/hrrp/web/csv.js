// Ported from Thirty Day Readmissions (web/src/js/views/columns.js CSV_COLUMNS at 33d1959).
// The hospital CSV's columns, defined once: the largest-penalties file (Part 2 of the program page) and the full
// hospitals file are both built on them. Thirty Day Readmissions' 31 columns, units in the headers. The file is written by
// the shared toCsv (engine/js/csv.js): CRLF line ends, a text cell that could read as a spreadsheet formula gets a leading
// ', a numeric cell is written as the data holds it. The CCN is a text column; a spreadsheet may still drop its leading
// zero (Thirty Day Readmissions wrote ="010001", which the shared writer's formula guard does not allow).
import { CONDS, isMeasured } from '../../../engine/js/hrrp/formula.js';
import { toCsv } from '../../../engine/js/csv.js';

const text = (name, get) => ({ name, numeric: false, get });
const number = (name, get) => ({ name, numeric: true, get });

// The inactive column: the date CMS lists the agreement as ended, or a note when CMS lists none.
const inactiveCell = (h) => (h.inactive ? h.inactive.date ?? 'date not listed' : null);
const bedsSource = (h) => (h.beds == null ? null : h.bedsSrc === 'cr' ? 'cost report' : 'certified (Provider of Services file)');

// The columns in file order: get(hospital) is the cell. Stored values are already rounded by the pipeline: factor and dual
// share 4 decimals, cut 2, dollars whole, ERR at least 6 (more where needed to read as CMS's 4-decimal value when rounded).
// A condition's penalized column is blank when the hospital had too few cases to be measured on it.
export const HOSPITAL_COLUMNS = Object.freeze([
  text('CCN', (h) => h.id),
  text('Hospital', (h) => h.name),
  text('City', (h) => h.city),
  text('State', (h) => h.st),
  text('Metro area', (h) => h.cbsaName),
  number('Beds', (h) => h.beds),
  text('Beds source', bedsSource),
  text('Inactive (date)', inactiveCell),
  number('Payment adjustment factor', (h) => h.paf),
  number('Payment reduction (%)', (h) => h.red),
  number('Estimated penalty ($, modeled)', (h) => h.pen),
  number('Peer group', (h) => h.peer),
  number('Dual proportion', (h) => h.dual),
  ...CONDS.flatMap((k) => [
    number(`${k} discharges`, (h) => h.c[k]?.n),
    number(`${k} ERR`, (h) => h.c[k]?.err),
    text(`${k} penalized (Y/N)`, (h) => (isMeasured(h.c[k]) ? (h.c[k].flag === 1 ? 'Y' : 'N') : null)),
  ]),
]);

// The CSV text for hospitals (rows of the data file), in the order given.
export const hospitalCsv = (hospitals) => toCsv(HOSPITAL_COLUMNS, hospitals.map((h) => HOSPITAL_COLUMNS.map((c) => c.get(h))));

// ---------- the place CSV ----------

// The place CSV's columns, defined once (Ported from Thirty Day Readmissions, web/src/js/views/columns.js summaryCsvColumns
// at 33d1959): the "Every state" file and the area pages' files are built on them. Eight columns, units in the headers,
// with the counts behind each share: the hospitals, those measured on at least one condition, those penalized. Every share
// here is over the hospitals measured on at least one condition (a hospital measured on nothing cannot be cut). A row is
// summarize()'s result (engine/js/hrrp/summary.js) plus its label. Shares are written to a tenth of a percent, the average
// cut to two decimals, dollars to whole dollars.
const rounded = (v, dp) => (Number.isFinite(v) ? Number(v.toFixed(dp)) : null);
export const placeColumns = (label) => Object.freeze([
  text(label, (r) => r.label),
  number('Hospitals', (r) => r.n),
  number('Hospitals measured', (r) => r.nMeasured),
  number('Hospitals penalized', (r) => r.nPen),
  number('Penalized (% of measured)', (r) => rounded(r.pctPen, 1)),
  number('Average cut (%)', (r) => rounded(r.meanRed, 2)),
  number('Cut 1% or more (hospitals)', (r) => r.nGe1),
  number('Estimated penalties ($, modeled)', (r) => rounded(r.penTotal, 0)),
]);
export const PLACE_COLUMNS = placeColumns('State');

// The CSV text for places (rows as above), in the order given; label names the first column ("State", "Metro area").
export const placeCsv = (rows, label = 'State') => {
  const columns = label === 'State' ? PLACE_COLUMNS : placeColumns(label);
  return toCsv(columns, rows.map((r) => columns.map((c) => c.get(r))));
};
