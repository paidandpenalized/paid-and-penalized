// The lookup's words (what the program page says about a hospital's standing in TEAM), for hospital staff: plain, and TEAM
// is a payment model, never a penalty. No digit characters: a date arrives through a {placeholder}, formatted. A sentence
// that states a fact about the rules carries the claim id (or ids) of its row in sites/team/CLAIMS.md; the rest are null.
// The kinds are the family search's words (hub/search/copy.js hospitalKind.<kind>), not a second list.
import { copyOf } from '../../../web/render/components.js';
import { shortIsoDate } from '../../../web/render/format.js';
import { COPY as SEARCH } from '../../../hub/search/copy.js';
import { CJRX_START } from './constants.js';

// Not named COPY until the site is registered with the copy gate (which would then read it as the site's copy): the
// lookup test holds these words to the same rules meanwhile.
export const LOOKUP_COPY = {
  in: { text: 'In TEAM.', claim: 'TEAM-01' },
  inVoluntary: { text: 'In TEAM, as a voluntary participant: it chose to join.', claim: ['TEAM-01', 'TEAM-06'] },
  in27: { text: 'In TEAM from {date}.', claim: ['TEAM-01', 'TEAM-09'] },
  ended: { text: 'Left TEAM. CMS\'s list gives {date} as the end of its participation.', claim: 'TEAM-09' },
  maryland: {
    text: 'A Maryland hospital. Maryland hospitals aren\'t paid under the inpatient system TEAM uses, and CMS left out areas lying wholly in Maryland. Not in TEAM.',
    claim: ['TEAM-01', 'TEAM-03', 'TEAM-04'],
  },
  outside: { text: 'Not in an area CMS selected for TEAM, so not in TEAM. CMS chose the areas by random sampling.', claim: ['TEAM-01', 'TEAM-02'] },
  inAreaKind: {
    text: '{kind}. In a TEAM area, but a hospital of this kind isn\'t paid under the inpatient system TEAM uses, so not in TEAM.',
    claim: ['TEAM-01', 'TEAM-11'],
  },
  ihs: { text: 'An Indian Health Service or tribal hospital in a TEAM area. It isn\'t on CMS\'s list of TEAM participants.', claim: 'TEAM-09' },
  inAreaListed: { text: 'In a TEAM area, but not on CMS\'s list of TEAM participants.', claim: 'TEAM-09' },
  unlisted: {
    text: 'In a TEAM area and paid under the inpatient system, but not on CMS\'s list of participants. CMS updates the list each quarter, and a new hospital must take part from the start of the performance year after one full performance year.',
    claim: ['TEAM-01', 'TEAM-08', 'TEAM-09'],
  },
  areaUnknown: { text: 'We couldn\'t place this hospital\'s county in or out of a TEAM area, so we can\'t say. CMS\'s list has the answer.', claim: null },
  cjrx: { text: '{reason} In CJR-X from {date}.', claim: ['TEAM-12', 'TEAM-13'] },
  'kind.unknown': { text: 'A hospital whose kind the hospital list doesn\'t give', claim: null },
};

const { fill } = copyOf(LOOKUP_COPY);
const KIND_KEY = 'hospitalKind.';
// What may sit inside a CJR-X status: a hospital that left TEAM, or a reason a hospital is not in TEAM (a hospital in TEAM,
// one starting, a Maryland one, or a nested CJR-X pair contradicts the rules).
const CJRX_INNER = new Set(['ended', 'outside', 'in_area_kind', 'in_area_other', 'ihs', 'unlisted', 'area_unknown']);

// A master kind in words: the family search's, else (the master's "unknown") this lookup's own.
function kindText(kind) {
  if (typeof kind !== 'string') throw new TypeError('lookup: a kind is text');
  if (kind === 'unknown') return fill('kind.unknown');
  const key = KIND_KEY + kind;
  if (!Object.hasOwn(SEARCH, key)) throw new RangeError(`lookup: no words for kind ${JSON.stringify(kind)}`);
  return SEARCH[key];
}
const dateOf = (iso) => {
  if (typeof iso !== 'string') throw new TypeError('lookup: a date is YYYY-MM-DD text');
  return shortIsoDate(iso);
};

// The words for a status (the emitted file's [code, arg]): { tag: 'YES' | 'NO', text, link }. link is where the reader goes
// next: 'calc' (the calculator) for a hospital in TEAM or starting, 'hub' (the family's hospital page) for the rest.
// Throws on a code, kind or CJR-X pair it has no words for, and a TypeError on a missing date.
export function reasonText(code, arg) {
  const yes = (text) => ({ tag: 'YES', text, link: 'calc' });
  const no = (text) => ({ tag: 'NO', text, link: 'hub' });
  switch (code) {
    case 'in': return yes(fill(arg === 'voluntary' ? 'inVoluntary' : 'in'));
    case 'in27': return yes(fill('in27', { date: dateOf(arg) }));
    case 'ended': return no(fill('ended', { date: dateOf(arg) }));
    case 'maryland': return no(fill('maryland'));
    case 'outside': return no(fill('outside'));
    // The emitter decides which kinds give a reason: in_area_kind for a kind the hospital master marks not paid under the
    // inpatient system, in_area_other for an acute or unknown one that isn't IPPS-paid (closed, converted and the like),
    // whose words say only what the data does: it is not on CMS's list.
    case 'in_area_kind': return no(fill('inAreaKind', { kind: kindText(arg) }));
    case 'in_area_other': kindText(arg); return no(fill('inAreaListed')); // refuses a kind it has no words for
    case 'ihs': return no(fill('ihs'));
    case 'unlisted': return no(fill('unlisted'));
    case 'area_unknown': return no(fill('areaUnknown'));
    case 'cjrx': {
      if (!Array.isArray(arg) || arg.length !== 2 || !CJRX_INNER.has(arg[0])) throw new RangeError('lookup: a CJR-X status carries the inner [code, arg] pair');
      return no(fill('cjrx', { reason: reasonText(arg[0], arg[1]).text, date: dateOf(CJRX_START) }));
    }
    default: throw new RangeError(`lookup: no words for status ${JSON.stringify(code)}`);
  }
}
