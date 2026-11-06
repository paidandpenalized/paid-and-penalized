// Ported from Thirty Day Readmissions (web/src/js/views/hospital.js, views/columns.js and ui/breadcrumb.js at 33d1959).
// The Readmissions pages' data: a hospital's record card, stamps, verdict and rank sentences and breadcrumb; the program
// page's hero and card; a place's deck and card; Methods' filled sentences,
// as plain strings (pages escape them). Pure.
import { TEACH_LABEL, slug } from '../../../engine/js/hrrp/filters.js';
import { CAP_PCT, CONDS, MIN_DISCHARGES, PEERS } from '../../../engine/js/hrrp/formula.js';
import { summarize } from '../../../engine/js/hrrp/summary.js';
import { has } from '../../../engine/js/has.js';
import { HRRP_WINDOW_DAYS } from '../../../web/programs.js';
import { capitalize, dotList, isoMonth, listText, money, noun, ordinal, pct, placeText, spelled } from '../../../web/render/format.js';
import { ACCURACY_BAND, GE_CUT_PCT, HISTORY_LISTED_FYS, HISTORY_SIMULATED_FYS, NTAP_AMOUNT, NTAP_FY, PARHM_END, SMALL_HOSPITAL_BEDS, STARS_MAX, TEACH_MAJOR } from './constants.js';
import { edition as editionOf, meanCutByYear, pafByYear } from './derive.js';
import { historyData, rulerScales, rulersData, yearRanks } from './figures/hospital-data.js';
import { howData } from './figures/how-data.js';
import { exploreControls } from './figures/explore-data.js';
import { noTotalText, researchData, smallLines, timelineData, windowRows } from './figures/history-data.js';
import { mapData } from './figures/map-data.js';
import { pictureData } from './figures/picture-data.js';
import { COPY as HOSPITAL, fill, t } from './hospital/copy.js';
import { PROGRAM_PATH, httpsUrl, placePath } from './links.js';
import { byId, countBy, factor4, fmtDate, fmtInt, fmtMoney, fmtPct } from './numbers.js';
import { fill as placeFill, t as placeT } from './place/copy.js';
import { fill as methodsFill, t as methodsT } from './methods/copy.js';
import { fill as programFill } from './program/copy.js';
import { fyLabel } from './copy.js';
import { worksheetRows } from './worksheet.js';
import { deckLead, hospitals, inactiveSentence, noEstimateNote, penalizedNote, rankContext, rankLine, summarySentence, vsLabel } from './wording.js';

// What every hospital page of a build shares, built once: the fiscal year's phrases (with the data's condition names,
// which the verdict sentence uses), what the rank line ranks against (the cuts, nationally, by state and by peer group) and
// the hospital master (a Map of CCN to record; optional), which says whether the family's hub has a page for the hospital, and
// the family's dollar estimates (a Map of CCN to row; optional), whose net the header chip shows.
export function hospitalContext({ hospitals, meta, history, conditions, master = null, dollars = null }) {
  return {
    meta,
    edition: { ...editionOf(meta, history), conditions },
    master,
    dollars,
    rank: rankContext(hospitals, meta.states),
    // The figures' shared numbers: each peer group's ratios, each year's cuts and the all-hospital average cut by year.
    history,
    rulers: rulerScales(hospitals, meta),
    yearRanks: yearRanks(hospitals, history, meta),
    avgCut: meanCutByYear(hospitals, [...history.years, meta.fy], pafByYear({ history, meta })),
    lines: smallLines({ history }),
  };
}

// A special-status code in words; a code the site has no words for is dropped (a raw code means nothing to a reader).
const typeName = (code) => (has(HOSPITAL, `type${code}`) ? t(`type${code}`) : null);

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

// A hospital's page on Care Compare, by its CCN, encoded as HACRP's is (sites/hacrp/web/links.js; a site does not import the other).
const careCompareHref = (ccn) => `https://www.medicare.gov/care-compare/details/hospital/${encodeURIComponent(ccn)}`;

function starsOf(h) {
  const href = careCompareHref(h.id);
  if (!h.star) return { n: null, filled: '', empty: '', text: t('starsNone'), href };
  return {
    n: h.star,
    filled: '★'.repeat(h.star),
    empty: '☆'.repeat(Math.max(STARS_MAX - h.star, 0)),
    text: fill('starsSpoken', { n: String(h.star), max: String(STARS_MAX) }),
    href,
  };
}

