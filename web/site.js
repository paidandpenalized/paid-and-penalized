// Family-wide settings every page reads: the name, the canonical origin, the family's own pages, the licenses, the
// byline's profile, the feedback form, the hub's state, each site (its path, names and state) and the program registry.
// The hub or a site with released: false stays noindex and out of the sitemap even in a production build; go-live
// flips them here.
// pages: the hub's policy pages and the family's Methods, by name, in the order the footer's second field lists them,
// each labelled with web/copy.js's word of the same name (Terms: termsLink, which the footer's Terms line links too).
// feedback: the shared Google Form, and the names of its two prefilled questions (the site's name, the page's address).
export const SITE = {
  name: 'Paid & Penalized',
  origin: 'https://paidandpenalized.org',
  pages: { methods: '/methods/', about: '/about/', corrections: '/corrections/', accessibility: '/accessibility/', privacy: '/privacy/', terms: '/terms/' },
  // The site's text, charts and derived data, and its code.
  license: { content: { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' }, code: { name: 'MIT' } },
  // The byline's profile (the About page links it too).
  linkedin: 'https://www.linkedin.com/in/dalton-haslam',
  feedback: {
    url: 'https://docs.google.com/forms/d/e/1FAIpQLSekdB41siZs44_4gLNBGD2OqalK2TGNk7o8Q0bHl20ggYBy_Q/viewform',
    siteEntry: 'entry.2047320042',
    pageEntry: 'entry.1326474028',
  },
  // The family's own pages (the hub's): noindex in every build until the hub is built.
  hub: { released: false },
  sites: {
    hacrp: { path: '/hacrp/', released: false, title: 'Hospital-Acquired Conditions', subtitle: 'HACRP' },
  },
  // Every program, live and under consideration, in the order the shell's tabs and the home page's directory show them.
  // Separate from `sites` (the sites built in this repo): a program here may have no site.
  //   name, ab, long   the tab's name, its short form, and CMS's name for the program
  //   path             the program's folder (a program not built here holds a placeholder page there)
  //   stage            live (a site here), interim (a slim page here until Thirty Day Readmissions folds in), soon
  //                    (no page here: not built; the id is internal)
  //   group            what the program does to payment: quality (a cut or bonus for scores), price (an adjustment to
  //                    the rate), reporting (a cut for not reporting), episode (a spending target)
  //   inData           whether the dollar estimates (hub/) include the program
  programs: [
    { id: 'hrrp', name: 'Readmissions', ab: 'HRRP', long: 'Hospital Readmissions Reduction Program', path: '/hrrp/', stage: 'interim', group: 'quality', inData: true },
    { id: 'hacrp', name: 'Hospital-acquired conditions', ab: 'HACRP', long: 'Hospital-Acquired Condition Reduction Program', path: '/hacrp/', stage: 'live', group: 'quality', inData: true },
    { id: 'hvbp', name: 'Value-based purchasing', ab: 'HVBP', long: 'Hospital Value-Based Purchasing Program', path: '/hvbp/', stage: 'soon', group: 'quality', inData: true },
    { id: 'wage-index', name: 'Local wages', ab: 'Wage index', long: 'Hospital Wage Index', path: '/wage-index/', stage: 'soon', group: 'price', inData: false },
    { id: 'dsh', name: 'Low-income patients', ab: 'DSH + UC', long: 'Medicare Disproportionate Share Hospital and Uncompensated Care Payments', path: '/dsh/', stage: 'soon', group: 'price', inData: false },
    { id: 'ime', name: 'Teaching', ab: 'IME', long: 'Indirect Medical Education Adjustment', path: '/ime/', stage: 'soon', group: 'price', inData: false },
    { id: 'iqr', name: 'Quality reporting', ab: 'IQR', long: 'Hospital Inpatient Quality Reporting Program', path: '/iqr/', stage: 'soon', group: 'reporting', inData: false },
    { id: 'pi', name: 'Electronic health records', ab: 'PI', long: 'Medicare Promoting Interoperability Program', path: '/pi/', stage: 'soon', group: 'reporting', inData: false },
    { id: 'team', name: 'Surgical episodes', ab: 'TEAM', long: 'Transforming Episode Accountability Model', path: '/team/', stage: 'soon', group: 'episode', inData: false },
  ],
  // Thirty Day Readmissions, the sister site Readmissions lives on until it folds in; hospital(ccn) is the link to one
  // of its hospitals.
  tdr: {
    name: 'Thirty Day Readmissions',
    url: 'https://thirty-day-readmissions.vercel.app/',
    hospital: (ccn) => `${SITE.tdr.url}#hospital-${ccn}`,
  },
};

// The site a page belongs to, by its path: the entry in SITE.sites whose path starts the page's, or null for the
// family's own pages (the hub).
export const siteOf = (path) => Object.values(SITE.sites).find((site) => path.startsWith(site.path)) ?? null;

// The program whose folder holds a page's path (SITE.programs), or null for the family's own pages (the hub's).
export const programOf = (path) => SITE.programs.find((program) => path.startsWith(program.path)) ?? null;

// The registry's programs in the groups the family's pages show, each in the registry's order. Listed: the live and
// interim programs and the not-built ones the dollar estimates already include, the shell's tabs and the footer's
// figures; unlisted: the rest, under consideration, the footer's "Under consideration:" line and the front page's
// slips (no tab). Placeholder: every program with no page here (stage soon), whose folder holds the hub's placeholder
// page (hub/coming.js). A live program's folder holds its site and an interim one's the hub's own Readmissions pages
// (hub/hrrp/page.js).
export const LISTED_PROGRAMS = Object.freeze(SITE.programs.filter((p) => p.stage !== 'soon' || p.inData));
export const UNLISTED_PROGRAMS = Object.freeze(SITE.programs.filter((p) => !LISTED_PROGRAMS.includes(p)));
export const PLACEHOLDER_PROGRAMS = Object.freeze(SITE.programs.filter((p) => p.stage === 'soon'));

// The address of a hospital's page in a program, or null when the program has none for it. Folders are lowercase, so the
// CCN is too. programId is 'hub' (the hospital page, every hospital), 'hacrp' (that site's hospital pages), or 'hrrp'
// (the slim Readmissions page, only for a hospital Thirty Day Readmissions has: inTdr). No other program has one yet.
export function hospitalPathOf(programId, ccn, { inTdr = false } = {}) {
  const folder = ccn.toLowerCase();
  if (programId === 'hub') return `/hospital/${folder}/`;
  const program = SITE.programs.find((p) => p.id === programId);
  return program && (programId === 'hacrp' || (programId === 'hrrp' && inTdr)) ? `${program.path}hospital/${folder}/` : null;
}
