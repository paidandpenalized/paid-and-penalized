// What the work-requirement pages read at build time: the newest emitted scenario file (data/emitted/medicaid/, written by
// `run.py emit`) and the manifest's entries for its inputs (for the newest date CMS gives any of them). File reads live
// here; the pages stay pure.
import { builtOn } from '../../../engine/js/dates.js';
import { REPO_ROOT, dollarsPath, medicaidPath, newestYear, readJson, readManifest } from '../../../pipeline/files.js';

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
//               YYYY-MM-DD, UTC), cmsReleased (newestCmsDate over the file's sources), methodsVersion, sources }
//   columns     the hospital rows' column names, in order (engine/js/medicaid/scenario.js rowToBase reads a row by them)
//   hospitals   each hospital's row (an array in columns' order), by CCN, in the file's order
//   states, national, groups, scenarios, params   as the file gives them (schemas/medicaid.schema.json)
export function loadMedicaid() {
  if (loaded) return loaded;
  const path = medicaidPath(newestYear('data/emitted/medicaid'));
  const file = readJson(REPO_ROOT + path);
  const changed = builtOn(file.built_at);
  if (!changed) throw new RangeError(`work requirement: ${path}: built_at is not a UTC timestamp in whole seconds: ${JSON.stringify(file.built_at)}`);
  const manifest = new Map(readManifest().map((e) => [e.id, e]));
  const missing = file.sources.filter((id) => !manifest.has(id));
  if (missing.length) throw new RangeError(`work requirement: ${path}: sources not in the manifest: ${missing.join(', ')}`);
  const ccn = file.columns.indexOf('ccn');
  loaded = {
    meta: { fy: file.fy, builtAt: file.built_at, changed, cmsReleased: newestCmsDate(file.sources.map((id) => manifest.get(id))), methodsVersion: file.methods_version, sources: file.sources },
    columns: file.columns,
    hospitals: new Map(file.hospitals.map((row) => [row[ccn], row])),
    states: file.states,
    national: file.national,
    groups: file.groups,
    scenarios: file.scenarios,
    params: file.params,
  };
  return loaded;
}

// The CCNs with a hospital page across the programs (/hospital/<ccn>/): the hub writes one for every hospital in the newest
// dollar estimates (hub/model.js hubHospitals), so the work requirement links a hospital there only when it is in that
// file, as the Readmissions site does (sites/hrrp/web/view.js inHubOf).
let hub = null;
export function loadHubCcns() {
  hub ??= new Set(readJson(REPO_ROOT + dollarsPath(newestYear('data/emitted/dollars'))).hospitals.map((r) => r.ccn));
  return hub;
}