// A hospital is in a metro area when the row names both its code and its name; otherwise it is outside the metro areas.
export const inMetro = (h) => Boolean(h.cbsa && h.cbsaName);

// Nation, then the hospital's region, division, state and metro area, each only when the row names it.
function crumbsOf(h, ctx) {
  const out = [{ label: t('crumbNation'), href: PROGRAM_PATH }];
  if (h.region) out.push({ label: h.region, href: placePath('region', slug(h.region)) });
  if (h.division) out.push({ label: h.division, href: placePath('division', slug(h.division)) });
  out.push({ label: ctx.meta.states[h.st] ?? h.st, href: placePath('state', h.st) });
  if (inMetro(h)) out.push({ label: h.cbsaName, href: placePath('metro', h.cbsa) });
  return out;
}

// Whether the hub's dollar file holds the hospital, so the hub and the HACRP site have a page for it: the file holds the
// hospitals the master lists in HACRP (a test holds this equal to the hub's file). A hospital the master lacks is not in
// the hub. True only where the context has no master at all (a test's slice).
const inHubOf = (h, ctx) => (ctx.master ? ctx.master.get(h.id)?.programs?.hacrp?.inProgram === true : true);

// The hospital's estimated net from the dollar estimates, as HACRP's pages show it; null without an estimate.
const netOf = (h, ctx) => {
  const row = ctx.dollars?.get(h.id);
  return row?.status === 'estimated' ? row.net : null;
};

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
    net: netOf(h, ctx),
    edition: edition.label,
    heading: fill('pageTitle', where),
    description: fill('pageDescription', where),
    record: { left: fill('recordTitle', { edition: edition.label }), right: fill('recordCcn', { ccn: h.id }) },
    alias: h.alias ? fill('alias', { alias: h.alias }) : null,
    location: [place, h.zip ? ` ${h.zip}` : ''].join(''),
    county: h.county || null,
    metro: inMetro(h)
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
    figures: { rulers: rulersData(h, ctx), history: historyData(h, ctx), sheet: { rows: worksheetRows(h, ctx.meta), conditions: edition.conditions } },
    crumbs: crumbsOf(h, ctx),
    source: fill('source', { edition: edition.label, date: fmtDate(ctx.meta.fileDate, 'long') }),
  };
}

// What the program page and the place pages share, built once: the edition's phrases, the nation's summary and the states'
// average cuts (descending, for a state's rank among them). places: buildPlaces()'s result. conditions are kept on the edition;
// the rest (the content files, the state outlines) passes through as given.
export function areaContext({ hospitals, meta, history, conditions, places, pinsUsed = [], ...content }) {
  const edition = { ...editionOf(meta, history), conditions };
  const states = places.list.filter((p) => p.kind === 'state');
  const stateSummaries = new Map(states.map((p) => [p.key, summarize(p.hospitals)]));
  const stateMeans = [...stateSummaries.values()].map((s) => s.meanRed).sort((a, b) => b - a);
  return { ...content, hospitals, meta, edition, nation: summarize(hospitals), stateSummaries, stateMeans, hasDc: stateSummaries.has('dc'), places, history, pinsUsed };
}

// The place with the most hospitals of a kind (ties: the first by name), which the hero's suggestions link. Picked from
// the data, never by name.
const largest = (list, kind) => list.filter((p) => p.kind === kind)
  .reduce((a, b) => (a === null || b.hospitals.length > a.hospitals.length ? b : a), null);

