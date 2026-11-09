// The hospital master as the sites read it (the file: pipeline/files.js masterPath; its rules: pp_engine/master.py).
import { hospitalRecord } from '../web/render/format.js';

// A parsed hospital master's records by CCN, each as every site reads it (hospitalRecord: names as the pages print them,
// a missing city as empty text). The one place the hub, the HACRP site and the Readmissions site turn the file into records.
export const masterByCcn = (masterFile) => new Map(masterFile.hospitals.map((r) => [r.ccn, hospitalRecord(r)]));
