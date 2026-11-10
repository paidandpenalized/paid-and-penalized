// What the work-requirement pages read at build time: the newest emitted scenario file (data/emitted/medicaid/, written by
// `run.py emit`) and the pinned CMS-64 file's entry in the manifest (the date CMS last changed the newest CMS input).
// File reads live here; the pages stay pure.
import { builtOn } from '../../../engine/js/dates.js';
import { REPO_ROOT, medicaidPath, newestYear, readJson, readManifest } from '../../../pipeline/files.js';

// The pinned CMS-64 new adult group expenditures (data.medicaid.gov): the scenario's newest CMS input, whose
// datasetModified is the date the corrections page gives as CMS's release.
export const CMS64_PIN_ID = 'cms64-viii-2026-02';

let loaded = null;

// The scenario file, read once per build:
//   meta        { fy (the base year: the HCRIS year, the year of the dollars), builtAt, changed (builtAt's day,
//               YYYY-MM-DD, UTC), cmsReleased (the CMS-64 file's date), methodsVersion, sources }
//   columns     the hospital rows' column names, in order (engine/js/medicaid/scenario.js rowToBase reads a row by them)
//   hospitals   each hospital's row (an array in columns' order), by CCN, in the file's order
//   states, national, groups, scenarios, params   as the file gives them (schemas/medicaid.schema.json)
export function loadMedicaid() {
  if (loaded) return loaded;
  const path = medicaidPath(newestYear('data/emitted/medicaid'));
  const file = readJson(REPO_ROOT + path);
  const changed = builtOn(file.built_at);
  if (!changed) throw new RangeError(`work requirement: ${path}: built_at is not a UTC timestamp in whole seconds: ${JSON.stringify(file.built_at)}`);
  if (!file.sources.includes(CMS64_PIN_ID)) throw new RangeError(`work requirement: ${path} is not built from ${CMS64_PIN_ID}: update CMS64_PIN_ID`);
  const cms64 = readManifest().find((e) => e.id === CMS64_PIN_ID);
  const ccn = file.columns.indexOf('ccn');
  loaded = {
    meta: { fy: file.fy, builtAt: file.built_at, changed, cmsReleased: cms64.datasetModified, methodsVersion: file.methods_version, sources: file.sources },
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