// The program page's top: the hero's words and the At-a-glance card's eight fields. Plain strings, with the places the
// hero's suggestions link.
export function programView(ctx) {
  const { edition, meta, nation: S, places } = ctx;
  const noEst = noEstimateNote(ctx.hospitals);
  const state = largest(places.list, 'state');
  const metro = largest(places.list, 'metro');
  const link = (p) => ({ name: p.name, path: p.path });
  return {
    edition: edition.label,
    heading: programFill('pageTitle', { edition: edition.label }),
    description: programFill('pageDescription', { edition: edition.label }),
    kicker: programFill('kicker', { edition: edition.label, n: String(edition.nYears) }),
    deck: {
      lead: programFill('deckLead', { days: spelled(HRRP_WINDOW_DAYS), pay: edition.payStart }),
      count: programFill('deckCount', { nPen: fmtInt(S.nPen), n: fmtInt(S.n) }),
      mid: programFill('deckMid'),
      share: S.pctPen == null ? '' : programFill('deckShare', { pct: fmtPct(S.pctPen, 0), nMeasured: fmtInt(S.nMeasured) }),
    },
    try: { state: link(state), metro: metro && link(metro) },
    card: {
      left: programFill('glanceTitle', { edition: edition.label }),
      right: programFill('glanceSource'),
      fields: [
        { label: programFill('glanceEvaluated'), value: fmtInt(S.n) },
        { label: programFill('glancePenalized'), value: fmtInt(S.nPen), note: S.pctPen == null ? null : programFill('glancePenalizedNote', { pct: fmtPct(S.pctPen, 0), nMeasured: fmtInt(S.nMeasured) }) },
        { label: programFill('glanceMean'), value: fmtPct(S.meanRed) },
        { label: programFill('glanceMeanPen'), value: fmtPct(S.meanRedPen) },
        { label: programFill('glanceMax', { cap: String(CAP_PCT) }), value: fmtInt(S.nMax), note: programFill('glanceMaxNote') },
        {
          label: programFill('glanceDollars'),
          value: programFill('glanceDollarsValue', { money: fmtMoney(meta.totals.modelPen) }),
          estimated: true,
          note: programFill('glanceDollarsNote', { cms: fmtMoney(meta.totals.cmsEst), missing: noEst ? ` ${noEst}.` : '' }),
        },
        { label: programFill('glanceWindow'), value: programFill('glanceWindowValue', { start: fmtDate(meta.perf[0]), end: fmtDate(meta.perf[1]) }) },
        { label: programFill('glancePay'), value: edition.payShort },
      ],
      stamp: programFill('glanceStamp', { date: fmtDate(meta.fileDate) }),
    },
    how: howData(ctx),
    picture: pictureData(ctx),
    map: mapData(ctx),
    history: { lines: smallLines(ctx), windows: windowRows(ctx), timeline: timelineData(ctx.timeline, { edition: ctx.edition, today: meta.fileDate }) },
    explore: exploreControls(ctx.hospitals, edition.conditions),
    research: researchData(ctx.research),
  };
}

const KIND_KEY = { region: 'kindRegion', division: 'kindDivision', state: 'kindState', metro: 'kindMetro' };
const CHILDREN_KEY = { region: 'childrenDivisions', division: 'childrenStates', state: 'childrenMetros' };

// The places above this one, nation first: the breadcrumb.
function placeCrumbs(place) {
  const out = [];
  for (let p = place.parent; p; p = p.parent) out.unshift({ label: p.name, href: p.path });
  return [{ label: t('crumbNation'), href: PROGRAM_PATH }, ...out];
}

// A state's rank by average cut among the states (and DC) in the program, or null for any other kind of place.
const stateRank = (place, S, ctx) => {
  if (place.kind !== 'state') return null;
  const rank = ctx.stateMeans.findIndex((v) => v <= S.meanRed + 1e-12) + 1;
  return { rank, of: ctx.stateMeans.length - (ctx.hasDc ? 1 : 0) };
};

// The places inside this one, with their hospital counts: a state lists its metro areas (a metro across a state line
// shows this state's hospitals only, as the source did) and the hospitals outside them.
function childRows(place) {
  const st = place.key.toUpperCase();
  const row = (p) => {
    const n = place.kind === 'state' ? p.hospitals.reduce((c, h) => c + (h.st === st ? 1 : 0), 0) : p.hospitals.length;
    const label = place.kind === 'state' && p.states.length > 1 ? placeFill('childPart', { name: p.name, st }) : p.name;
    return { label, href: p.path, n, count: hospitals(n) };
  };
  const rows = place.children.map(row);
  if (place.kind === 'state') {
    const outside = place.hospitals.filter((h) => !inMetro(h));
    if (outside.length) rows.push({ label: placeT('childOutside'), href: null, n: outside.length, count: hospitals(outside.length) });
  }
  return rows.sort((a, b) => b.n - a.n || a.label.localeCompare(b.label));
}

