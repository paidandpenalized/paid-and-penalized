// HACRP history emitted data: CMS's hospital file for every program year (earlier years from CMS's archives, the
// newest from the current pin), each row in one shape with CMS's text kept as written: the CCN, state, Total HAC
// Score, payment decision, then the z-score of each measure the year's file has and, for years scored in domains,
// the two domain scores. Pure: files and manifest in, object out.
import { MEASURE_IDS } from '../../../engine/js/hacrp/measures.js';
import { fileShape, normalName, noted, partColumn, ruleFor } from '../../../engine/js/hacrp/eras.js';
import { envelope } from '../../../pipeline/contract.js';

export const HISTORY_SCHEMA_VERSION = 1;
export const HISTORY_METHODS_VERSION = 1;
export const historyPath = (fy) => `data/emitted/hacrp-history/fy${fy}/hacrp_history.json`;

// The pinned file for each program year, by manifest id, oldest first. The newest is the current year's pin (the
// same file data/emitted/hacrp is built from).
export const HISTORY_PINS = Object.freeze([
  { fy: 2015, id: 'hacrp-fy2015', cutList: 'hacrp-fy2015-cut-list' },
  { fy: 2016, id: 'hacrp-fy2016', cutList: 'hacrp-fy2016-cut-list' },
  ...[2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025].map((fy) => ({ fy, id: `hacrp-fy${fy}` })),
  { fy: 2026, id: 'yq43-i98g' },
]);

// Care Compare's infection results for single calendar years (pinned extracts, pipeline/py/pp_pipeline/hai_extract.py):
// one row per hospital, each HAI measure's SIR and its observed and predicted counts, CMS's text. CY2020 has no
// full-year file (CMS excused the first half of 2020).
export const HAI_PINS = Object.freeze([2017, 2018, 2019, 2021, 2022, 2023, 2024].map((cy) => ({ cy, id: `hai-cy${cy}` })));
// Care Compare's HAI measure numbers, as this site names them.
export const HAI_MEASURES = Object.freeze([['CLABSI', 1], ['CAUTI', 2], ['SSI_COLON', 3], ['SSI_HYST', 4], ['MRSA', 5], ['CDI', 6]]);

const DEC = /^\d+(\.\d+)?$/;
const round3 = (x) => Math.round(x * 1000) / 1000;
// One year's extract -> the nation's results per measure: hospitals with an SIR and their median SIR; and, over
// hospitals with both counts, the sums of observed and predicted infections (their ratio is the nation's pooled SIR).
export function infectionYear(cy, rows) {
  const dates = new Set(rows.map((r) => `${r.start} ${r.end}`));
  if (dates.size !== 1 || !dates.has(`${cy}-01-01 ${cy}-12-31`)) throw new RangeError(`HAI CY${cy}: the extract's period is ${[...dates].join(', ')}`);
  const measures = {};
  for (const [id, k] of HAI_MEASURES) {
    const sirs = rows.map((r) => r[`hai_${k}_sir`]).filter((v) => DEC.test(v)).map(Number).sort((a, b) => a - b);
    const both = rows.filter((r) => DEC.test(r[`hai_${k}_observed`]) && DEC.test(r[`hai_${k}_predicted`]));
    const mid = sirs.length >> 1;
    measures[id] = {
      hospitals: sirs.length,
      median: sirs.length ? round3(sirs.length % 2 ? sirs[mid] : (sirs[mid - 1] + sirs[mid]) / 2) : null,
      counted: both.length,
      observed: both.reduce((n, r) => n + Number(r[`hai_${k}_observed`]), 0),
      predicted: round3(both.reduce((n, r) => n + Number(r[`hai_${k}_predicted`]), 0)),
    };
  }
  return { cy, measures };
}

