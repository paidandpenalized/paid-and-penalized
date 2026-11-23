// Where the TEAM site's pages live, and the public pages its words cite. No dependencies beyond the site's settings, so a
// browser script can build a link with it.
import { programById } from '../../../web/site.js';

export const PROGRAM_PATH = programById('team').path;
export const METHODS_PATH = `${PROGRAM_PATH}methods/`;

// The CMS pages and the rules the program page and Methods link (each a source of sites/team/CLAIMS.md).
export const SOURCE_LINKS = Object.freeze({
  model: 'https://www.cms.gov/priorities/innovation/innovation-models/team-model',
  participants: 'https://www.cms.gov/team-model-participant-list',
  faq: 'https://www.cms.gov/priorities/innovation/files/team-technical-faqs.pdf',
  cjrx: 'https://www.cms.gov/priorities/innovation/innovation-models/cjr-x',
  rule: 'https://www.ecfr.gov/current/title-42/chapter-IV/subchapter-B/part-512/subpart-E',
  // Methods' further sources: CMS's quality scoring fact sheet (the composite score's formula), the fiscal year 2027
  // inpatient final rule (the concurrent quality baseline), CMS's methodology for its Medicare inpatient file, and the
  // band's evidence: CMS's CJR final reconciliation file, the CJR evaluation's seventh annual report (its average target
  // prices are the count's denominator) and the BPCI Advanced final evaluation's appendix.
  qualityScoring: 'https://www.cms.gov/files/document/team-qualityscoring-fs.pdf',
  fy2027Rule: 'https://www.govinfo.gov/content/pkg/FR-2026-08-04/html/2026-15833.htm',
  mupMethod: 'https://data.cms.gov/sites/default/files/2024-06/MUP_INP_RY24_20240523_Methodology_508.pdf',
  cjrRecon: 'https://www.cms.gov/files/document/cjr-final-reconciliation-payments-yrs1-7.xlsx',
  cjrReport: 'https://www.cms.gov/priorities/innovation/data-and-reports/2025/cjr-py7-annual-report',
  bpciEval: 'https://www.cms.gov/priorities/innovation/data-and-reports/2026/bpci-adv-ar7-app',
});