// The codes of the states a place reaches, the one with the most of its hospitals first (ties: by code), as the source listed them.
const statesByCount = (place) => {
  const n = countBy(place.hospitals, (h) => h.st);
  return [...place.states].sort((a, b) => n.get(b) - n.get(a) || byId(a, b));
};

// place: a buildPlaces() entry; ctx: areaContext(). The place page's head, deck and six-field card.
export function placeView(place, ctx) {
  const { edition, nation: N } = ctx;
  const S = place.kind === 'state' ? ctx.stateSummaries.get(place.key) : summarize(place.hospitals);
  const noEst = noEstimateNote(place.hospitals);
  const rank = stateRank(place, S, ctx);
  const dc = rank && ctx.hasDc ? placeT('deckAndDc') : '';
  const avg = S.n === 1 ? placeFill('deckAvgOne', { pct: fmtPct(S.meanRed) }) : placeFill('deckAvgMany', { hospitals: hospitals(S.n), pct: fmtPct(S.meanRed) });
  const rankWords = rank ? placeFill(rank.rank === 1 ? 'deckRankFirst' : 'deckRankNth', { n: String(rank.of), dc, ...(rank.rank === 1 ? {} : { nth: ordinal(rank.rank) }) }) : placeT('deckNoRank');
  const lead = deckLead(S, edition.label);
  const kind = placeT(KIND_KEY[place.kind]);
  const spans = place.kind === 'metro' && place.states.length > 1;
  const children = CHILDREN_KEY[place.kind] ? { title: placeT(CHILDREN_KEY[place.kind]), rows: childRows(place) } : null;
  return {
    name: place.name,
    path: place.path,
    edition: edition.label,
    heading: placeFill('pageTitle', { name: place.name, edition: edition.label }),
    description: placeFill('pageDescription', { name: place.name, lead }),
    crumbs: placeCrumbs(place),
    kicker: spans ? placeFill('kindSpans', { kind, states: statesByCount(place).join(', ') }) : kind,
    deck: { lead: `${lead} `, average: `${avg}${rankWords}`, total: placeT('deckTotal'), totalValue: fmtMoney(S.penTotal), totalNote: noEst ? placeFill('deckTotalNote', { note: noEst }) : '', totalEnd: placeT('deckTotalEnd') },
    card: {
      left: placeFill('cardTitle', { name: place.name, edition: edition.label }),
      right: placeT('cardVs'),
      fields: [
        { label: placeT('kpiHospitals'), value: fmtInt(S.n) },
        { label: placeT('kpiPenalized'), value: fmtPct(S.pctPen, 0), note: penalizedNote(S, N) },
        { label: placeT('kpiMean'), value: fmtPct(S.meanRed), note: vsLabel(S.meanRed, N.meanRed, 2, t('unitPts')) },
        { label: placeFill('kpiGe', { pct: fmtPct(GE_CUT_PCT, 0) }), value: fmtInt(S.nGe1), note: placeFill('kpiGeNote', { share: fmtPct((100 * S.nGe1) / S.n, 0), nation: fmtPct((100 * N.nGe1) / N.n, 0) }) },
        { label: placeFill('kpiMax', { cap: String(CAP_PCT) }), value: fmtInt(S.nMax) },
        { label: placeT('kpiDollars'), value: fmtMoney(S.penTotal), estimated: true, note: noEst ? `${capitalize(noEst)}.` : null },
      ],
    },
    children,
    back: placeT('back'),
  };
}

// "Oct–Dec 2026": the part of the payment year before an end date that falls inside it, or null when the date is on or
// after the year's last day (the whole year counts). endIso: YYYY-MM-DD.
function monthsBefore(fy, endIso) {
  if (endIso >= `${fy}-09-30`) return null;
  const { month, year } = isoMonth(endIso);
  const end = month.slice(0, 3);
  return Number(year) === fy - 1 ? `Oct–${end} ${year}` : `Oct ${fy - 1}–${end} ${year}`;
}

// "an October 2026 check", from the check's date (YYYY-MM-DD); "a check" when it has none.
function checkPhrase(asOf) {
  if (!asOf) return 'a check';
  const { month, year } = isoMonth(asOf);
  return `${/^[AEIOU]/.test(month) ? 'an' : 'a'} ${month} ${year} check`;
}

