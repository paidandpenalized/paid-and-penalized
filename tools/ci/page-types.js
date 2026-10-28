// The family's pages by address, built from the sites' own path helpers (web/site.js; HACRP's program, hospital,
// place, Methods and dictionary paths; the not-found page's, address.js), so the size budget (size-budget.js) and the
// browser checks' sample pages (tools/e2e/site.js) read one layout. No browser and no file access.
import { CCN } from '../../engine/js/ccn.js';
import { NOT_FOUND_ADDRESS } from '../../pipeline/site/address.js';
import { hospitalHref } from '../../sites/hacrp/web/hospital-table.js';
import { DICTIONARY_PAGE, METHODS_PATH, PROGRAM_PATH } from '../../sites/hacrp/web/links.js';
import { KINDS, placePath } from '../../sites/hacrp/web/place-paths.js';
import { HOSPITALS_PATH } from '../../sites/hacrp/web/view.js';
import { SITE } from '../../web/site.js';

export { DICTIONARY_PAGE, KINDS, METHODS_PATH, PROGRAM_PATH, placePath };
// A hospital's page, by its CCN (any case): '/hacrp/hospital/<ccn, lowercase>/'.
export const hospitalPath = (ccn) => hospitalHref(HOSPITALS_PATH, ccn);

const POLICY = new Set(Object.values(SITE.pages));
// The folders of the programs without a site here, each holding a placeholder (hub/coming.js).
const COMING = new Set(SITE.programs.filter((p) => p.stage !== 'live').map((p) => p.path));
// The one folder name under prefix that path is, or null ('/a/b/' under '/a/' is 'b').
const folderUnder = (path, prefix) => {
  const name = path.startsWith(prefix) && path.endsWith('/') ? path.slice(prefix.length, -1) : '';
  return name && !name.includes('/') ? name : null;
};
// A path is a hospital's or a place's page when the site's own helper writes it from the name in it.
const isHospital = (path) => {
  const ccn = folderUnder(path, HOSPITALS_PATH)?.toUpperCase();
  return ccn !== undefined && CCN.test(ccn) && hospitalPath(ccn) === path;
};
// The kind of the place whose page is at a site path ('state' for '/hacrp/state/ca/'), or null for any other path.
export const placeKind = (path) => KINDS.find((kind) => {
  const key = folderUnder(path, `${PROGRAM_PATH}${kind}/`);
  return key !== null && placePath(kind, key) === path;
}) ?? null;

// The type of the page at a site path: 'hub', 'policy', 'coming', 'program', 'methods', 'dictionary', 'hospital',
// 'place' or 'notFound'; null for a path that is none of them.
export function pageType(path) {
  if (path === '/') return 'hub';
  if (path === NOT_FOUND_ADDRESS) return 'notFound';
  if (POLICY.has(path)) return 'policy';
  if (COMING.has(path)) return 'coming';
  if (path === PROGRAM_PATH) return 'program';
  if (path === METHODS_PATH) return 'methods';
  if (path === DICTIONARY_PAGE) return 'dictionary';
  if (isHospital(path)) return 'hospital';
  if (placeKind(path) !== null) return 'place';
  return null;
}
