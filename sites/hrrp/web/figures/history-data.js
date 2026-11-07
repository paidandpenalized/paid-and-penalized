// The numbers behind the program page's History Part, as plain data (no markup). The small multiples (share penalized,
// average cut, estimated totals; drawn by figures/history-draw.js) and the roll call (not drawn yet) are each a pure function returning its series,
// marks and table rows; the timeline and the data windows are drawn (figures/history.js) from timelineData and windowRows.
// Denominators: a year's share penalized is the history's pctPen, over the hospitals in that year's file less the groups only the
// early files list (scopeYears names them; n; not the page's share of the hospitals measured on a condition); the average cuts
// are over the same hospitals (all) or over those cut (penalized). The roll call covers
// today's hospitals only, so its per-year shares can run above CMS's national share for the year;
// any words built from it say "of today's hospitals". Pure.
import { isoDate, listText } from '../../../../web/render/format.js';
import { COVID_EXCLUDED, COVID_FYS, HISTORY_MARKS, RULE_WINDOWS, WINDOW_GAP } from '../constants.js';
import { capMarks, pafByYear } from '../derive.js';
import { httpsUrl } from '../links.js';
import { fyLabel } from '../copy.js';
import { byId } from '../numbers.js';
import { fill, t } from '../program/copy.js';

// ---------- the small multiples ----------

// A year's total with its source, or null when the data holds none. kind is 'CMS' (dark) or 'KFF' (light).
const totalOf = (r) => (r.totalEst == null ? null : { value: r.totalEst, kind: r.totalSrc?.kind ?? null, label: r.totalSrc?.label ?? null, url: httpsUrl(r.totalSrc?.url) });

// The fiscal years with no total, in words ("FY2024 and FY2026"), or null when every year has one.
export const noTotalText = (fys) => (fys.length ? fill('histNoTotal', { years: listText(fys.map(fyLabel)) }) : null);

// history: loadHrrp().history. Returns { years, share, avgPen, avgAll, totals, noTotal, noTotalText, caps, marks, covid, table, steady }:
// share, avgPen and avgAll are [{ fy, value }] (percent; value null when the year has none); totals [{ fy, value, kind, label, url
// }] for the years with one; noTotal the years without; caps the cap steps read from the data [{ fy, label, short }]; marks the
// rule marks [{ fy, key, label }] (the copy entry carries the claim) (FY2019, FY2023, FY2027); covid { first, last, label, note, fys }; table one row for each
// year: { fy, n, share, avgAll, avgPen, total } (total as in totals, or null) for the figure table.
export function smallLines({ history }) {
  const { national } = history;
  const points = (key) => national.map((r) => ({ fy: r.fy, value: r[key] ?? null }));
  const totals = national.map((r) => ({ fy: r.fy, ...totalOf(r) })).filter((r) => r.value != null);
  const noTotal = national.filter((r) => r.totalEst == null).map((r) => r.fy);
  const years = national.map((r) => r.fy);
  const [first, last] = COVID_FYS;
  return {
    years,
    share: points('pctPen'),
    avgPen: points('meanRedPen'),
    avgAll: points('meanRed'),
    totals,
    noTotal,
    noTotalText: noTotalText(noTotal),
    caps: capMarks(national),
    marks: HISTORY_MARKS.filter((m) => years.includes(m.fy)).map(({ fy, key }) => ({ fy, key, label: t(key) })),
    covid: { first, last, fys: years.filter((fy) => fy >= first && fy <= last), label: t('histCovid'), note: fill('histCovidNote', { from: isoDate(COVID_EXCLUDED[0]), to: isoDate(COVID_EXCLUDED[1]) }) },
    table: national.map((r) => ({ fy: r.fy, n: r.n, share: r.pctPen ?? null, avgAll: r.meanRed ?? null, avgPen: r.meanRedPen ?? null, total: totalOf(r) })),
    steady: steadyShare(national),
  };
}

