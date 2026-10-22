// What the HACRP pages read at build time: the newest emitted HACRP file, the newest hospital master, CMS's
// footnote crosswalk, the dataset's manifest entry and the CSV's data dictionary, plus CMS's text for the line's two scores.
// File reads live here; views and pages stay pure.
import { readFileSync } from 'node:fs';
import { CCN } from '../../../engine/js/ccn.js';
import { parseCsv } from '../../../engine/js/csv.js';
import { footnoteList, parseFootnotes } from '../../../engine/js/footnotes.js';
import { countyShapes, stateShapes } from '../../../web/charts/geo.js';
import { REPO_ROOT, masterPath, newestYear, readJson, readManifest, readPinned } from '../../../pipeline/files.js';
import { SOURCES, emittedPath } from '../pipeline/build.js';
import { HAI_MEASURES, HAI_PINS, historyPath } from '../pipeline/history.js';
import { existsSync } from 'node:fs';
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
      const sir = Object.fromEntries(HAI_MEASURES.map(([id, k]) => [id, /^\d+(\.\d+)?$/.test(r[`hai_${k}_sir`]) ? Number(r[`hai_${k}_sir`]) : null]));
      if (!out.has(r.ccn)) out.set(r.ccn, []);
      out.get(r.ccn).push({ cy, sir });
    }
  }
  return out;
}

// The master's HACRP program year must be the year of the HACRP file the pages show (the newest master is not
// necessarily the one built for this program year).
export function checkMasterYear(masterFile, fy) {
  const year = masterFile.programYears?.hacrp;
  if (year !== fy) throw new RangeError(`HACRP: file is FY${fy} but the hospital master's HACRP year is ${year}`);
}

export function loadHacrp() {
  const data = readJson(REPO_ROOT + emittedPath(newestYear('data/emitted/hacrp')));
  const masterFile = readJson(REPO_ROOT + masterPath(newestYear('data/emitted/hospital')));
  checkMasterYear(masterFile, data.fy);
  const master = new Map(masterFile.hospitals.map((r) => [r.ccn, r]));

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
    // Every program year's file, when the build has them (the history; null without).
    history: existsSync(REPO_ROOT + historyPath(data.fy)) ? readJson(REPO_ROOT + historyPath(data.fy)) : null,
    infections: infectionsByHospital(HAI_PINS.map(({ cy, id }) => ({ cy, rows: parseCsv(readPinned(id)) }))),
    manifest,
    sourceRows: parseCsv(readPinned(sourceId)).length,
    source: { id: source.id, title: source.title, landingPage: source.landingPage, pdcReleased: source.pdcReleased },
  };
}
