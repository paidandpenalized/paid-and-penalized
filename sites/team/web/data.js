// What the TEAM pages read at build time: the newest emitted TEAM file (data/emitted/team/, written by `run.py emit`), the
// hospital master (each hospital's place for the map) and the manifest's entries for the TEAM file's pins (Methods lists
// them). File reads live here; the pages stay pure.
import { REPO_ROOT, masterPath, newestYear, readJson, readManifest, readPinned, teamPath } from '../../../pipeline/files.js';
import { ATLAS_ID } from '../../../web/charts/geo.js';

let loaded = null;
let master = null;
let atlas = null;

// The TEAM file, read once per build, as the file gives it:
//   meta          { listAsOf (CMS's participant list's date), cjrxAsOf (the CJR-X list's), pricesDated, mupYears,
//                   qualityReleased, methods_version }
//   prices, categoryAvg, drgCategory, participants, defaultCcn
//   status        { <ccn>: [code, arg] } for every hospital in the hospital master (lookup-copy.js says what each code means)
//   a4            { teamMissing: the participants' CCNs the master lacks, cjrxMissing: how many CJR-X list hospitals it lacks }
//   counts        { selectedAreas: the CBSAs CMS's list gives its mandatory participants, cjrxListed: the CJR-X list's size }
//   otherIpps     the CCNs of the other open acute IPPS hospitals outside Maryland, not in TEAM (the map's hollow dots)
//   built_at      when the file was built (UTC); sources: its pins' ids
export function loadTeam() {
  loaded ??= readJson(REPO_ROOT + teamPath(newestYear('data/emitted/team')));
  return loaded;
}

// Each master hospital's place, by CCN: { state, lat, lon } (lat and lon null where the master has no point). Read once.
export function loadMaster() {
  if (!master) {
    const file = readJson(REPO_ROOT + masterPath(newestYear('data/emitted/hospital')));
    master = new Map(file.hospitals.map((h) => [h.ccn, { state: h.state, lat: h.lat ?? null, lon: h.lon ?? null }]));
  }
  return master;
}

// The manifest's entry for each of the TEAM file's sources, in the file's order (Methods lists them). Throws on a source
// the manifest lacks.
export function loadSources(team = loadTeam()) {
  const byId = new Map(readManifest().map((e) => [e.id, e]));
  return team.sources.map((id) => {
    const entry = byId.get(id);
    if (!entry) throw new RangeError(`TEAM: the manifest has no entry for the source ${id}`);
    return entry;
  });
}

// The pinned us-atlas topology the map is drawn from (web/charts/geo.js stateShapes reads its states). Read once.
export function loadAtlas() {
  atlas ??= JSON.parse(readPinned(ATLAS_ID));
  return atlas;
}