// The Part's lede: since the first year at the highest cap, the lowest share cut in any year, rounded down to a whole percent (so
// "at least" holds): { fy, cap, share }, or null without a year at a cap or a share.
function steadyShare(national) {
  const caps = national.map((r) => r.cap).filter(Number.isFinite);
  if (!caps.length) return null;
  const cap = Math.max(...caps);
  const since = national.filter((r) => r.cap === cap);
  const shares = national.filter((r) => r.fy >= since[0].fy && Number.isFinite(r.pctPen)).map((r) => r.pctPen);
  return shares.length ? { fy: since[0].fy, cap, share: Math.floor(Math.min(...shares)) } : null;
}

// ---------- the roll call ----------

export const ROLL = Object.freeze({ cut: 'C', kept: 'N', absent: ' ' });

// One record for each of today's hospitals, one character for each fiscal year (the history's years, then the file's own):
// 'C' cut, 'N' in the file and not cut, ' ' absent (not in that year's file: never "not cut"), with present (years in the file)
// and cut (years cut), which yearsCut reads. Records are ordered by the first year each was cut (never cut last), then by CCN. counts: n; nYears; neverCut (in the file at least once, never cut);
// everCut; cutEveryYearInFile (cut in every year it is in the file, at least one: includes hospitals in the file one year);
// cutAllYears (in the file and cut in all nYears); byYear [{ fy, present, cut, share }] (share of those present, 0-1).
export function rollCall({ hospitals, history, meta }) {
  const years = [...history.years, meta.fy];
  const paf = pafByYear({ history, meta });
  const records = hospitals.map((h) => {
    const marks = years.map((_, i) => {
      const v = paf(h, i);
      return v == null ? ROLL.absent : v < 1 ? ROLL.cut : ROLL.kept;
    }).join('');
    const present = [...marks].filter((c) => c !== ROLL.absent).length;
    const cut = [...marks].filter((c) => c === ROLL.cut).length;
    return { id: h.id, marks, first: marks.indexOf(ROLL.cut), present, cut };
  });
  const seen = records.filter((r) => r.present > 0);
  const byYear = years.map((fy) => ({ fy, present: 0, cut: 0, share: null }));
  for (const { marks } of records) {
    byYear.forEach((y, i) => {
      if (marks[i] !== ROLL.absent) y.present += 1;
      if (marks[i] === ROLL.cut) y.cut += 1;
    });
  }
  for (const y of byYear) y.share = y.present ? y.cut / y.present : null;
  const counts = {
    n: records.length,
    nYears: years.length,
    neverCut: seen.filter((r) => r.cut === 0).length,
    everCut: seen.filter((r) => r.cut > 0).length,
    cutEveryYearInFile: seen.filter((r) => r.cut === r.present).length,
    cutAllYears: seen.filter((r) => r.cut === years.length).length,
    byYear,
  };
  const order = (r) => (r.first < 0 ? years.length : r.first);
  const sorted = [...records].sort((a, b) => order(a) - order(b) || byId(a.id, b.id));
  return { years, records: sorted.map(({ id, marks, present, cut }) => ({ id, marks, present, cut })), counts };
}

// "Has this hospital ever escaped?" from rollCall()'s result. full: the records in the file in every year (no absent mark);
// counts: [{ cut, n }] for cut = 0..nYears (every value listed, zeros too), how many full records were cut that many years;
// partial: the records in the file some years but not all { n, everyYear (cut in every year they were in the file), never (in
// the file, never cut) }; an absent year is never counted as "not cut". n: all records; full: count of full records.
// takeaway: { every (full records cut in all nYears), never (full records cut in no year), share (every / full; null when full is 0) }.
// table: counts.
export function yearsCut(roll) {
  const nYears = roll.years.length;
  const full = roll.records.filter((r) => r.present === nYears);
  const part = roll.records.filter((r) => r.present > 0 && r.present < nYears);
  const counts = Array.from({ length: nYears + 1 }, (_, cut) => ({ cut, n: 0 }));
  for (const r of full) counts[r.cut].n += 1;
  return {
    nYears,
    n: roll.records.length,
    full: full.length,
    counts,
    partial: { n: part.length, everyYear: part.filter((r) => r.cut === r.present).length, never: part.filter((r) => r.cut === 0).length },
    takeaway: { every: counts[nYears].n, never: counts[0].n, share: full.length ? counts[nYears].n / full.length : null },
    table: counts,
  };
}

