// CMS's HACRP hospital files, every year: one row of any year's file -> one normalized record, and the Total HAC
// Score recomputed by that year's rule. Column names changed over the years (PROVIDER_ID, Provider ID, Facility ID;
// DOMAIN_1_SCORE; PSI_90_W_Z_SCORE; PSI 90 W Z Score), so a header is matched in one normal form: upper case, every
// run of other characters an underscore. Pure: rows in, records out.
import { mean } from '../stats.js';
import { MEASURE_IDS } from './measures.js';

// The normal form of a column name: "PSI 90 W Z Score" -> "PSI_90_W_Z_SCORE".
export const normalName = (name) => name.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');

// Each measure's prefix in the normal form: its z-score column (FY2018 on) is <prefix>_W_Z_SCORE; its score in
// tenths (FY2015 to FY2017) is <tenths prefix>_SCORE.
export const PREFIX = Object.freeze({ PSI90: 'PSI_90', CLABSI: 'CLABSI', CAUTI: 'CAUTI', SSI: 'SSI', CDI: 'CDI', MRSA: 'MRSA' });
export const TENTHS = Object.freeze({ PSI90: 'AHRQ_PSI_90', CLABSI: 'CLABSI', CAUTI: 'CAUTI', SSI: 'SSI', CDI: 'CDI', MRSA: 'MRSA' });
// A measure's part of the score in a year's file: its z-score column, or its tenths column in a file with none.
export const partColumn = (shape, id) => (shape.scale === 'z' ? `${PREFIX[id]}_W_Z_SCORE` : `${TENTHS[id]}_SCORE`);
// A measure's own footnote column in a year's file: its z-score's (FY2023 on), or the plain form earlier years use.
const footnoteColumns = (shape, id) => (shape.scale === 'z' ? [`${PREFIX[id]}_W_Z_FOOTNOTE`, `${PREFIX[id]}_FOOTNOTE`] : [`${TENTHS[id]}_SCORE_FOOTNOTE`, `${TENTHS[id]}_FOOTNOTE`]);
const CCN_COLUMNS = ['FACILITY_ID', 'PROVIDER_ID', 'PROVIDER_NUMBER'];
const DECIMAL = /^-?\d+(\.\d+)?$/;
const FLAGS = new Set(['Yes', 'No', 'N/A']);

// The rules CMS used to build a Total HAC Score, by fiscal year (method constants; the self-check proves each against
// every hospital's published score):
//   'equal'    the average of the hospital's measure z-scores (FY2020 on)
//   'domains'  Domain 1 (PSI 90) and Domain 2 (the infections) weighted; a hospital with one domain takes it whole
export const RULES = Object.freeze([
  { from: 2020, rule: 'equal' },
  { from: 2017, rule: 'domains', weights: [0.15, 0.85] },
  { from: 2016, rule: 'domains', weights: [0.25, 0.75] },
  { from: 2015, rule: 'domains', weights: [0.35, 0.65] },
]);
// The first fiscal year of the equal-weight rule, and of measures scored as z-scores (scores in tenths before it).
export const EQUAL_FROM = RULES.find((r) => r.rule === 'equal').from;
export const Z_FROM = 2018;
export const ruleFor = (fy) => {
  const r = RULES.find((x) => fy >= x.from);
  if (!r) throw new RangeError(`HACRP: no scoring rule for FY${fy}`);
  return r;
};

// A row's columns by normal name, their text trimmed. noted, partNotes and toRecord read rows in this form.
export function normalRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) out[normalName(k)] = typeof v === 'string' ? v.trim() : v;
  return out;
}

// CMS's FY2015 file marks some values with trailing asterisks (its footnote marks, e.g. "5.5000*"); the number is the
// text before them.
const MARKS = /\*+$/;
export function numberOf(text, name) {
  const bare = (text ?? '').replace(MARKS, '');
  if (bare === '' || bare === 'N/A' || bare === 'Not Available') return null;
  if (!DECIMAL.test(bare)) throw new RangeError(`HACRP history: "${name}" is not a number: "${text}"`);
  return Number(bare);
}

