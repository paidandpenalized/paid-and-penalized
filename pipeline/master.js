// The hospital master as the sites read it (the file: pipeline/files.js masterPath; its rules: pp_engine/master.py).
import { hospitalRecord } from '../web/render/format.js';

// A parsed hospital master's records by CCN, each as every site reads it (hospitalRecord: names as the pages print them,
// a missing city as empty text). The one place the hub, the HACRP site and the Readmissions site turn the file into records.
export const masterByCcn = (masterFile) => new Map(masterFile.hospitals.map((r) => [r.ccn, hospitalRecord(r)]));

// Whether a CMS file names the hospital with this CCN: the master names one that none does "Hospital <CCN> (name not in
// CMS files)" (pp_engine/master.py build_record; a test holds the two to one wording). A page keeps such a hospital out of
// search engines until a file names it.
export const cmsNamed = (name, ccn) => name !== `Hospital ${ccn} (name not in CMS files)`;
