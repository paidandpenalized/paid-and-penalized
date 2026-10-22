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
    ...(() => {
      const topo = JSON.parse(readPinned(ATLAS_ID));
      return { shapes: stateShapes(topo), counties: countyShapes(topo) };
    })(),
    dictionary: readFileSync(REPO_ROOT + DICTIONARY_FILE, 'utf8'),
    source: { id: source.id, title: source.title, landingPage: source.landingPage, pdcReleased: source.pdcReleased },
  };
}
