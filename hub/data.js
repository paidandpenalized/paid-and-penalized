// What the hub reads at build time: the newest dollar estimates, the newest hospital master, the pinned Thirty Day
// Readmissions file and the US atlas. File reads live here; the model, the asset and the pages stay pure.
import { ATLAS_ID, stateShapes } from '../web/charts/geo.js';
import { REPO_ROOT, dollarsPath, masterPath, newestYear, readJson, readPinned } from '../pipeline/files.js';

// The pinned copy of Thirty Day Readmissions' published data: its hospitals decide which hospitals have a Readmissions
// page there.
export const TDR_ID = 'tdr-hrrp-fy2027';

// The inputs must agree before any page is built from them: the dollar estimates are for the year the master calls its
// HACRP year (the common fiscal year the hub shows), every dollar CCN is in the master, and the Thirty Day Readmissions
// file is for the master's HRRP year. Throws a RangeError naming the mismatch.
export function checkHubInputs({ dollars, masterFile, tdrFy }) {
  const years = masterFile.programYears;
  if (dollars.fy !== years?.hacrp) throw new RangeError(`hub: the dollar estimates are FY${dollars.fy} but the hospital master's HACRP year is ${years?.hacrp}`);
  if (tdrFy !== years.hrrp) throw new RangeError(`hub: the Thirty Day Readmissions file is FY${tdrFy} but the hospital master's HRRP year is ${years.hrrp}`);
  const known = new Set(masterFile.hospitals.map((r) => r.ccn));
  for (const row of dollars.hospitals) if (!known.has(row.ccn)) throw new RangeError(`hub: CCN ${row.ccn} has a dollar row but no hospital master record`);
}

let loaded = null;

// Everything the hub's pages are built from, read once per build:
//   fy, builtAt   the dollar estimates' fiscal year and when the file was built
//   dollars       the parsed dollar file (rows and national totals)
//   master        the hospital master's records by CCN
//   tdr           { fy, conditions, hospitals: Map<ccn, record> } from the pinned Thirty Day Readmissions file
//   shapes        the states' outlines (stateShapes of the atlas), by postal code
export function loadHub() {
  if (loaded) return loaded;
  const dollars = readJson(REPO_ROOT + dollarsPath(newestYear('data/emitted/dollars')));
  const masterFile = readJson(REPO_ROOT + masterPath(newestYear('data/emitted/hospital')));
  const pinned = JSON.parse(readPinned(TDR_ID));
  checkHubInputs({ dollars, masterFile, tdrFy: pinned.meta.fy });
  loaded = {
    fy: dollars.fy,
    builtAt: dollars.built_at,
    dollars,
    master: new Map(masterFile.hospitals.map((r) => [r.ccn, r])),
    tdr: { fy: pinned.meta.fy, conditions: pinned.conditions, hospitals: new Map(pinned.hospitals.map((r) => [r.id, r])) },
    shapes: stateShapes(JSON.parse(readPinned(ATLAS_ID))),
  };
  return loaded;
}
