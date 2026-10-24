// What the HACRP pages read at build time: the newest emitted HACRP file, the newest hospital master, the newest dollar
// estimates, CMS's footnote crosswalk, the dataset's manifest entry and the CSV's data dictionary, plus CMS's text for
// the line's two scores.
// File reads live here; views and pages stay pure.
import { existsSync, readFileSync } from 'node:fs';
import { CCN } from '../../../engine/js/ccn.js';
import { parseCsv } from '../../../engine/js/csv.js';
import { isIsoDate } from '../../../engine/js/dates.js';
import { footnoteList, parseFootnotes } from '../../../engine/js/footnotes.js';
import { numberOf } from '../../../engine/js/hacrp/eras.js';
import { countyShapes, stateShapes } from '../../../web/charts/geo.js';
import { REPO_ROOT, dollarsPath, masterPath, newestYear, readJson, readManifest, readPinned } from '../../../pipeline/files.js';
import { SOURCES, newestEmittedPath } from '../pipeline/build.js';
import { HAI_MEASURES, HAI_PINS, historyPath } from '../pipeline/history.js';
import { rangeOf, rangeShare } from './money.js';
import { boundaryText } from './view.js';

export const FOOTNOTES_ID = 'y9us-9xdf';
// Care Compare's Hospital General Information (each hospital's overall star rating) and the us-atlas topology (state
// outlines for the locator maps and the US map).
export const HGI_ID = 'hgi-2026-07';
export const ATLAS_ID = 'us-atlas-counties-3.0.1';

// CCN -> { rating, footnotes }: CMS's "Hospital overall rating" text as published ("1" to "5", or CMS's words when it
// rates none) and its footnotes' text. A row without the columns fails the build.
export function careCompareRatings(csvText, footnotes) {
  const out = new Map();
  for (const row of parseCsv(csvText)) {
    const ccn = row['Facility ID'];
    const rating = row['Hospital overall rating'];
    const note = row['Hospital overall rating footnote'];
    if (ccn === undefined || rating === undefined || note === undefined) throw new RangeError(`${HGI_ID}: missing column`);
    out.set(ccn, { rating, footnotes: footnoteList(footnotes, note) });
  }
  return out;
}
const DICTIONARY_FILE = 'sites/hacrp/DATA-DICTIONARY.md';
const CHANGELOG_FILE = 'sites/hacrp/CHANGELOG.md';

// The changelog's entries, newest first: [{ date (YYYY-MM-DD), items }], from its "## YYYY-MM-DD" headings and "- "
// lines. Anything else (its title and opening paragraph) is for readers of the file itself.
export function changelogEntries(text) {
  const out = [];
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    const date = /^## (\d{4}-\d{2}-\d{2})\s*$/.exec(line);
    if (date) out.push({ date: date[1], items: [] });
    else if (line.startsWith('- ')) {
      if (!out.length) throw new RangeError('changelog: an item before the first dated heading');
      out[out.length - 1].items.push(line.slice(2).trim());
    }
  }
  if (out.some((e) => !e.items.length)) throw new RangeError('changelog: a dated heading with no items');
  return out;
}

// Each hospital's infection results by calendar year, from the pinned Care Compare extracts: Map(ccn -> [{ cy, sir: {
// CLABSI: number|null, … } }]), years oldest first; a hospital is listed for the years it appears in.
export function infectionsByHospital(files) {
  const out = new Map();
  for (const { cy, rows } of files) {
    for (const r of rows) {
      const sir = Object.fromEntries(HAI_MEASURES.map(([id, k]) => [id, numberOf(r[`hai_${k}_sir`], `hai_${k}_sir`)]));
      if (!out.has(r.ccn)) out.set(r.ccn, []);
      out.get(r.ccn).push({ cy, sir });
    }
  }
  return out;
}

// The history, when there is one, must end with the HACRP file's year.
export function checkHistoryYear(history, fy) {
  if (history && history.fy !== fy) throw new RangeError(`HACRP: the history ends at FY${history.fy} but the HACRP file is FY${fy}; add the year to HISTORY_PINS and run make emit`);
}

