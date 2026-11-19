// What the hub reads at build time: the newest dollar estimates, the newest hospital master, the HACRP site's emitted
// file for the same year (which hospitals CMS scored and decided), the Readmissions site's newest emitted file, the
// work-requirement scenario's newest emitted file (its national roll-ups, the footer's figure) and the US atlas. File
// reads live here; the model, the asset and the pages stay pure.
import { decidedHospitals } from '../engine/js/hacrp/hospital.js';
import { rowsByCcn } from '../engine/js/medicaid/hospital.js';
import { existsSync } from 'node:fs';
import { ATLAS_ID, countyShapes, stateShapes } from '../web/charts/geo.js';
import { dataYearOf } from '../web/team/calc-data.js';
import { REPO_ROOT, dollarsPath, hacrpPath, hrrpPath, masterPath, medicaidPath, newestYear, readJson, readPinned, teamPath } from '../pipeline/files.js';
import { masterByCcn } from '../pipeline/master.js';
import { hubHospitals, masterRecord, storyFacts } from './model.js';
import { likeCounts, outsideHospitals } from './outside.js';

// The inputs must agree before any page is built from them: the dollar estimates are for the year the master calls its
// HACRP year (the common fiscal year the hub shows), every dollar CCN is in the master, and the Readmissions
// file is for the master's HRRP year. Throws a RangeError naming the mismatch. A dollar CCN with no master record is
// caught by model.js's masterRecord, the check hubHospitals makes too, so the message is one.
export function checkHubInputs({ dollars, masterFile, hrrpFy }) {
  const years = masterFile.programYears;
  if (!Number.isInteger(years?.hacrp) || !Number.isInteger(years?.hrrp)) throw new RangeError('hub: the hospital master names no HACRP and HRRP program years');
  if (dollars.fy !== years.hacrp) throw new RangeError(`hub: the dollar estimates are FY${dollars.fy} but the hospital master's HACRP year is ${years.hacrp}`);
  if (hrrpFy !== years.hrrp) throw new RangeError(`hub: the Readmissions file is FY${hrrpFy} but the hospital master's HRRP year is ${years.hrrp}`);
  const master = new Map(masterFile.hospitals.map((r) => [r.ccn, r]));
  for (const row of dollars.hospitals) masterRecord(master, row.ccn);
}

// The CCNs of the hospitals the HACRP site's emitted file gives a Total HAC Score and a Yes or No payment decision (the
// engine's decidedHospitals, the population the HACRP pages count), refused unless the file is for the fiscal year fy.
export function decidedCcns(hacrp, fy) {
  if (hacrp.fy !== fy) throw new RangeError(`hub: the HACRP site's emitted file is FY${hacrp.fy} but the dollar estimates are FY${fy}`);
  return new Set(decidedHospitals(hacrp.hospitals).map((h) => h.ccn));
}

// The newest emitted Readmissions file's path; a missing folder, year or file stops the build with one message.
function newestHrrpFile() {
  const stop = (what) => new RangeError(`hub: ${what}: emit the Readmissions site's year first (make emit)`);
  let fy;
  try {
    fy = newestYear('data/emitted/hrrp');
  } catch (e) {
    if (e instanceof RangeError) throw stop(e.message);
    throw e;
  }
  const file = hrrpPath(fy);
  if (!existsSync(REPO_ROOT + file)) throw stop(`there is no ${file}`);
  return file;
}

let loaded = null;

