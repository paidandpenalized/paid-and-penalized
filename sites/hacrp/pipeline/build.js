// HACRP emitted data: CMS's published values for every hospital in the pinned file, plus the model the what-if
// and solver need, wrapped in the data-contract envelope. Pure: rows and manifest in, object out. Where the file is
// written is here too (newestEmittedPath and readNewestEmitted alone read the disk: which years have been emitted, and
// the newest one's file).
import { MEASURE_IDS } from '../../../engine/js/hacrp/measures.js';
import { toHospital } from '../../../engine/js/hacrp/hospital.js';
import { buildModel } from '../../../engine/js/hacrp/model.js';
import { estimateTagged } from '../../../engine/js/hacrp/params.js';
import { envelope } from '../../../pipeline/contract.js';
import { REPO_ROOT, newestYear, readJson } from '../../../pipeline/files.js';

export const SCHEMA_VERSION = 1;
export const METHODS_VERSION = 2;
export const SOURCES = ['yq43-i98g'];

export const emittedPath = (fy) => `data/emitted/hacrp/fy${fy}/hacrp.json`;
// The newest year's file, repo-relative: the one the pages, the link check and the browser checks read; and that file,
// read.
export const newestEmittedPath = () => emittedPath(newestYear('data/emitted/hacrp'));
export const readNewestEmitted = () => readJson(REPO_ROOT + newestEmittedPath());

// The one fiscal year in CMS's file, as a number.
export function fiscalYear(rows) {
  const years = new Set(rows.map((r) => r['Fiscal Year']));
  if (years.size !== 1) throw new RangeError(`HACRP: expected one fiscal year in the file, found ${[...years].join(', ')}`);
  const [fy] = years;
  if (!/^\d{4}$/.test(fy)) throw new RangeError(`HACRP: fiscal year "${fy}" is not a year`);
  return Number(fy);
}

export function buildHacrp({ rows, manifest, builtAt }) {
  const hospitals = rows.map(toHospital);
  return {
    ...envelope({ schemaVersion: SCHEMA_VERSION, methodsVersion: METHODS_VERSION, sources: SOURCES, manifest, builtAt, fy: fiscalYear(rows) }),
    model: buildModel(hospitals),
    estimate: Object.fromEntries(MEASURE_IDS.map((id) => [id, estimateTagged(hospitals, id)])),
    hospitals,
  };
}
