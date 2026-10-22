// Where the place pages live: /hacrp/<kind>/<key>/ (a state by its code in lowercase, a metro by its CBSA code).
// No dependencies beyond the site's settings, so the browser's scripts can build a place's link with it.
import { SITE } from '../../../web/site.js';

export const KINDS = Object.freeze(['region', 'division', 'state', 'metro']);
const ROOT = SITE.sites.hacrp.path;

export const placePath = (kind, key) => {
  if (!KINDS.includes(kind)) throw new RangeError(`placePath: unknown kind ${kind}`);
  return `${ROOT}${kind}/${encodeURIComponent(String(key).toLowerCase())}/`;
};