// How the estimates compare with hospitals' cost reports; null when the data has no dollar check.
function accuracyLine(dc, edition) {
  if (dc?.within15 == null) return null;
  const small = dc.within15Small == null ? '' : methodsFill('accuracySmall', { share: fmtPct(dc.within15Small, 0), beds: String(SMALL_HOSPITAL_BEDS) });
  return methodsFill('accuracyText', { check: checkPhrase(dc.asOf), costFy: fyLabel(dc.costFy), share: fmtPct(dc.within15, 0), band: `${ACCURACY_BAND}%`, fy: fyLabel(edition.fy), small });
}

// The assumptions as [assumption, effect] rows of words: the fixed ones, then those the data calls for (the Medicare-dependent
// row with its end date and largest shortfall, the Pennsylvania model while it runs into the payment year, hospitals CMS lists
// as inactive, hospitals with no estimate).
function assumptionRows(ctx) {
  const { edition, meta, hospitals: list } = ctx;
  const dc = meta.dollarCheck;
  const f = (a, e, av = {}, ev = {}) => [methodsFill(a, av), methodsFill(e, ev)];
  // The copy keys for a count: the 'One' form for one hospital, else 'Many'.
  const form = (n) => (n === 1 ? 'One' : 'Many');
  const nMdh = list.filter((h) => h.types?.includes('MDH')).length;
  const nInactive = list.filter((h) => h.inactive).length;
  const nNoEst = list.filter((h) => h.pen == null).length;
  // Like the Pennsylvania row: an end before the payment year starts leaves nothing to say, so the row drops out.
  const mdhCounts = meta.mdh && meta.mdh.endDate >= `${edition.fy - 1}-10-01`;
  const mdhMonths = mdhCounts ? monthsBefore(edition.fy, meta.mdh.endDate) : null;
  const parhmMonths = monthsBefore(edition.fy, PARHM_END);
  const share = meta.totals?.modelBase ? pct(NTAP_AMOUNT / meta.totals.modelBase, 1) : null;
  const rates = dc?.rateDrift == null
    ? f('assumeRates', 'assumeRatesENone', { edition: edition.label })
    : f('assumeRates', 'assumeRatesE', { edition: edition.label }, { drift: pct(Math.abs(dc.rateDrift - 1), 1), direction: methodsT(dc.rateDrift >= 1 ? 'directionAbove' : 'directionBelow'), costFy: fyLabel(dc.costFy) });
  return [
    f('assumeBase', 'assumeBaseE', { edition: edition.label }),
    rates,
    f('assumeVolume', 'assumeVolumeE', { volumeFy: fyLabel(edition.fy - 2) }, { edition: edition.label }),
    f('assumeFfs', 'assumeFfsE'),
    mdhCounts && (mdhMonths
      ? f('assumeMdh', 'assumeMdhE', { months: mdhMonths, date: fmtDate(meta.mdh.endDate, 'long'), hospitals: noun(nMdh, 'hospital') }, { max: `${meta.mdh.maxShortfall}%` })
      : f('assumeMdhYear', 'assumeMdhYearE', { date: fmtDate(meta.mdh.endDate, 'long'), hospitals: noun(nMdh, 'hospital') })),
    share && f('assumeNtap', 'assumeNtapE', {}, { share, ntapFy: fyLabel(NTAP_FY), total: money(NTAP_AMOUNT) }),
    PARHM_END >= `${edition.fy - 1}-10-01` && (parhmMonths
      ? f('assumeParhm', 'assumeParhmE', {}, { date: fmtDate(PARHM_END, 'long'), months: parhmMonths })
      : f('assumeParhm', 'assumeParhmYearE', {}, { date: fmtDate(PARHM_END, 'long') })),
    f('assumeNew', 'assumeNewE'),
    nInactive > 0 && f(`assumeInactive${form(nInactive)}`, `assumeInactive${form(nInactive)}E`, { hospitals: noun(nInactive, 'hospital') }),
    nNoEst > 0 && f(`assumeNoEst${form(nNoEst)}`, 'assumeNoEstE', { hospitals: noun(nNoEst, 'hospital') }),
  ].filter(Boolean);
}

