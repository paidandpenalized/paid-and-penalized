// The family's pages by address, built from the sites' own path helpers (web/site.js; HACRP's program, hospital,
// place, Methods and dictionary paths; the not-found page's, address.js), so the size budget (size-budget.js) and the
// browser checks' sample pages (tools/e2e/site.js) read one layout. No browser and no file access.
import { CCN } from '../../engine/js/ccn.js';
import { NOT_FOUND_ADDRESS } from '../../pipeline/site/address.js';
import { hospitalHref } from '../../sites/hacrp/web/hospital-table.js';
import { DICTIONARY_PAGE, METHODS_PATH, PROGRAM_PATH } from '../../sites/hacrp/web/links.js';
import { KINDS, placePath } from '../../sites/hacrp/web/place-paths.js';
import { HOSPITALS_PATH } from '../../sites/hacrp/web/view.js';
import { PLACEHOLDER_PROGRAMS, SITE, hospitalFolderOf, hospitalPathOf, programById } from '../../web/site.js';

export { DICTIONARY_PAGE, KINDS, METHODS_PATH, PROGRAM_PATH, placePath };
// A hospital's page, by its CCN (any case): '/hacrp/hospital/<ccn, lowercase>/'.
export const hospitalPath = (ccn) => hospitalHref(HOSPITALS_PATH, ccn);

const POLICY = new Set(Object.values(SITE.pages));
// The folders of the programs with no page here, each holding a placeholder page (hub/coming.js; type 'coming').
const PLACEHOLDERS = new Set(PLACEHOLDER_PROGRAMS.map((p) => p.path));
// The one folder name under prefix that path is, or null ('/a/b/' under '/a/' is 'b').
const folderUnder = (path, prefix) => {
  const name = path.startsWith(prefix) && path.endsWith('/') ? path.slice(prefix.length, -1) : '';
  return name && !name.includes('/') ? name : null;
};
// A path is a hospital's or a place's page when the helper that writes it writes it from the name in it. A hospital's page
// in a program's hospital folder (web/site.js hospitalFolderOf: HACRP's, the hub's own, Readmissions' interim one), by
// hospitalPathOf, which a test holds equal to HACRP's own writer (hospitalPath).
const hospitalPageIn = (programId) => {
  const folder = hospitalFolderOf(programId);
  return (path) => {
    const ccn = folderUnder(path, folder)?.toUpperCase();
    return ccn !== undefined && CCN.test(ccn) && hospitalPathOf(programId, ccn, { inTdr: true }) === path;
  };
};
const isHospital = hospitalPageIn('hacrp');
const isHubHospital = hospitalPageIn('hub');
const isHrrpHospital = hospitalPageIn('hrrp');
// The interim Readmissions page (hub/hrrp/page.js): the program's folder.
const HRRP_PATH = programById('hrrp').path;
// The kind of the place whose page is at a site path ('state' for '/hacrp/state/ca/'), or null for any other path.
export const placeKind = (path) => KINDS.find((kind) => {
  const key = folderUnder(path, `${PROGRAM_PATH}${kind}/`);
  return key !== null && placePath(kind, key) === path;
}) ?? null;

// The program sites with pages of their own (program, hospital, place, Methods and data dictionary), each with the
// predicates that sort a path into those types. A program site joins by adding its entry when its pages exist; its
// budgets join in size-budget.js (PROGRAM_BUDGETS), and a test holds the two lists to the same ids.
export const PROGRAM_SITES = [
  {
    id: 'hacrp',
    pages: { program: (path) => path === PROGRAM_PATH, methods: (path) => path === METHODS_PATH, dictionary: (path) => path === DICTIONARY_PAGE, hospital: isHospital, place: (path) => placeKind(path) !== null },
  },
];
// The program-keyed types: those of a program's own pages, budgeted per program.
export const PROGRAM_TYPES = ['program', 'hospital', 'place', 'methods', 'dictionary'];
// { program, type } for a program site's own page, or null.
const programPage = (path) => {
  for (const site of PROGRAM_SITES)
    for (const type of PROGRAM_TYPES) if (site.pages[type]?.(path)) return { program: site.id, type };
  return null;
};

// The type of the page at a site path: 'hub', 'policy', 'coming', 'program', 'methods', 'dictionary', 'hospital',
// 'place', 'hubHospital', 'hrrp', 'hrrpHospital' or 'notFound'; null for a path that is none of them.
export function pageType(path) {
  if (path === '/') return 'hub';
  if (path === NOT_FOUND_ADDRESS) return 'notFound';
  if (POLICY.has(path)) return 'policy';
  if (PLACEHOLDERS.has(path)) return 'coming';
  if (path === HRRP_PATH) return 'hrrp';
  const own = programPage(path);
  if (own) return own.type;
  if (isHubHospital(path)) return 'hubHospital';
  if (isHrrpHospital(path)) return 'hrrpHospital';
  return null;
}
// The id of the program whose page is at a site path ('hacrp'), for the program-keyed types ('program', 'hospital',
// 'place', 'methods', 'dictionary'); null for any other page.
export const pageProgram = (path) => programPage(path)?.program ?? null;
