// What the HACRP pages read at build time: the newest emitted HACRP file, the newest hospital master, CMS's
// footnote crosswalk and the dataset's manifest entry, plus CMS's text for the line's two scores. File reads live here; views and pages stay pure.
import { CCN } from '../../../engine/js/ccn.js';
import { parseFootnotes } from '../../../engine/js/footnotes.js';
import { REPO_ROOT, masterPath, newestYear, readJson, readManifest, readPinned } from '../../../pipeline/files.js';
import { SOURCES, emittedPath } from '../pipeline/build.js';
import { boundaryText } from './view.js';

const FOOTNOTES_ID = 'y9us-9xdf';

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

  return {
    fy: data.fy,
    hospitals: data.hospitals,
    model: data.model,
    boundaryText: boundaryText(data.hospitals, data.model.boundary),
    estimate: data.estimate,
    periods,
    master,
    footnotes: parseFootnotes(readPinned(FOOTNOTES_ID)),
    source: { id: source.id, landingPage: source.landingPage, pdcReleased: source.pdcReleased },
  };
}