// CMS's cut list for a year whose hospital file has no payment column (FY2015 and FY2016): a tab-separated text file
// with a title line, a header naming "CMS Certification Number", "Top 25th Percentile" and "Total HAC Score" (and,
// FY2016, "State"), one row per CCN, and notes after. -> Map(ccn -> { flag: 'Yes' | 'No' | 'N/A', total, state }),
// CMS's text for the total and the state ('' when the list has no state column).
const FLAG = { Y: 'Yes', N: 'No', 'N/A': 'N/A' };
export function cutListFlags(text) {
  const lines = text.split(/\r?\n/).map((l) => l.split('\t').map((c) => c.trim()));
  const head = lines.findIndex((c) => c[0].startsWith('CMS Certification Number'));
  if (head < 0) throw new RangeError('cut list: no header row');
  const col = lines[head].indexOf('Top 25th Percentile');
  const totalCol = lines[head].findIndex((h) => h.startsWith('Total HAC Score'));
  const stateCol = lines[head].indexOf('State');
  if (col < 0 || totalCol < 0) throw new RangeError('cut list: no "Top 25th Percentile" or "Total HAC Score" column');
  const out = new Map();
  for (const c of lines.slice(head + 1)) {
    if (!/^[0-9A-Z]{6}$/.test(c[0])) continue;
    if (!(c[col] in FLAG)) throw new RangeError(`cut list: CCN ${c[0]} has flag "${c[col]}"`);
    if (out.has(c[0])) throw new RangeError(`cut list: CCN ${c[0]} appears twice`);
    out.set(c[0], { flag: FLAG[c[col]], total: c[totalCol], state: stateCol < 0 ? '' : c[stateCol] });
  }
  return out;
}


// CMS's period dates as MM/DD/YYYY, from the forms its files use: MM/DD/YYYY, MMDDYYYY (FY2016, FY2017) and
// DD-MON-YY (FY2015, all twenty-first-century dates). N/A or blank: null.
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
export function cmsDate(text) {
  const t = (text ?? '').trim();
  if (t === '' || t === 'N/A') return null;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(t)) return t;
  let m = /^(\d{2})(\d{2})(\d{4})$/.exec(t);
  if (m) return `${m[1]}/${m[2]}/${m[3]}`;
  m = /^(\d{2})-([A-Z]{3})-(\d{2})$/.exec(t);
  if (m && MONTHS.includes(m[2])) return `${String(MONTHS.indexOf(m[2]) + 1).padStart(2, '0')}/${m[1]}/20${m[3]}`;
  throw new RangeError(`HACRP history: "${t}" is not a date in a form CMS uses`);
}

// A file's one value of a date column across its rows, as MM/DD/YYYY; null when the column is missing or every row is
// blank or N/A.
function oneDate(rows, name, fy) {
  if (!name) return null;
  const values = new Set(rows.map((r) => cmsDate(r[name])).filter(Boolean));
  if (values.size === 0) return null;
  if (values.size > 1) throw new RangeError(`HACRP FY${fy}: ${name} differs between rows (${[...values].slice(0, 3).join(', ')})`);
  return [...values][0];
}

// The hospitals on a year's cut list that its hospital file leaves out: CMS's decision and total for them, from the
// list, with no parts (parts: how many part columns a row carries).
function listOnly(flags, ccns, parts) {
  if (!flags) return [];
  return [...flags].filter(([ccn]) => !ccns.has(ccn)).sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([ccn, f]) => [ccn, f.state, f.total, f.flag, ...new Array(parts).fill('')]);
}