// Everything the hub's pages are built from, read once per build:
//   fy, builtAt   the dollar estimates' fiscal year and when the file was built
//   dollars       the parsed dollar file (rows and national totals)
//   master        the hospital master's records by CCN, as every site reads them (pipeline/master.js masterByCcn)
//   programYears  the master's { hacrp, hrrp }: the fiscal year of each program file its reason codes come from
//   decided       the CCNs of the hospitals CMS scored and gave a Yes or No in the dollar estimates' year (a Set), from
//                 the HACRP site's emitted file: the HACRP pages count only these, so the hub's words can too
//   hrrp          { fy, hospitals: Map<ccn, record>, national } from the Readmissions site's newest emitted file: a hospital
//                 in it has a Readmissions page, and its record's factor (paf) is the newer-factor note's; national is its
//                 history's row for each year CMS published ({ fy, n, nPen, ... }), which the Methods page's counts read
//   medicaid      { fy, national, columns, hospitals, states } from the work-requirement scenario's newest emitted file:
//                 fy is its base year (the year of its dollars), national its low, middle and high roll-ups, columns and
//                 states as the file gives them, hospitals its rows by CCN (engine/js/medicaid/hospital.js rowsByCcn), which
//                 a hospital page's Medicaid band reads (hospital/medicaid.js)
//   team          from the TEAM site's newest emitted file: listed, how many hospitals CMS's TEAM list names (the
//                 footer's and the directory's figure, the file's counts.listed); meta as the file gives it (the list's
//                 date, the episodes' data years); dataYear, the year the episode counts come from (web/team/calc-data.js
//                 dataYearOf, worked out once here, not per page); participants, its participant rows by CCN (one per list
//                 CCN the hospital master has), which a participant's hospital page's TEAM section reads (hospital/team.js)
//   shapes        the states' outlines (stateShapes of the atlas), by postal code
//   counties      every county's outline (countyShapes of the same atlas, parsed once)
export function loadHub() {
  if (loaded) return loaded;
  const dollars = readJson(REPO_ROOT + dollarsPath(newestYear('data/emitted/dollars')));
  const masterFile = readJson(REPO_ROOT + masterPath(newestYear('data/emitted/hospital')));
  const hrrpFile = newestHrrpFile();
  const hrrp = readJson(REPO_ROOT + hrrpFile);
  checkHubInputs({ dollars, masterFile, hrrpFy: hrrp.fy });
  const hacrpFile = hacrpPath(dollars.fy);
  if (!existsSync(REPO_ROOT + hacrpFile)) throw new RangeError(`hub: the dollar estimates are FY${dollars.fy} but there is no ${hacrpFile}: emit the HACRP site's year first (make emit)`);
  const hacrp = readJson(REPO_ROOT + hacrpFile);
  // Read as the hub reads the other sites' emitted files, by path: the hub imports no site's code.
  const medicaid = readJson(REPO_ROOT + medicaidPath(newestYear('data/emitted/medicaid')));
  const team = readJson(REPO_ROOT + teamPath(newestYear('data/emitted/team')));
  const atlas = JSON.parse(readPinned(ATLAS_ID));
  loaded = {
    fy: dollars.fy,
    builtAt: dollars.built_at,
    dollars,
    master: masterByCcn(masterFile),
    programYears: masterFile.programYears,
    decided: decidedCcns(hacrp, dollars.fy),
    hrrp: { fy: hrrp.fy, hospitals: new Map(hrrp.hospitals.map((r) => [r.id, r])), national: hrrp.history.national },
    medicaid: { fy: medicaid.fy, national: medicaid.national, columns: medicaid.columns, hospitals: rowsByCcn(medicaid.columns, medicaid.hospitals), states: medicaid.states },
    team: { listed: team.counts.listed, meta: team.meta, dataYear: dataYearOf(team.meta), participants: new Map(team.participants.map((p) => [p.ccn, p])) },
    shapes: stateShapes(atlas),
    counties: countyShapes(atlas),
  };
  return loaded;
}

let model = null;

// The hub's hospitals (model.js hubHospitals) and their story facts (storyFacts), from loadHub's files, worked out once per
// build: the build's context (the shell's facts and the hub's data asset, pipeline/site/build.js) and the hub's pages
// (pages.js) share them. { hub: loadHub(), hospitals, facts, outside, likeCounts }, outside being the master's hospitals the dollar
// file does not have (outside.js) and likeCounts their counts by group, by state (outside.js likeCounts).
export function hubModel() {
  if (model) return model;
  const hub = loadHub();
  const hospitals = hubHospitals(hub);
  const dollarCcns = new Set(hub.dollars.hospitals.map((r) => r.ccn));
  const outside = outsideHospitals({ master: hub.master, dollarCcns, hrrp: hub.hrrp });
  model = { hub, hospitals, facts: storyFacts(hospitals), outside, likeCounts: likeCounts(outside) };
  return model;
}