// The master's HACRP program year must be the year of the HACRP file the pages show (the newest master is not
// necessarily the one built for this program year).
export function checkMasterYear(masterFile, fy) {
  const year = masterFile.programYears?.hacrp;
  if (year !== fy) throw new RangeError(`HACRP: file is FY${fy} but the hospital master's HACRP year is ${year}`);
}

// The dollar estimates must be for the year the pages show.
export function checkDollarsYear(dollars, fy) {
  if (dollars.fy !== fy) throw new RangeError(`HACRP: the dollar estimates are FY${dollars.fy} but the HACRP file is FY${fy}`);
}

// The statuses of a dollar row the pages have words for (the file's schema lists a fourth, `parhm`, which no hospital has).
const SHOWN_STATUSES = ['estimated', 'maryland', 'no-inputs'];

// What the pages read of the dollar estimates (data/emitted/dollars): each hospital's row by CCN, every one of them in
// the HACRP file, and the file's aggregates. Every dollar figure carries its likely range, from the back-test (the file's
// `bands`): each estimated row carries its two (`ranges`: the dollars at stake and the net, money.js rangeOf), and
// `backtest` what a range means (the `share` of the back-test's misses a range spans, and the `fy` it was run on). A file
// without `bands` can't be shown, so it fails here, in every build. The browser never gets the file: each page carries
// the slice it draws.
export function dollarsData(dollars, hospitals) {
  const { fy, national, headline, checks, assumptions, bands } = dollars;
  if (bands == null) throw new RangeError('HACRP: the dollar estimates have no ranges (bands is missing or null); no page can show them');
  const rows = new Map(dollars.hospitals.map((r) => [r.ccn, r]));
  for (const h of hospitals) if (!rows.has(h.ccn)) throw new RangeError(`HACRP: CCN ${h.ccn} has no row in the dollar estimates`);
  // The cliff and the what-if plot a drop to an estimated hospital's dollars at stake, so they must be above $0.
  for (const r of rows.values()) if (r.status === 'estimated' && !(r.atStake > 0)) throw new RangeError(`HACRP: ${r.ccn} is estimated but its dollars at stake is ${r.atStake}; the cliff and the what-if need an estimated hospital's dollars at stake above $0`);
  // A row with another status stops the build rather than get another reason's words.
  for (const r of rows.values()) if (!SHOWN_STATUSES.includes(r.status)) throw new RangeError(`HACRP: ${r.ccn} has the dollar status "${r.status}", which no page has words for`);
  const ranged = (r) => (r.status === 'estimated'
    ? { ...r, ranges: { hac: rangeOf(bands, 'hac', r.stratum, r.atStake), net: rangeOf(bands, 'net', r.stratum, r.net) } } : r);
  const byCcn = new Map([...rows].map(([ccn, r]) => [ccn, ranged(r)]));
  // The headline's `yes` (CMS's cut count) also goes by the name every group's rollup gives it (money-data.js), so one
  // formatter says "n of m" for the nation and for a state alike.
  return { fy, byCcn, national, headline: { ...headline, cmsCut: headline.yes }, checks, assumptions, bands, backtest: { share: rangeShare(bands), fy: bands.fy } };
}

// An emitted file's built_at: UTC, whole seconds (builtAt in schemas/common.schema.json).
const BUILT_AT = /^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}:\d{2}Z$/;

// The date (YYYY-MM-DD, UTC) the newest of these emitted files was built: the newest built_at among them. files:
// [[repo path, the parsed file]]; a file that is absent (the history, in a build without one) is null and skipped. A
// built_at that is not a timestamp on the calendar stops the build and names the file.
export function changedOn(files) {
  const days = files.filter(([, file]) => file).map(([path, file]) => {
    const day = BUILT_AT.exec(file.built_at)?.[1];
    if (!isIsoDate(day)) throw new RangeError(`HACRP: ${path}: built_at is not a UTC timestamp in whole seconds: ${JSON.stringify(file.built_at)}`);
    return day;
  });
  if (!days.length) throw new RangeError('HACRP: no emitted file to take a built_at from');
  return days.sort().at(-1);
}

