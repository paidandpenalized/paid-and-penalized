// The followed hospital as a link carries it: a ?h=<CCN> on any page's address. These are the pure parts, apart from the
// shell's script (shell.js) so that a page's own script can read the same ?h= without taking the shell's wiring with it
// (a bundle that imports shell.js would run it twice). Strings in, strings out; nothing reads the page or stores
// anything. A value that is not a CCN is nothing: no hospital is followed, and nothing is built from it.
import { CCN } from '../../engine/js/ccn.js';
import { SITE, hospitalPathOf } from '../site.js';

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

// The link that keeps a hospital: a program's folder with the hospital in its query.
export const withFollow = (path, ccn) => `${path}?h=${ccn}`;

// Where a program's tab goes for a hospital. program: a program's id (SITE.programs), or null for All programs, which is
// the hospital's own page (so is 'hub'). row: the hospital as the asset decodes it ({ inTdr }), or null. A program that
// has a page for the hospital (hospitalPathOf) opens it; any other opens its folder carrying the hospital.
export function tabHref(program, ccn, row = null) {
  if (program === null || program === 'hub') return hospitalPathOf('hub', ccn);
  const own = hospitalPathOf(program, ccn, { inTdr: Boolean(row?.inTdr) });
  if (own) return own;
  const folder = SITE.programs.find((p) => p.id === program)?.path;
  if (!folder) throw new RangeError(`tabHref: no program "${program}"`);
  return withFollow(folder, ccn);
}

// The program a tab opens, from its address as the server wrote it: null for the family's front page (All programs), a
// program's id for that program's folder, and undefined for any other address (a hospital's page, a link already
// carrying a hospital, another site), which no rewriting touches.
export function tabProgram(href) {
  if (typeof href !== 'string') return undefined;
  if (href === '/') return null;
  return SITE.programs.find((p) => p.path === href)?.id;
}

// An address without the hospital it follows: every h parameter dropped, the rest exactly as written (its order,
// its encoding, its fragment). An address with no h is returned untouched.
export function withoutFollow(href) {
  const hash = href.indexOf('#');
  const head = hash < 0 ? href : href.slice(0, hash);
  const tail = hash < 0 ? '' : href.slice(hash);
  const at = head.indexOf('?');
  if (at < 0) return href;
  const parts = head.slice(at + 1).split('&');
  const kept = parts.filter((part) => !new URLSearchParams(part).has('h'));
  if (kept.length === parts.length) return href;
  const query = kept.filter(Boolean).join('&');
  return `${head.slice(0, at)}${query ? `?${query}` : ''}${tail}`;
}

// A page's own address as a link on this site: its path, query and fragment, with leading slashes folded into one. A path
// that begins "//" would be read as another site's address, and the chip's stop link is made from this address.
export const siteAddress = ({ pathname, search, hash }) => `/${pathname.replace(/^\/+/, '')}${search}${hash}`;
