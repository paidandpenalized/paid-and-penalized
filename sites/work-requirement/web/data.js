// What the work-requirement pages read at build time: the newest emitted scenario file (data/emitted/medicaid/, written by
// `run.py emit`) and the manifest's entries for its inputs (for the newest date CMS gives any of them). File reads live
// here; the pages stay pure.
import { builtOn } from '../../../engine/js/dates.js';
import { rowsByCcn } from '../../../engine/js/medicaid/hospital.js';
import { REPO_ROOT, dollarsPath, masterPath, medicaidPath, newestYear, readJson, readManifest } from '../../../pipeline/files.js';

// A pinned input is CMS's when CMS serves it: its download, or the download of the file it was cut from or is a member
// of, is on a cms.gov or medicaid.gov host.
const CMS_HOST = /(^|\.)(cms|medicaid)\.gov$/;
export const isCms = (entry) => [entry.downloadUrl, entry.derivedFrom?.downloadUrl, entry.memberOf?.downloadUrl]
  .some((url) => typeof url === 'string' && CMS_HOST.test(new URL(url).hostname));
// The date CMS gives a pinned input, the first of: the Provider Data Catalog's release date (what HACRP's corrections line
// gives), its modified date, data.medicaid.gov's dataset modified date, and the Last-Modified date CMS's server gave the
// file the pin was cut from; null with none. Never `retrieved`: that is the day this site downloaded the file, not a date
// of CMS's.
export const cmsDate = (entry) => entry.pdcReleased ?? entry.pdcModified ?? entry.datasetModified ?? entry.derivedFrom?.lastModified ?? null;
// The newest such date among the given pinned inputs (manifest entries): the scenario is built from many files, so the
// corrections page gives the newest date CMS put on any of them (hub/copy.js correctionsSiteScenario says so).
export function newestCmsDate(entries) {
  const dates = entries.filter(isCms).map(cmsDate).filter(Boolean).sort();
  if (!dates.length) throw new RangeError('work requirement: no CMS input with a date of CMS\'s among the file\'s sources');
  return dates[dates.length - 1];
}

let loaded = null;

// The scenario file, read once per build:
//   meta        { fy (the base year: the HCRIS year, the year of the dollars), builtAt, changed (builtAt's day,
//               YYYY-MM-DD, UTC), cmsReleased (newestCmsDate over the file's sources), methodsVersion, sources,
//               penaltyFy (the fiscal year of the Medicare penalty estimates the rows carry: hrrp, hac, net),
//               penaltiesChanged (the day that year's dollar file was built: YYYY-MM-DD, UTC),
//               hcris (the file's `hcris`: the cost reports' settled share, whether the year is early, and master_fy and
//               dollars_fy, the years of the hospital master and the dollar file it was built from) }
//   pins        the manifest's entry for each of the file's sources, in the file's order (Methods lists them; the as-of
//               line reads their dates)
//   columns     the hospital rows' column names, in order (engine/js/medicaid/scenario.js rowToBase reads a row by them)
//   hospitals   each hospital's row (an array in columns' order), by CCN, in the file's order
//   states, national, groups, scenarios, params, sensitivities   as the file gives them (schemas/medicaid.schema.json)
export function loadMedicaid() {
  if (loaded) return loaded;
  const path = medicaidPath(newestYear('data/emitted/medicaid'));
  const file = readJson(REPO_ROOT + path);
  const changed = builtOn(file.built_at);
  if (!changed) throw new RangeError(`work requirement: ${path}: built_at is not a UTC timestamp in whole seconds: ${JSON.stringify(file.built_at)}`);
  const manifest = new Map(readManifest().map((e) => [e.id, e]));
  const missing = file.sources.filter((id) => !manifest.has(id));
  if (missing.length) throw new RangeError(`work requirement: ${path}: sources not in the manifest: ${missing.join(', ')}`);
  const dollars = loadDollars(file.hcris.dollars_fy);
  const penaltiesChanged = builtOn(dollars.built_at);
  if (!penaltiesChanged) throw new RangeError(`work requirement: the dollar file's built_at is not a UTC timestamp in whole seconds: ${JSON.stringify(dollars.built_at)}`);
  const pins = file.sources.map((id) => manifest.get(id));
  loaded = {
    meta: { fy: file.fy, builtAt: file.built_at, changed, cmsReleased: newestCmsDate(pins), methodsVersion: file.methods_version, sources: file.sources, penaltyFy: file.hcris.dollars_fy, penaltiesChanged, hcris: file.hcris },
    pins,
    columns: file.columns,
    hospitals: rowsByCcn(file.columns, file.hospitals),
    states: file.states,
    national: file.national,
    groups: file.groups,
    scenarios: file.scenarios,
    params: file.params,
    sensitivities: file.sensitivities,
  };
  return loaded;
}

