// Family-wide settings every page reads: the name, the canonical origin, the family's own pages, the licenses, the
// byline's profile, the feedback form, the hub's state, each site (its path, names and state) and the program registry.
// The hub or a site with released: false stays noindex and out of the sitemap even in a production build.
// pages: the hub's policy pages and the family's Methods, by name, in the order the footer's second field lists them,
// each labelled with web/copy.js's word of the same name (Terms: termsLink, which the footer's Terms line links too).
// feedback: the shared Google Form, and the names of its two prefilled questions (the site's name, the page's address).
export const SITE = {
  name: 'Paid & Penalized',
  origin: 'https://paidandpenalized.org',
  pages: { methods: '/methods/', about: '/about/', corrections: '/corrections/', accessibility: '/accessibility/', privacy: '/privacy/', terms: '/terms/' },
  // The site's text, charts and derived data, and its code.
  license: { content: { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' }, code: { name: 'MIT' } },
  // This repository: the code that builds the site, its tests and its pinned inputs (a program's Methods page links it).
  repo: 'https://github.com/paidandpenalized/paid-and-penalized',
  // The byline's profile (the About page links it too).
  linkedin: 'https://www.linkedin.com/in/dalton-haslam',
  feedback: {
    url: 'https://docs.google.com/forms/d/e/1FAIpQLSekdB41siZs44_4gLNBGD2OqalK2TGNk7o8Q0bHl20ggYBy_Q/viewform',
    siteEntry: 'entry.2047320042',
    pageEntry: 'entry.1326474028',
  },
  // The family's own pages (the hub's).
  hub: { released: true },
  sites: {
    hacrp: { path: '/hacrp/', released: true, title: 'Hospital-Acquired Conditions', subtitle: 'HACRP' },
    hrrp: { path: '/hrrp/', released: true, title: 'Readmissions', subtitle: 'HRRP' },
  },
  // Every program, live and under consideration, in the order the shell's tabs and the home page's directory show them.
  // Separate from `sites` (the sites built in this repo): a program here may have no site.
  //   name, ab, long   the tab's name, its short form, and CMS's name for the program
  //   path             the program's folder (a program not built here holds a placeholder page there)
  //   stage            live (a site here), soon (no page here: not built; the id is internal)
  //   group            what the program does to payment: quality (a cut or bonus for scores), price (an adjustment to
  //                    the rate), reporting (a cut for not reporting), episode (a spending target)
  //   inData           whether the dollar estimates (hub/) include the program
  programs: [
    { id: 'hrrp', name: 'Readmissions', ab: 'HRRP', long: 'Hospital Readmissions Reduction Program', path: '/hrrp/', stage: 'live', group: 'quality', inData: true },
    { id: 'hacrp', name: 'Hospital-acquired conditions', ab: 'HACRP', long: 'Hospital-Acquired Condition Reduction Program', path: '/hacrp/', stage: 'live', group: 'quality', inData: true },
    { id: 'hvbp', name: 'Value-based purchasing', ab: 'HVBP', long: 'Hospital Value-Based Purchasing Program', path: '/hvbp/', stage: 'soon', group: 'quality', inData: true },
    { id: 'wage-index', name: 'Local wages', ab: 'Wage index', long: 'Hospital Wage Index', path: '/wage-index/', stage: 'soon', group: 'price', inData: false },
    { id: 'dsh', name: 'Low-income patients', ab: 'DSH + UC', long: 'Medicare Disproportionate Share Hospital and Uncompensated Care Payments', path: '/dsh/', stage: 'soon', group: 'price', inData: false },
    { id: 'ime', name: 'Teaching', ab: 'IME', long: 'Indirect Medical Education Adjustment', path: '/ime/', stage: 'soon', group: 'price', inData: false },
    { id: 'iqr', name: 'Quality reporting', ab: 'IQR', long: 'Hospital Inpatient Quality Reporting Program', path: '/iqr/', stage: 'soon', group: 'reporting', inData: false },
    { id: 'pi', name: 'Electronic health records', ab: 'PI', long: 'Medicare Promoting Interoperability Program', path: '/pi/', stage: 'soon', group: 'reporting', inData: false },
    { id: 'team', name: 'Surgical episodes', ab: 'TEAM', long: 'Transforming Episode Accountability Model', path: '/team/', stage: 'soon', group: 'episode', inData: false },
  ],
};

// The site a page belongs to, by its path: the entry in SITE.sites whose path starts the page's, or null for the
// family's own pages (the hub).
export const siteOf = (path) => Object.values(SITE.sites).find((site) => path.startsWith(site.path)) ?? null;

// Care Compare, Medicare's hospital finder, and a hospital's page on it by its CCN (each site's record card links to it),
// with the "/" Care Compare's own address ends in (without it, Care Compare answers with a redirect to it).
export const CARE_COMPARE = 'https://www.medicare.gov/care-compare/';
export const careCompareHref = (ccn) => `${CARE_COMPARE}details/hospital/${encodeURIComponent(ccn)}/`;

// A program by its id (SITE.programs), or null for an id the registry has not.
export const programById = (id) => SITE.programs.find((p) => p.id === id) ?? null;

// The program whose folder holds a page's path (SITE.programs), or null for the family's own pages (the hub's).
export const programOf = (path) => SITE.programs.find((program) => path.startsWith(program.path)) ?? null;

// The registry's programs in the groups the family's pages show, each in the registry's order. Listed: the live and
// programs and the not-built ones the dollar estimates already include, the shell's tabs and the footer's
// figures; unlisted: the rest, under consideration, the footer's "Under consideration:" line and the front page's
// slips (no tab). Placeholder: every program with no page here (stage soon), whose folder holds the hub's placeholder
// page (hub/coming.js). A live program's folder holds its site.
export const LISTED_PROGRAMS = Object.freeze(SITE.programs.filter((p) => p.stage !== 'soon' || p.inData));
export const UNLISTED_PROGRAMS = Object.freeze(SITE.programs.filter((p) => !LISTED_PROGRAMS.includes(p)));
export const PLACEHOLDER_PROGRAMS = Object.freeze(SITE.programs.filter((p) => p.stage === 'soon'));
// A program under construction: one the dollar estimates include whose page here is not built (its placeholder page, the
// front page's directory and a hospital page's link say so).
export const underConstruction = (p) => p.stage === 'soon' && p.inData;

// The folder that holds hospitals' pages: 'hub' (the hospital page across the programs, /hospital/), 'hacrp' or 'hrrp'
// (that site's hospital pages, under its program's folder); null for any other program, which has none yet.
export function hospitalFolderOf(programId) {
  if (programId === 'hub') return '/hospital/';
  return programId === 'hacrp' || programId === 'hrrp' ? `${programById(programId).path}hospital/` : null;
}

// The address of a hospital's page in a program (hospitalFolderOf), or null when the program has none for it: a hospital
// in the dollar file (inHub, as every hospital the hub's pages and data hold is) has a hub page and a HACRP page, and one
// the Readmissions site lists (inHrrp, which the hub marks from that site's emitted file) a Readmissions page: the
// Readmissions site writes a page for every hospital in its data file. Folders are lowercase, so the CCN is too.
export function hospitalPathOf(programId, ccn, { inHrrp = false, inHub = true } = {}) {
  const folder = hospitalFolderOf(programId);
  return folder && (programId === 'hrrp' ? inHrrp : inHub) ? `${folder}${ccn.toLowerCase()}/` : null;
}
