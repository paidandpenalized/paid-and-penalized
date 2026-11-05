// The numbers behind the program page's History Part, as plain data (no markup). The small multiples (share penalized,
// average cut, estimated totals; drawn by figures/history-draw.js) and the roll call (not drawn yet) are each a pure function returning its series,
// marks and table rows; the timeline and the data windows are drawn (figures/history.js) from timelineData and windowRows.
// Denominators: a year's share penalized is TDR's pctPen, over the hospitals in that year's file as the history pin holds them (n; not the page's share of the hospitals measured on a condition; which hospitals the FY2013-FY2018 files leave out is not checked here);
// the average cuts are over every hospital in that year's file (all) or over those cut (penalized). The roll call covers
// today's hospitals only, so its per-year shares can run above CMS's national share for the year;
// any words built from it say "of today's hospitals". Pure.
import { isoDate, listText } from '../../../../web/render/format.js';
import { COVID_EXCLUDED, COVID_FYS, HISTORY_MARKS } from '../constants.js';
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

// history: loadHrrp().history. Returns { years, share, avgPen, avgAll, totals, noTotal, noTotalText, caps, marks, covid, table }:
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
  };
}

// ---------- the roll call ----------

export const ROLL = Object.freeze({ cut: 'C', kept: 'N', absent: ' ' });

// One record for each of today's hospitals, one character for each fiscal year (the history's years, then the file's own):
// 'C' cut, 'N' in the file and not cut, ' ' absent (not in that year's file: never "not cut"). Records are ordered by the
// first year each was cut (never cut last), then by CCN. counts: n; nYears; neverCut (in the file at least once, never cut);
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
  return { years, records: sorted.map(({ id, marks }) => ({ id, marks })), counts };
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

// One row for each fiscal year with a payment year: { fy, perf: [start, end] | null, pay: [start, end] }, newest first.
export function windowRows({ history }) {
  return [...history.national].reverse().map((r) => ({
    fy: r.fy,
    perf: r.perf?.[0] && r.perf?.[1] ? r.perf : null,
    pay: [`${r.fy - 1}-10-01`, `${r.fy}-09-30`],
  }));
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
