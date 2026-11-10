// Where the work-requirement site's pages live. No dependencies beyond the site's settings, so the browser's scripts can
// build a link with it.
import { programById } from '../../../web/site.js';

export const PROGRAM_PATH = programById('work-requirement').path;
export const METHODS_PATH = `${PROGRAM_PATH}methods/`;

// The published sources Methods links (each a row of sites/work-requirement/CLAIMS.md), by what they are.
export const SOURCE_LINKS = Object.freeze({
  law: 'https://www.govinfo.gov/content/pkg/PLAW-119publ21/html/PLAW-119publ21.htm',
  rule: 'https://www.federalregister.gov/documents/2026/06/03/2026-11094/medicaid-program-community-engagement-requirement-for-certain-individuals',
  cbo: 'https://www.cbo.gov/publication/61837',
  urban: 'https://www.rwjf.org/content/dam/farm/reports/reports/2026/rwjf485284',
  cwf: 'https://www.commonwealthfund.org/sites/default/files/documents/___media_files_publications_fund_report_2017_jun_dobson_ahca_impact_safety_net_hosps_technical_appendix.pdf',
  pathways: 'https://www.medicaid.gov/medicaid/section-1115-demonstrations/downloads/ga-pathway-pa-04282025.pdf',
  hscrc: 'https://hscrc.maryland.gov/Pages/UCC.aspx',
  hscrcDeck: 'https://hscrc.maryland.gov/Documents/DanielaT%20Uploads/5%20-%20Payment%20Models%20Workgroup%20-PayMods/RY27%20(2026)/PMWG040126.pptx.pdf',
});
