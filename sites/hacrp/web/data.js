// What the HACRP pages read at build time: the newest emitted HACRP file, the newest hospital master, CMS's
// footnote crosswalk and the dataset's manifest entry. File reads live here; views and pages stay pure.
import { readdirSync } from 'node:fs';
import { parseFootnotes } from '../../../engine/js/footnotes.js';
import { REPO_ROOT, readJson, readManifest, readPinned } from '../../../pipeline/files.js';
import { SOURCES, emittedPath } from '../pipeline/build.js';

export const CCN = /^[0-9A-Z]{6}$/;
const FOOTNOTES_ID = 'y9us-9xdf';

// The newest fy<YYYY> folder under a data/emitted/ directory, as a number.
function newestYear(dir) {
  const years = readdirSync(REPO_ROOT + dir).map((f) => /^fy(\d{4})$/.exec(f)?.[1]).filter(Boolean).map(Number);
  if (!years.length) throw new RangeError(`no fy<YYYY> folder under ${dir}`);
  return Math.max(...years);
}

export function loadHacrp() {
  const data = readJson(REPO_ROOT + emittedPath(newestYear('data/emitted/hacrp')));
  const masterFile = readJson(`${REPO_ROOT}data/emitted/hospital/fy${newestYear('data/emitted/hospital')}/hospital_master.json`);
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

  return {
    fy: data.fy,
    hospitals: data.hospitals,
    model: data.model,
    estimate: data.estimate,
    periods,
    master,
    footnotes: parseFootnotes(readPinned(FOOTNOTES_ID)),
    source: { id: source.id, landingPage: source.landingPage, pdcReleased: source.pdcReleased },
  };
}