// A year's dollar file (the Medicare penalty estimates; the newest without fy), each read once per build (loadMedicaid
// and loadSourceGroups read the scenario file's penalty year's; loadHubCcns reads the newest, the one the hub writes its
// pages from).
const dollarFiles = new Map();
function loadDollars(fy = newestYear('data/emitted/dollars')) {
  if (!dollarFiles.has(fy)) dollarFiles.set(fy, readJson(REPO_ROOT + dollarsPath(fy)));
  return dollarFiles.get(fy);
}

// A year's hospital master (the newest without fy), each read once per build: loadSourceGroups and loadAway read the one
// the scenario file was built from (meta.hcris.master_fy); loadAway reads the newest for the names of hospitals listed
// after it.
const masters = new Map();
function loadMaster(fy = newestYear('data/emitted/hospital')) {
  if (!masters.has(fy)) masters.set(fy, readJson(REPO_ROOT + masterPath(fy)));
  return masters.get(fy);
}

// The scenario file's sources by what they feed, for Methods' list: { scenario, hospitals, penalties }, each a list of
// source ids in the file's order. hospitals: the hospital master's (the list of hospitals, their names and places);
// penalties: the Medicare penalty estimates' (the dollar file's) not already among those; scenario: the rest (the state
// inputs and the cost reports). The master and the dollar file are the years the scenario file was built from. data:
// loadMedicaid()'s result.
export function loadSourceGroups(data) {
  const hospitals = new Set(loadMaster(data.meta.hcris.master_fy).sources);
  const penalties = new Set(loadDollars(data.meta.penaltyFy).sources);
  return sourceGroups(data.meta.sources, hospitals, penalties);
}
// The grouping, pure: sources (the file's ids), hospitals and penalties (sets of ids).
export const sourceGroups = (sources, hospitals, penalties) => ({
  scenario: sources.filter((id) => !hospitals.has(id) && !penalties.has(id)),
  hospitals: sources.filter((id) => hospitals.has(id)),
  penalties: sources.filter((id) => !hospitals.has(id) && penalties.has(id)),
});

// The CCNs with a hospital page across the programs (/hospital/<ccn>/): the hub writes one for every hospital in the newest
// hospital master (hub/model.js), so that master's CCNs are the ones the work requirement links, including the hospitals
// the scenario file leaves out (loadAway gives their reason).
let hub = null;
export function loadHubCcns() {
  hub ??= new Set(loadMaster().hospitals.map((h) => h.ccn));
  return hub;
}

// The facility kinds the scenario file covers (pipeline/py/pp_pipeline/medicaid/build.py KINDS).
const SCENARIO_KINDS = new Set(['acute', 'critical_access']);

// The hospitals with a page across the programs that the scenario file leaves out (it holds every active acute-care and
// critical access hospital in the master it was built from; the hub's pages, one per hospital in the newest master, also
// cover psychiatric, federal and other hospitals of other kinds, and those CMS has since listed as closed or changed, or
// listed after that master), so a ?h= that follows one of them
// names it on the program page with the reason: [ccn, name, city, state, why], in CCN order. why, read from the master
// the file was built from (built): 'newer' (that master doesn't list it: a newer one does), 'inactive' (it gives an
// inactive date) or 'kind' (neither acute care nor critical access). A hospital that master lists as active acute or
// critical access belongs in the file, so one missing throws. The name and place are the newest master's (newest), else
// built's. data: loadMedicaid()'s result; hubCcns: loadHubCcns()'s; masters: { built, newest }, master files (the
// default: the file's year's and the newest).
export function loadAway(data, hubCcns = loadHubCcns(), { built = loadMaster(data.meta.hcris.master_fy), newest = loadMaster() } = {}) {
  const left = [...hubCcns].filter((ccn) => !data.hospitals.has(ccn)).sort();
  if (!left.length) return [];
  const byCcn = (master) => new Map(master.hospitals.map((h) => [h.ccn, h]));
  const then = byCcn(built);
  const now = newest === built ? then : byCcn(newest);
  return left.map((ccn) => {
    const old = then.get(ccn);
    const h = now.get(ccn) ?? old;
    if (!h) throw new RangeError(`work requirement: CCN ${ccn} has a hub page but no hospital master record`);
    const why = !old ? 'newer' : old.inactive ? 'inactive' : !SCENARIO_KINDS.has(old.kind) ? 'kind' : null;
    if (!why) throw new RangeError(`work requirement: CCN ${ccn} is an active ${old.kind} hospital in the FY${data.meta.hcris.master_fy} master the scenario file was built from, but the file has no row for it`);
    return [ccn, h.name, h.city ?? '', h.state, why];
  });
}
