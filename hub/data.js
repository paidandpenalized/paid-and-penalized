// What the hub reads at build time: the newest dollar estimates, the newest hospital master, the pinned Thirty Day
// Readmissions file and the US atlas. File reads live here; the model, the asset and the pages stay pure.
import { ATLAS_ID, stateShapes } from '../web/charts/geo.js';
import { REPO_ROOT, dollarsPath, masterPath, newestYear, readJson, readPinned } from '../pipeline/files.js';
import { nameText } from '../web/render/format.js';
import { hubHospitals, masterRecord, storyFacts } from './model.js';

// The pinned copy of Thirty Day Readmissions' published data: its hospitals decide which hospitals have a Readmissions
// page there.
export const TDR_ID = 'tdr-hrrp-fy2027';

// The inputs must agree before any page is built from them: the dollar estimates are for the year the master calls its
// HACRP year (the common fiscal year the hub shows), every dollar CCN is in the master, and the Thirty Day Readmissions
// file is for the master's HRRP year. Throws a RangeError naming the mismatch. A dollar CCN with no master record is
// caught by model.js's masterRecord, the check hubHospitals makes too, so the message is one.
export function checkHubInputs({ dollars, masterFile, tdrFy }) {
  const years = masterFile.programYears;
  if (!Number.isInteger(years?.hacrp) || !Number.isInteger(years?.hrrp)) throw new RangeError('hub: the hospital master names no HACRP and HRRP program years');
  if (dollars.fy !== years.hacrp) throw new RangeError(`hub: the dollar estimates are FY${dollars.fy} but the hospital master's HACRP year is ${years.hacrp}`);
  if (tdrFy !== years.hrrp) throw new RangeError(`hub: the Thirty Day Readmissions file is FY${tdrFy} but the hospital master's HRRP year is ${years.hrrp}`);
  const master = new Map(masterFile.hospitals.map((r) => [r.ccn, r]));
  for (const row of dollars.hospitals) masterRecord(master, row.ccn);
}

let loaded = null;

// Everything the hub's pages are built from, read once per build:
//   fy, builtAt   the dollar estimates' fiscal year and when the file was built
//   dollars       the parsed dollar file (rows and national totals)
//   master        the hospital master's records by CCN, each name as the pages print it (nameText)
//   tdr           { fy, conditions, peerMedians, hospitals: Map<ccn, record> } from the pinned Thirty Day Readmissions file
//                 (peerMedians: each peer group's median ratio by condition, { '<group>': { <key>: median } }, which CMS compares
//                 a hospital's ratios with)
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
    master: new Map(masterFile.hospitals.map((r) => [r.ccn, { ...r, name: nameText(r.name) }])),
    tdr: { fy: pinned.meta.fy, conditions: pinned.conditions, peerMedians: pinned.meta.peerMedians, hospitals: new Map(pinned.hospitals.map((r) => [r.id, r])) },
    shapes: stateShapes(JSON.parse(readPinned(ATLAS_ID))),
  };
  return loaded;
}

let model = null;

// The hub's hospitals (model.js hubHospitals) and their story facts (storyFacts), from loadHub's files, worked out once per
// build: the build's context (the shell's facts and the hub's data asset, pipeline/site/build.js) and the hub's pages
// (pages.js) share them. { hub: loadHub(), hospitals, facts }.
export function hubModel() {
  if (model) return model;
  const hub = loadHub();
  const hospitals = hubHospitals(hub);
  model = { hub, hospitals, facts: storyFacts(hospitals) };
  return model;
}