// The columns a year's file has, checked once: which measures carry a z-score column, whether there are domain
// scores and a decision, and the period columns.
export function fileShape(headerNames) {
  const cols = new Set(headerNames.map(normalName));
  const ccn = CCN_COLUMNS.find((c) => cols.has(c));
  if (!ccn) throw new RangeError('HACRP history: no CCN column');
  for (const need of ['STATE', 'TOTAL_HAC_SCORE']) if (!cols.has(need)) throw new RangeError(`HACRP history: no ${need} column`);
  const z = MEASURE_IDS.filter((id) => cols.has(`${PREFIX[id]}_W_Z_SCORE`));
  const tenths = z.length ? [] : MEASURE_IDS.filter((id) => cols.has(`${TENTHS[id]}_SCORE`));
  const pick = (...names) => names.find((n) => cols.has(n)) ?? null;
  return {
    ccn,
    // The measures with a part column, and whether the parts are z-scores or scores in tenths.
    z: z.length ? z : tenths,
    scale: z.length ? 'z' : 'tenths',
    domains: cols.has('DOMAIN_1_SCORE') && cols.has('DOMAIN_2_SCORE'),
    decision: pick('PAYMENT_REDUCTION'),
    psi: [pick('PSI_90_START_DATE', 'DOMAIN_1_START_DATE'), pick('PSI_90_END_DATE', 'DOMAIN_1_END_DATE')],
    hai: [pick('HAI_MEASURES_START_DATE', 'DOMAIN_2_START_DATE'), pick('HAI_MEASURES_END_DATE', 'DOMAIN_2_END_DATE')],
    fy: pick('FISCAL_YEAR'),
  };
}

// Whether CMS footnoted a row's score: a non-empty footnote on its total, a domain or a measure part (any footnote
// column but the payment decision's own), or a score carrying CMS's asterisk marks. r: normalRow(row).
export function noted(r) {
  for (const [k, v] of Object.entries(r)) {
    if (!v) continue;
    if (k.includes('FOOTNOTE') && !k.startsWith('PAYMENT_REDUCTION')) return true;
    if (k.endsWith('SCORE') && MARKS.test(v)) return true;
  }
  return false;
}

// The parts CMS footnoted on a row, each by its own footnote column or its score's asterisk marks: a set of measure
// ids, and 'D1' and 'D2' for the domain scores. r: normalRow(row).
export function partNotes(r, shape) {
  const parts = [
    ...shape.z.map((id) => [id, partColumn(shape, id), footnoteColumns(shape, id)]),
    ...(shape.domains ? [1, 2].map((k) => [`D${k}`, `DOMAIN_${k}_SCORE`, [`DOMAIN_${k}_SCORE_FOOTNOTE`, `DOMAIN_${k}_FOOTNOTE`]]) : []),
  ];
  return new Set(parts.filter(([, score, notes]) => MARKS.test(r[score] ?? '') || notes.some((c) => r[c])).map(([key]) => key));
}

// One row -> { ccn, state, total, totalText, decision, z: { id: number|null }, d1, d2 }. r: normalRow(row).
export function toRecord(r, shape) {
  // CMS's FY2019 file writes "Not Available" where later files write N/A.
  const raw = shape.decision ? r[shape.decision] : null;
  const decision = raw === 'Not Available' ? 'N/A' : raw;
  if (decision !== null && !FLAGS.has(decision)) throw new RangeError(`HACRP history: unexpected payment reduction "${decision}"`);
  return {
    ccn: r[shape.ccn],
    state: r.STATE,
    total: numberOf(r.TOTAL_HAC_SCORE, 'TOTAL_HAC_SCORE'),
    totalText: r.TOTAL_HAC_SCORE ?? '',
    decision,
    z: Object.fromEntries(shape.z.map((id) => [id, numberOf(r[partColumn(shape, id)], partColumn(shape, id))])),
    d1: shape.domains ? numberOf(r.DOMAIN_1_SCORE, 'DOMAIN_1_SCORE') : null,
    d2: shape.domains ? numberOf(r.DOMAIN_2_SCORE, 'DOMAIN_2_SCORE') : null,
  };
}

// A record's measure parts that CMS published.
export const publishedParts = (rec) => Object.values(rec.z).filter((z) => z !== null);

// The two domains a 'domains' year adds, [Domain 1, Domain 2] (null: none): built from the parts (Domain 1 is PSI 90's;
// Domain 2 the average of the infections'), and from CMS's published domain scores only for a hospital with domain
// scores but no parts.
export function domainsOf(rec) {
  const d1 = rec.z.PSI90 ?? null;
  const hai = MEASURE_IDS.filter((id) => id !== 'PSI90' && rec.z[id] !== undefined && rec.z[id] !== null).map((id) => rec.z[id]);
  const d2 = hai.length ? mean(hai) : null;
  return d1 === null && d2 === null ? [rec.d1 ?? null, rec.d2 ?? null] : [d1, d2];
}

// The Total HAC Score by the year's rule, from the measure parts CMS published (z-scores, or scores in tenths before
// FY2018); null when CMS published no parts to add. 'domains' weights the two domains (domainsOf); a hospital with
// one domain takes it whole.
export function recomputeTotal(rec, rule) {
  if (rule.rule === 'equal') {
    const zs = publishedParts(rec);
    return zs.length ? mean(zs) : null;
  }
  const [d1, d2] = domainsOf(rec);
  if (d1 === null && d2 === null) return null;
  if (d1 === null) return d2;
  if (d2 === null) return d1;
  const [w1, w2] = rule.weights;
  return w1 * d1 + w2 * d2;
}
