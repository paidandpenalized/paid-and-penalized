// Where the Readmissions site's pages and files live. No dependencies beyond the site's settings, so the browser's
// scripts can build a link with it.
import { programById } from '../../../web/site.js';

export const PROGRAM_PATH = programById('hrrp').path;
export const HOSPITALS_PATH = `${PROGRAM_PATH}hospital/`;
export const METHODS_PATH = `${PROGRAM_PATH}methods/`;
export const DICTIONARY_PAGE = `${PROGRAM_PATH}data/`;
export const DOLLARS_HREF = `${METHODS_PATH}#methods-dollars`;
export const KINDS = Object.freeze(['region', 'division', 'state', 'metro']);

export const hospitalPath = (ccn) => `${HOSPITALS_PATH}${encodeURIComponent(String(ccn).toLowerCase())}/`;

// /hrrp/<kind>/<key>/ (a state by its code in lowercase, a metro by its CBSA code).
export const placePath = (kind, key) => {
  if (!KINDS.includes(kind)) throw new RangeError(`placePath: unknown kind ${kind}`);
  return `${PROGRAM_PATH}${kind}/${encodeURIComponent(String(key).toLowerCase())}/`;
};

export const csvPath = (fy, name) => `/data/hrrp/fy${fy}/${name}.csv`;

// A link from a content file (the timeline, the research list): the address when it is an https one, else null, so a
// javascript:, http:, data: or malformed address never becomes an href.
export function httpsUrl(url) {
  try {
    const u = new URL(String(url));
    return u.protocol === 'https:' && !u.username && !u.password ? u.href : null;
  } catch {
    return null;
  }
}
