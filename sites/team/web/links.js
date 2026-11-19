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
});