// The history's annual totals as table rows with their sources, and the sentence about where they come from.
function historyTotals(history) {
  const rows = history.national.map((r) => ({
    fy: fyLabel(r.fy),
    total: r.totalEst == null ? null : money(r.totalEst),
    source: r.totalEst == null ? null : { name: r.totalSrc?.label ?? null, url: httpsUrl(r.totalSrc?.url) },
  }));
  const simulated = history.national.filter((r) => r.totalEst != null && HISTORY_SIMULATED_FYS.includes(r.fy)).map((r) => fyLabel(r.fy));
  return {
    text: simulated.length ? methodsFill('historyTotalsSim', { simulated: listText(simulated) }) : methodsT('historyTotals'),
    noTotal: noTotalText(history.national.filter((r) => r.totalEst == null).map((r) => r.fy)),
    rows,
  };
}

// The Methods page's words as plain strings, filled from the data: the edition's phrases, the neutrality modifier at four
// decimals, how many hospitals the recomputation reproduces, the sources the data file names.
export function methodsView(ctx) {
  const { edition, meta } = ctx;
  const rep = meta.replication;
  const span = { first: fyLabel(edition.firstFy), last: fyLabel(edition.fy - 1) };
  const totals = meta.totals;
  const cmsLabel = totals?.cmsSrc?.label ?? null;
  return {
    edition: edition.label,
    heading: methodsFill('pageTitle', { edition: edition.label }),
    description: methodsT('pageDescription'),
    about: { intro: methodsFill('aboutIntro', { edition: edition.label }) },
    formula: {
      intro: methodsFill('formulaIntro', { conditions: spelled(CONDS.length), minCases: String(MIN_DISCHARGES) }),
      cap: methodsFill('formulaCap', { cap: String(CAP_PCT), nm: meta.nm.toFixed(4), pay: edition.payLong }),
      replication: rep.exact === rep.total
        ? methodsFill('replicationAll', { total: fmtInt(rep.total) })
        : methodsFill('replicationSome', { exact: fmtInt(rep.exact), total: fmtInt(rep.total) }),
    },
    meta,
    conditions: edition.conditions,
    dollars: methodsFill('dollarsInputs', { edition: edition.label }),
    totals: totals?.modelBase == null ? null : {
      text: methodsFill('dollarsTotals', { base: fmtMoney(totals.modelBase), pen: fmtMoney(totals.modelPen), cms: fmtMoney(totals.cmsEst), source: cmsLabel ?? methodsT('cmsSourceNone') }),
      url: httpsUrl(totals.cmsSrc?.url),
    },
    accuracy: accuracyLine(meta.dollarCheck, edition),
    assumptions: assumptionRows(ctx),
    read: {
      readmission: methodsT('readReadmission'),
      small: methodsFill('readSmall', { minCases: String(MIN_DISCHARGES) }),
      ma: methodsFill('readMa', { edition: edition.label }),
      window: methodsFill('readWindow', { window: edition.perfLong }),
    },
    places: meta.geocode
      ? methodsFill('placesGeocode', { address: fmtInt(meta.geocode.address), zip: fmtInt(meta.geocode.zip), county: fmtInt(meta.geocode.county) })
        + (meta.geocode.none ? methodsFill(meta.geocode.none === 1 ? 'placesNoneOne' : 'placesNone', { none: hospitals(meta.geocode.none) }) : '')
      : null,
    history: methodsFill('historyText', span),
    historyListed: methodsFill('historyListed', { first: fyLabel(HISTORY_LISTED_FYS[0]), last: fyLabel(HISTORY_LISTED_FYS[1]) }),
    historyTotals: historyTotals(ctx.history),
    feedback: methodsT('feedbackText'),
    reuse: methodsFill('reuseText', { minCases: String(MIN_DISCHARGES) }),
    pins: ctx.pinsUsed.map((p) => ({ title: p.title, url: httpsUrl(p.landingPage || p.downloadUrl), bytes: fmtInt(p.bytes), hash: `${p.sha256.slice(0, 16)}…`, retrieved: fmtDate(p.retrieved, 'long') })),
    glossary: {
      paf: methodsFill('defPaf', { floor: (1 - CAP_PCT / 100).toFixed(2) }),
      teach: methodsFill('defTeach', { major: String(TEACH_MAJOR) }),
    },
    sources: {
      files: meta.sources.map((s) => ({ name: s.name, url: httpsUrl(s.url) })),
      supplemental: methodsFill('sourceSupplemental', span),
      rules: methodsFill('sourceRules', { span: edition.span }),
    },
  };
}