// One year's file -> its emitted year. rows: parseCsv() of CMS's file; fy: the program year the file is for;
// flags: CMS's cut list (cutListFlags) for a year whose file has no payment column.
export function historyYear(fy, rows, flags = null) {
  if (!rows.length) throw new RangeError(`HACRP FY${fy}: no rows`);
  const shape = fileShape(Object.keys(rows[0]));
  const norm = rows.map((row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [normalName(k), v.trim()])));
  if (shape.fy) {
    const years = new Set(norm.map((r) => r[shape.fy]));
    if (years.size !== 1 || !years.has(String(fy))) throw new RangeError(`HACRP FY${fy}: the file's fiscal year is ${[...years].join(', ')}`);
  }
  const ccns = new Set();
  for (const r of norm) {
    if (!/^[0-9A-Z]{6}$/.test(r[shape.ccn])) throw new RangeError(`HACRP FY${fy}: CCN "${r[shape.ccn]}" is not six digits or capital letters`);
    if (ccns.has(r[shape.ccn])) throw new RangeError(`HACRP FY${fy}: CCN ${r[shape.ccn]} appears twice`);
    ccns.add(r[shape.ccn]);
  }
  const period = ([start, end]) => {
    const s = oneDate(norm, start, fy);
    const e = oneDate(norm, end, fy);
    return s && e ? { start: s, end: e } : null;
  };
  const psi90 = period(shape.psi);
  const hai = period(shape.hai);
  const measures = MEASURE_IDS.filter((id) => shape.z.includes(id));
  if (!shape.decision && !flags) throw new RangeError(`HACRP FY${fy}: no payment column and no cut list`);
  const decision = (r) => (shape.decision ? r[shape.decision] : flags.get(r[shape.ccn])?.flag ?? '');
  return {
    fy,
    rule: ruleFor(fy).rule,
    measures,
    scale: shape.scale,
    domains: shape.domains,
    decisions: shape.decision ? 'file' : 'cut-list',
    periods: { psi90, hai },
    // The CCNs whose score or parts CMS footnoted or marked: a recompute that misses CMS's total is let pass only for
    // these (CMS used a part its file withholds).
    footnoted: norm.filter((_, i) => noted(rows[i])).map((r) => r[shape.ccn]),
    hospitals: norm.map((r) => [
      r[shape.ccn], r.STATE, r.TOTAL_HAC_SCORE ?? '', decision(r) === 'Not Available' ? 'N/A' : decision(r),
      ...measures.map((id) => r[partColumn(shape, id)] ?? ''),
      ...(shape.domains ? [r.DOMAIN_1_SCORE ?? '', r.DOMAIN_2_SCORE ?? ''] : []),
    ]).concat(listOnly(flags, ccns, measures.length + (shape.domains ? 2 : 0))),
  };
}

// files: [{ fy, id, rows, cutList, flags }] (id: the manifest id of the year's pinned file; cutList and flags: its
// cut list's id and flags, for FY2015 and FY2016); infections: [{ cy, id, rows }] (the HAI extracts).
export function buildHistory({ files, infections = [], manifest, builtAt }) {
  const sorted = [...files].sort((a, b) => a.fy - b.fy);
  const newest = sorted[sorted.length - 1].fy;
  const hai = [...infections].sort((a, b) => a.cy - b.cy);
  const sources = [...sorted.flatMap((f) => (f.cutList ? [f.id, f.cutList] : [f.id])), ...hai.map((h) => h.id)];
  return {
    ...envelope({ schemaVersion: HISTORY_SCHEMA_VERSION, methodsVersion: HISTORY_METHODS_VERSION, sources, manifest, builtAt, fy: newest }),
    years: sorted.map((f) => historyYear(f.fy, f.rows, f.flags ?? null)),
    infections: hai.map((h) => infectionYear(h.cy, h.rows)),
  };
}

// Every year's pinned file read for buildHistory: readPinned is pipeline/files.js's. CMS's cut lists are Windows text
// (latin1 keeps every byte as one character; only CCNs and flags are read from them).
export const historyFilesFrom = (readPinned, parseCsv) => HISTORY_PINS.map(({ fy, id, cutList }) => ({
  fy, id, rows: parseCsv(readPinned(id)), ...(cutList ? { cutList, flags: cutListFlags(readPinned(cutList, 'latin1')) } : {}),
}));
export const infectionFilesFrom = (readPinned, parseCsv) => HAI_PINS.map(({ cy, id }) => ({ cy, id, rows: parseCsv(readPinned(id)) }));