// The roll call's summary sentence, always "of today's hospitals" (the roll call leaves out hospitals that left the program).
export const rollText = ({ counts }) => fill('rollSummary', { n: String(counts.n), never: String(counts.neverCut), always: String(counts.cutEveryYearInFile), all: String(counts.cutAllYears), years: String(counts.nYears) });

// ---------- the timeline ----------

// content: loadHrrp().timeline ([{ date, fy, title, body, src: { label, url } }]); edition: { fy }; today: the data file's date
// (YYYY-MM-DD), for entries with no fiscal year. Each entry becomes { date, fy, title, body, src: { label, url }, future }, url
// null unless it is an https address (the entry then shows its label as plain text); future: its fiscal year is past the
// edition's, or it has none and its date is past the file's. Entries stay in the file's order.
export function timelineData(content, { edition, today }) {
  return (content ?? []).map((e) => ({
    date: String(e.date),
    fy: e.fy ?? null,
    title: String(e.title),
    body: String(e.body),
    src: { label: String(e.src?.label ?? ''), url: httpsUrl(e.src?.url) },
    future: e.fy != null ? e.fy > edition.fy : String(e.date) > today,
  }));
}

// ---------- the data windows ----------

// A window as the pieces the files state: [[start, end]], or two pieces when it runs across the discharges they leave out
// (WINDOW_GAP). ISO dates, so they compare as strings.
const DAY = 86400000;
export const dayBefore = (iso) => new Date(Date.parse(iso) - DAY).toISOString().slice(0, 10);
export const dayAfter = (iso) => new Date(Date.parse(iso) + DAY).toISOString().slice(0, 10);
export function windowPieces([start, end], [gapStart, gapEnd] = WINDOW_GAP) {
  return start < gapStart && end > gapEnd ? [[start, dayBefore(gapStart)], [dayAfter(gapEnd), end]] : [[start, end]];
}

// One row for each fiscal year with a payment year, newest first: { fy, perf: [start, end] | null, pieces: [[start, end]] (the
// window as the files state it; empty without one), src: { label, url } | null (where a window the file doesn't state comes
// from: RULE_WINDOWS), pay: [start, end] }.
export function windowRows({ history }) {
  return [...history.national].reverse().map((r) => {
    const stated = r.perf?.[0] && r.perf?.[1] ? r.perf : null;
    const rule = stated ? null : RULE_WINDOWS[r.fy] ?? null;
    const perf = stated ?? rule?.window ?? null;
    return { fy: r.fy, perf, pieces: perf ? windowPieces(perf) : [], src: rule ? { label: rule.src.label, url: httpsUrl(rule.src.url) } : null, pay: [`${r.fy - 1}-10-01`, `${r.fy}-09-30`] };
  });
}

// ---------- who the history counts ----------

// The groups the early year files list and later files drop, which the history's shares and averages leave out, from the
// history pin's scope column: for each, the fiscal years whose file lists at least one, ascending. rows: the pinned file's rows
// ({ fy, scope_flag }). { maryland, puertoRico, noData }.
const SCOPES = Object.freeze({ maryland_exempt: 'maryland', puerto_rico_excluded: 'puertoRico', no_measure_data: 'noData' });
export function scopeYears(rows) {
  const out = { maryland: new Set(), puertoRico: new Set(), noData: new Set() };
  for (const r of rows) {
    const key = SCOPES[r.scope_flag];
    if (key) out[key].add(Number(r.fy));
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, [...v].sort((a, b) => a - b)]));
}

// ---------- the research ----------

// content: loadHrrp().research ([{ theme, cite, title, url, finding }]). Grouped by theme in the order each first appears:
// [{ theme, items: [{ cite, title, url, finding }] }], url null unless https.
export function researchData(content) {
  const groups = new Map();
  for (const r of content ?? []) {
    const theme = String(r.theme);
    if (!groups.has(theme)) groups.set(theme, []);
    groups.get(theme).push({ cite: String(r.cite), title: String(r.title), url: httpsUrl(r.url), finding: String(r.finding) });
  }
  return [...groups].map(([theme, items]) => ({ theme, items }));
}
