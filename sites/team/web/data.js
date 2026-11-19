// What the TEAM pages read at build time: the newest emitted TEAM file (data/emitted/team/, written by `run.py emit`).
// File reads live here; the pages stay pure.
import { REPO_ROOT, newestYear, readJson, teamPath } from '../../../pipeline/files.js';

let loaded = null;

// The TEAM file, read once per build, as the file gives it:
//   meta          { listAsOf (CMS's participant list's date), cjrxAsOf (the CJR-X list's), pricesDated, mupYears,
//                   qualityReleased, methods_version }
//   prices, categoryAvg, drgCategory, participants, defaultCcn
//   status        { <ccn>: [code, arg] } for every hospital in the hospital master (lookup-copy.js says what each code means)
//   a4            { teamMissing: the participants' CCNs the master lacks, cjrxMissing: how many CJR-X list hospitals it lacks }
export function loadTeam() {
  loaded ??= readJson(REPO_ROOT + teamPath(newestYear('data/emitted/team')));
  return loaded;
}
