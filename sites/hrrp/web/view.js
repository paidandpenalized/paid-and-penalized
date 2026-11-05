// Ported from Thirty Day Readmissions (web/src/js/views/hospital.js, views/columns.js and ui/breadcrumb.js at 33d1959).
// One hospital's page data: the record card's fields, the stamps, the verdict and rank sentences, the breadcrumb,
// as plain strings (pages escape them). Pure.
import { TEACH_LABEL, slug } from '../../../engine/js/hrrp/filters.js';
import { PEERS } from '../../../engine/js/hrrp/formula.js';
import { has } from '../../../engine/js/has.js';
import { dotList, placeText } from '../../../web/render/format.js';
import { STARS_MAX } from './constants.js';
import { edition as editionOf } from './derive.js';
import { COPY as HOSPITAL, fill, t } from './hospital/copy.js';
import { PROGRAM_PATH, placePath } from './links.js';
import { factor4, fmtDate, fmtInt, fmtMoney, fmtPct } from './numbers.js';
import { inactiveSentence, rankLine, summarySentence } from './wording.js';

// What every hospital page of a build shares, built once: the fiscal year's phrases (with the data's condition names,
// which the verdict sentence uses), what the rank line ranks against (every hospital's cut, each state's hospitals) and
// the hospital master (a Map of CCN to record; optional), which says whether the family's hub has a page for the hospital.
export function hospitalContext({ hospitals, meta, history, conditions, master = null }) {
  const byState = new Map();
  for (const h of hospitals) {
    if (!byState.has(h.st)) byState.set(h.st, []);
    byState.get(h.st).push(h);
  }
  return {
    meta,
    edition: { ...editionOf(meta, history), conditions },
    master,
    rank: { hospitals, byState, sortedRed: hospitals.map((h) => h.red).sort((a, b) => a - b), states: meta.states },
  };
}

// A special-status code in words; a code the site has no words for is shown as CMS writes it.
const typeName = (code) => (has(HOSPITAL, `type${code}`) ? t(`type${code}`) : code);

// Bed counts are CMS certified beds; the few from the cost report instead are marked.
const bedsText = (h) => (h.beds ? fill(h.bedsSrc === 'cr' ? 'typeBedsCostReport' : 'typeBeds', { beds: fmtInt(h.beds) }) : null);

// The Type field: teaching status, beds, ownership, urban or rural and special status; a dash when CMS has none of it.
function typeText(h) {
  const parts = [
    TEACH_LABEL[h.teach],
    bedsText(h),
    h.own,
    h.urban == null ? null : t(h.urban ? 'typeUrban' : 'typeRural'),
    ...(h.types ?? []).map(typeName),
  ].filter(Boolean);
  return parts.length ? dotList(parts) : t('typeNone');
}

function starsOf(h) {
  if (!h.star) return { n: null, filled: '', empty: '', text: t('starsNone'), href: careCompareHref(h.id) };
  return {
    n: h.star,
    filled: '★'.repeat(h.star),
    empty: '☆'.repeat(Math.max(STARS_MAX - h.star, 0)),
    text: fill('starsSpoken', { n: String(h.star), max: String(STARS_MAX) }),
    href: careCompareHref(h.id),
  };
}

const careCompareHref = (ccn) => `https://www.medicare.gov/care-compare/details/hospital/${ccn}`;

// Nation, then the hospital's region, division, state and metro area, each only when the row names it.
function crumbsOf(h, ctx) {
  const out = [{ label: t('crumbNation'), href: PROGRAM_PATH }];
  if (h.region) out.push({ label: h.region, href: placePath('region', slug(h.region)) });
  if (h.division) out.push({ label: h.division, href: placePath('division', slug(h.division)) });
  out.push({ label: ctx.meta.states[h.st] ?? h.st, href: placePath('state', h.st) });
  if (h.cbsa) out.push({ label: h.cbsaName, href: placePath('metro', h.cbsa) });
  return out;
}

// Whether the hub's dollar file holds the hospital, so the hub and the HACRP site have a page for it: the file holds the
// hospitals the master lists in HACRP (a test holds this equal to the hub's file). True where the context has no master.
const inHubOf = (h, ctx) => ctx.master?.get(h.id)?.programs?.hacrp?.inProgram ?? true;

// h: a hospital row of the data file; ctx: hospitalContext(). Returns plain strings (and numbers where a page needs one).
export function hospitalView(h, ctx) {
  const { edition } = ctx;
  const stateName = ctx.meta.states[h.st] ?? h.st;
  const cut = h.red > 0;
  const estimated = h.pen != null;
  const place = placeText({ city: h.city, state: h.st });
  const where = { name: h.name, place, edition: edition.label };
  return {
    ccn: h.id,
    name: h.name,
    inHub: inHubOf(h, ctx),
    edition: edition.label,
    heading: fill('pageTitle', where),
    description: fill('pageDescription', where),
    record: { left: fill('recordTitle', { edition: edition.label }), right: fill('recordCcn', { ccn: h.id }) },
    alias: h.alias ? fill('alias', { alias: h.alias }) : null,
    location: [place, h.zip ? ` ${h.zip}` : ''].join(''),
    county: h.county || null,
    metro: h.cbsa
      ? { value: h.cbsaName, linkText: t('seeMetro'), href: placePath('metro', h.cbsa) }
      : { value: t('outsideMetro'), linkText: fill('seeState', { state: stateName }), href: placePath('state', h.st) },
    type: typeText(h),
    peer: {
      value: fill('peerValue', { peer: String(h.peer), n: String(PEERS.length) }),
      note: fill('peerNote', { pct: fmtPct(h.dual * 100, 1) }),
    },
    stars: starsOf(h),
    stamps: [
      cut ? { label: fill('stampCut', { pct: fmtPct(h.red) }), ink: false } : { label: t('stampNone'), ink: true },
      ...(h.inactive ? [{ label: t('stampInactive'), ink: true }] : []),
    ],
    summary: summarySentence(h, ctx.meta, edition),
    inactive: h.inactive ? inactiveSentence(h, edition) : null,
    factor: { value: factor4(h.paf), note: t('factorNote') },
    dollars: {
      value: estimated ? fmtMoney(h.pen) : t('dollarsNone'),
      estimated,
      note: h.base != null ? fill('dollarsNote', { base: fmtMoney(h.base) }) : t('dollarsNoVolume'),
    },
    rank: rankLine(h, ctx.rank),
    crumbs: crumbsOf(h, ctx),
    source: fill('source', { edition: edition.label, date: fmtDate(ctx.meta.fileDate, 'long') }),
  };
}
