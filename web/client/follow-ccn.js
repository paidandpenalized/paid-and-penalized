// The CCN a page's address follows (?h=<CCN>), read without the site's map: a module of its own, so a page script that
// only reads the ?h= carries none of follow.js's links (web/site.js). follow.js re-exports it.
import { CCN } from '../../engine/js/ccn.js';

// Six ASCII digits or letters, in either case. Checked before the CCN is uppercased, because uppercasing turns a few
// other characters (a dotless i, a long s) into ASCII letters, and those are not a lowercase CCN.
const ASCII_CCN = /^[0-9A-Za-z]{6}$/;

// The CCN a query string follows: the first h parameter, uppercased, when it is six digits or letters, else null. known:
// asked about the CCN (uppercase) only once it is well formed, and a null answer makes it null too.
export function followedCcn(search, known = () => true) {
  const raw = new URLSearchParams(search ?? '').get('h');
  if (raw === null || !ASCII_CCN.test(raw)) return null;
  const ccn = raw.toUpperCase();
  return CCN.test(ccn) && known(ccn) ? ccn : null;
}