export function loadHacrp() {
  // The emitted files the pages read, repo-relative, each from its newest year.
  const paths = {
    data: newestEmittedPath(),
    master: masterPath(newestYear('data/emitted/hospital')),
    history: existsSync(REPO_ROOT + 'data/emitted/hacrp-history') ? historyPath(newestYear('data/emitted/hacrp-history')) : null,
    dollars: dollarsPath(newestYear('data/emitted/dollars')),
  };
  const data = readJson(REPO_ROOT + paths.data);
  const masterFile = readJson(REPO_ROOT + paths.master);
  // The history, when the build holds one, must end with the year the pages show: a new year's pin without its
  // history fails here rather than dropping the history from the site.
  const history = paths.history ? readJson(REPO_ROOT + paths.history) : null;
  checkHistoryYear(history, data.fy);
  checkMasterYear(masterFile, data.fy);
  const dollarsFile = readJson(REPO_ROOT + paths.dollars);
  checkDollarsYear(dollarsFile, data.fy);
  const master = new Map(masterFile.hospitals.map((r) => [r.ccn, r]));
  // The files this site's numbers come from. The hospital master is left out: it is shared, so a re-emit for another
  // program rebuilds it without changing a number here. The history is null in a build without one.
  const builtFiles = [[paths.data, data], [paths.history, history], [paths.dollars, dollarsFile]];

  for (const h of data.hospitals) {
    if (!CCN.test(h.ccn)) throw new RangeError(`HACRP: CCN "${h.ccn}" is not six digits or capital letters`);
    if (!master.has(h.ccn)) throw new RangeError(`HACRP: CCN ${h.ccn} has no hospital master record`);
  }

  // One set of measurement periods for the whole file; the pages state them once.
  const periods = data.hospitals[0].periods;
  const key = JSON.stringify(periods);
  if (data.hospitals.some((h) => JSON.stringify(h.periods) !== key)) throw new RangeError('HACRP: measurement periods differ between hospitals');

  const [sourceId] = SOURCES;
  const source = readManifest().find((e) => e.id === sourceId);
  if (!source) throw new RangeError(`no manifest entry for ${sourceId}`);
  if (!/^https:\/\/[^\s"'<>]+$/.test(source.landingPage)) throw new RangeError(`${sourceId}: landingPage is not an https URL`);

  const footnotes = parseFootnotes(readPinned(FOOTNOTES_ID));
  const manifest = readManifest();
  const hgi = manifest.find((e) => e.id === HGI_ID);
  const topo = JSON.parse(readPinned(ATLAS_ID));
  return {
    fy: data.fy,
    // The day this site's numbers last changed (the corrections page shows it): the newest built_at of builtFiles.
    builtFiles,
    changedOn: changedOn(builtFiles),
    hospitals: data.hospitals,
    model: data.model,
    boundaryText: boundaryText(data.hospitals, data.model.boundary),
    estimate: data.estimate,
    periods,
    master,
    // The hospital master's own fiscal year (its IPPS attributes: teaching, urban, special statuses).
    masterFy: masterFile.fy,
    footnotes,
    careCompare: careCompareRatings(readPinned(HGI_ID), footnotes),
    careCompareSource: { id: hgi.id, modified: hgi.pdcModified, landingPage: hgi.landingPage },
    shapes: stateShapes(topo),
    counties: countyShapes(topo),
    dictionary: readFileSync(REPO_ROOT + DICTIONARY_FILE, 'utf8'),
    changes: changelogEntries(readFileSync(REPO_ROOT + CHANGELOG_FILE, 'utf8')),
    // This site's dollar estimates, per hospital and in total (dollarsData).
    dollars: dollarsData(dollarsFile, data.hospitals),
    // Every program year's file, when the build has them (the history; null without).
    history,
    infections: history ? infectionsByHospital(HAI_PINS.map(({ cy, id }) => ({ cy, rows: parseCsv(readPinned(id)) }))) : new Map(),
    // Every pinned input the pages rest on: the HACRP file's, the history's, the hospital master's and the dollar
    // estimates' sources, and the files the pages read directly.
    pinsUsed: manifest.filter((e) => new Set([...data.sources, ...(history?.sources ?? []), ...masterFile.sources, ...dollarsFile.sources, FOOTNOTES_ID, HGI_ID, ATLAS_ID]).has(e.id)),
    manifest,
    // The emitted file keeps every row of CMS's file.
    sourceRows: data.hospitals.length,
    source: { id: source.id, title: source.title, landingPage: source.landingPage, pdcReleased: source.pdcReleased },
  };
}
