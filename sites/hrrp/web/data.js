// What the Readmissions pages read at build time: the newest emitted HRRP file (else the pinned Thirty Day Readmissions output), the site's content files, the newest hospital master and the state and county outlines.
// File reads live here; views and pages stay pure.
import { existsSync, readFileSync } from 'node:fs';
import { parseCsv } from '../../../engine/js/csv.js';
import { builtOn } from '../../../engine/js/dates.js';
import { ATLAS_ID, countyShapes, stateShapes } from '../../../web/charts/geo.js';
import { REPO_ROOT, dollarsPath, hrrpPath, masterPath, newestYear, readJson, readManifest, readPinned } from '../../../pipeline/files.js';
import { masterByCcn } from '../../../pipeline/master.js';
import { hospitalRecord } from '../../../web/render/format.js';
import { scopeYears } from './figures/history-data.js';

// The pinned output of Thirty Day Readmissions: the same body as the emitted file, plus the timeline, research and geo.
export const PIN_ID = 'tdr-hrrp-fy2027';
// The per-hospital history of the year files, whose scope column names the groups the early files list and later ones drop.
export const HISTORY_PIN_ID = 'hrrp-history-fy2013-2026';
const EMITTED_DIR = 'data/emitted/hrrp';
const CONTENT = REPO_ROOT + 'sites/hrrp/content/';
const DICTIONARY_FILE = 'sites/hrrp/DATA-DICTIONARY.md';

// The date (YYYY-MM-DD, UTC) the newest of these files was built: the newest built_at among them. files: [[repo
// path, the parsed file]]. A built_at that is not a timestamp on the calendar stops the build and names the file.
export function changedOn(files) {
  const days = files.map(([path, file]) => {
    const day = builtOn(file.built_at);
    if (!day) throw new RangeError(`HRRP: ${path}: built_at is not a UTC timestamp in whole seconds: ${JSON.stringify(file.built_at)}`);
    return day;
  });
  return days.sort().at(-1);
}

// The newest year's emitted file path, or null when there is no emitted Readmissions data at all (no folder, or no year
// folder in it). A year folder without its file is a broken emit and stops the build.
function emittedFile(exists, newest) {
  if (!exists(REPO_ROOT + EMITTED_DIR)) return null;
  let fy;
  try {
    fy = newest(EMITTED_DIR);
  } catch (e) {
    if (e instanceof RangeError) return null;
    throw e;
  }
  const path = hrrpPath(fy);
  if (!exists(REPO_ROOT + path)) throw new Error(`HRRP: ${path} is missing although its year folder exists; run \`make emit\``);
  return path;
}

export function loadHrrp({ exists = existsSync, newest = newestYear } = {}) {
  const manifest = readManifest();
  // With no emitted data at all (a fresh checkout) the pin is read.
  const emittedPath = emittedFile(exists, newest);
  const source = emittedPath ? 'emitted' : 'pin';
  let data;
  let builtFiles;
  if (source === 'emitted') {
    data = readJson(REPO_ROOT + emittedPath);
    builtFiles = [[emittedPath, data]];
  } else {
    // The pin has no built_at of its own; the day it was pinned stands in for it.
    const entry = manifest.find((e) => e.id === PIN_ID);
    if (!entry) throw new RangeError(`no manifest entry for ${PIN_ID}`);
    data = JSON.parse(readPinned(PIN_ID));
    builtFiles = [[`data/pinned/${entry.path}`, { built_at: `${entry.retrieved}T00:00:00Z` }]];
  }
  const fy = data.meta.fy;
  // The family's dollar estimates (the newest year's file), whose net the header chip shows; each hospital's row by CCN.
  const dollarsRel = dollarsPath(newest('data/emitted/dollars'));
  const dollarsFile = readJson(REPO_ROOT + dollarsRel);
  builtFiles.push([dollarsRel, dollarsFile]);
  const masterRel = masterPath(newest('data/emitted/hospital'));
  const masterFile = readJson(REPO_ROOT + masterRel);
  // The records as every site reads them (masterByCcn: names as the pages print them, a missing city as empty text).
  const master = masterByCcn(masterFile);
  // Every pin the read file was built from, the master's and the atlas. The pinned file has no `sources` of its own.
  const ids = new Set([...(source === 'emitted' ? data.sources : [PIN_ID]), HISTORY_PIN_ID, ...masterFile.sources, ...dollarsFile.sources, ATLAS_ID]);
  const atlas = JSON.parse(readPinned(ATLAS_ID));
  const whatsNew = readJson(CONTENT + 'whats_new.json');
  return {
    source,
    fy,
    meta: data.meta,
    conditions: data.conditions,
    // Each as the other sites read the master's records (hospitalRecord: names and aliases as the pages print them, a
    // missing city as empty text).
    hospitals: data.hospitals.map(hospitalRecord),
    history: data.history,
    // The fiscal years whose file lists each group the history leaves out (history-data.js scopeYears), for Methods.
    historyScope: scopeYears(parseCsv(readPinned(HISTORY_PIN_ID))),
    dictionary: readFileSync(REPO_ROOT + DICTIONARY_FILE, 'utf8'),
    whatsNew: whatsNew.items,
    // The fiscal year the notes are for: the program page shows them only in that year's edition.
    whatsNewFy: whatsNew.fy,
    timeline: readJson(CONTENT + 'timeline.json'),
    research: readJson(CONTENT + 'research.json'),
    master,
    dollars: new Map(dollarsFile.hospitals.map((r) => [r.ccn, r])),
    shapes: stateShapes(atlas),
    // The county lines the hospital page's nearby map draws inside the states.
    counties: countyShapes(atlas),
    manifest,
    pinsUsed: manifest.filter((e) => ids.has(e.id)),
    builtFiles,
    changedOn: changedOn(builtFiles),
    cmsReleased: data.meta.fileDate,
  };
}
