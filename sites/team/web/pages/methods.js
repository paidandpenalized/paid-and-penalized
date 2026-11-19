// The TEAM Methods page (/team/methods/): for hospital staff, how every number on the program page and in its
// calculator is made. The head (title and lede), then beside a contents column the sections: the sources and their
// dates (every pin the TEAM file names, TEAM's own first, then the hospital list's), the episode counts as a floor (with
// the DRG remaps), low volume, prices and the target amount, quality percentiles, the composite quality score, the
// calculator's band (#band, which the calculator's "why?" links), standardized dollars and what can still move the
// target, what the calculator leaves out, the unknowns and where each real value lives, the area test, the map and
// the worked example, and the code. Every number comes from the TEAM file (data.js loadTeam), the manifest's entries
// for its pins (loadSources) or a named constant; the words are methods/copy.js's, the citations methods/cites.js's
// and constants.js's.
import { BAND_DEFAULT, BAND_MAX, BAND_MIN, CATEGORIES } from '../../../../engine/js/team/params.js';
import { docSections, printout, sentenceOf } from '../../../../web/render/components.js';
import { count, decimal, fractionWord, isoDate, isoMonth, listText, money, numberWord, ordinal, pct } from '../../../../web/render/format.js';
import { html } from '../../../../web/render/html.js';
import { externalLink, page } from '../../../../web/render/layout.js';
import { SITE } from '../../../../web/site.js';
import {
  BAND_ANCHOR, BASELINE_YEARS, CITES, CJR_BAND, CQS_CAPS, CQS_SCALE, DEFAULT_TRACK, ERROR_DAYS, EXAMPLE, FALLS_PRF_CFR_YEAR, LOW_VOLUME,
  MEASURES, MISSING_QUALITY, OUTLIER_PERCENTILE, PY2_PERIODS, PY2_START, RECON_MONTHS, SUPPRESSED_MAX, TARGET_CAPS, TRACKS, yearOf,
} from '../constants.js';
import { METHODS_PATH, PROGRAM_PATH, SOURCE_LINKS } from '../links.js';
import { HASH_NAME, METHODS_CITES as C } from '../methods/cites.js';
import { fill, t } from '../methods/copy.js';
import { methodsFacts } from '../methods/facts.js';
import { PY2_NUMBER, cite, labelOf, shellOf } from './parts.js';

const sentence = sentenceOf(fill);
// A paragraph of words, with its citation when it states a rule.
const para = (words, ref = null) => html`<p>${words}${ref ? cite(ref) : ''}</p>`;
// A list of lead paragraphs: items [[head key, words, ref]].
const leads = (items) => html`<ul class="tm-meth__list">${items.map(([head, words, ref]) => html`<li><strong>${t(head)}</strong> ${words}${ref ? cite(ref) : ''}</li>`)}</ul>`;
const period = ({ start, end }) => [isoDate(start), isoDate(end)];
const [TA, TB, TC] = Object.keys(TRACKS);

// ---------- the sections ----------

// The date CMS gives a pin: the list's own as-of date, else a release or change date, else the file's Last-Modified.
const dateOf = (e) => e.asOf ?? e.pdcReleased ?? e.pdcModified ?? e.datasetModified ?? e.derivedFrom?.lastModified ?? null;
const hrefOf = (e) => e.landingPage ?? e.downloadUrl ?? e.derivedFrom?.downloadUrl ?? null;
// Who publishes a pin, by its address. A pin from anywhere else throws, so a new source gets a publisher on purpose.
const PUBLISHERS = [[/^https:\/\/(www\.|data\.)?cms\.gov\//, 'pubCms'], [/^https:\/\/[\w.]*census\.gov\//, 'pubCensus'],
  [/^https:\/\/github\.com\/topojson\//, 'pubAtlas'], [/^https:\/\/github\.com\/daltonhaslam\/thirty-day-readmissions/, 'pubTdr']];
function publisherOf(e) {
  const href = hrefOf(e) ?? '';
  const hit = PUBLISHERS.find(([pattern]) => pattern.test(href));
  if (!hit) throw new RangeError(`TEAM Methods: no publisher for the source ${e.id}`);
  return t(hit[1]);
}

// The sources: the TEAM file's pins in two tables (those the hospital master also reads, and TEAM's own), each row the
// file (linked), who publishes it, the source's date, the day it was fetched and its hash's start, labeled by its
// heading; then the published sources the page cites.
function sourcesSection(team, sources, shared) {
  const table = (key, rows) => (rows.length ? html`<h3 class="tm-meth__sub" id="tm-src-${key}">${t(key)}</h3>
${printout(html`<table class="gb tm-meth__pins" aria-labelledby="tm-src-${key}">
<thead><tr><th scope="col">${t('srcColFile')}</th><th scope="col">${t('srcColBy')}</th><th scope="col">${t('srcColDate')}</th><th scope="col">${t('srcColGot')}</th><th scope="col">${fill('srcColHash', { hash: HASH_NAME })}</th></tr></thead>
<tbody>${rows.map((e) => {
    const href = hrefOf(e);
    const date = dateOf(e);
    return html`<tr><th scope="row">${href ? externalLink(href, e.title) : e.title}</th><td>${publisherOf(e)}</td><td class="nw">${date ? isoDate(date.slice(0, 10)) : t('srcNoDate')}</td><td class="nw">${isoDate(e.retrieved)}</td><td><code>${e.sha256.slice(0, 16)}</code></td></tr>`;
  })}</tbody>
</table>`)}` : '');
  const published = [
    [SOURCE_LINKS.rule, fill('srcRule', { cite: CITES.subpart })], [SOURCE_LINKS.faq, t('srcFaq')], [SOURCE_LINKS.qualityScoring, t('srcQuality')],
    [SOURCE_LINKS.fy2027Rule, fill('srcFinalRule', { fy: String(team.fy) })], [SOURCE_LINKS.mupMethod, t('srcMup')],
    [SOURCE_LINKS.cjrRecon, t('srcCjr')], [SOURCE_LINKS.bpciEval, t('srcBpci')],
  ];
  return {
    id: 'sources', heading: t('srcHeading'), body: html`${para(fill('srcText', { hash: HASH_NAME }))}
${table('srcOwn', sources.filter((e) => !shared.has(e.id)))}
${table('srcShared', sources.filter((e) => shared.has(e.id)))}
<h3 class="tm-meth__sub">${t('srcPublished')}</h3>
<ul class="tm-meth__links">${published.map(([href, label]) => html`<li>${externalLink(href, label)}</li>`)}</ul>`,
  };
}

// The episode counts: what they are, why they are a floor (C16), and the DRG remaps as a table.
function episodesSection(team) {
  const year = String(team.meta.mupYears.at(-1));
  const pyYear = yearOf(PY2_START);
  const max = count(SUPPRESSED_MAX);
  const facts = methodsFacts(team);
  const moved = (to) => {
    const shares = Object.entries(to);
    return shares.length === 1 ? shares[0][0] : listText(shares.map(([drg, share]) => fill('remapShare', { share: pct(share, 0), drg })));
  };
  return {
    id: 'episodes', heading: t('epHeading'), body: html`${para(fill('epWhat', { year }), C.mup)}
${para(t('epFloor'))}
${leads([
    ['epHiddenHead', fill('epHidden', { max }), C.mup],
    ['epOutpatientHead', t('epOutpatient'), C.outpatient],
    ['epYearHead', fill('epYear', { year, pyYear })],
  ])}
${para(fill('epNoBound', { max, pyYear, active: count(facts.active), none: count(facts.noEpisodes) }))}
${para(fill('epRemap', { py: PY2_NUMBER }))}
${printout(html`<table class="gb tm-meth__remap">
<caption>${t('remapCaption')}</caption>
<thead><tr><th scope="col">${t('remapColFrom')}</th><th scope="col">${t('remapColTo')}</th></tr></thead>
<tbody>${Object.entries(team.method.remaps).map(([from, to]) => html`<tr><th scope="row">${from}</th><td>${moved(to)}</td></tr>`)}</tbody>
</table>`, { fit: true })}`,
  };
}

// The data years named in full ("2023 and 2024"), however many the file has, and counted from it.
function lowVolumeSection(team) {
  const data = team.meta.mupYears;
  const years = numberWord(BASELINE_YEARS);
  const lv = count(LOW_VOLUME);
  return {
    id: 'low-volume', heading: t('lvHeading'), body: html`${para(fill('lvRule', { lv, years }), C.lowVolume)}
${para(fill('lvHere', { n: numberWord(data.length), list: listText(data.map(String)), scale: decimal(team.method.baselineScale, 1), years, lv }))}
${para(t('lvScope'), C.lowVolumeFaq)}`,
  };
}

function pricesSection(team) {
  const cats = listText(team.categoryAvgDerived.map((c) => t(`cat${c}`)));
  return {
    id: 'prices', heading: t('prHeading'), body: html`${para(fill('prPrices', { py: PY2_NUMBER }), C.prices)}
${para(fill('prCategory', { cats }))}
${para(t('prTarget'), C.risk)}`,
  };
}

function qualitySection(team) {
  const { cohort, qualityPeriods: got } = team.method;
  const [hwrFrom, hwrTo] = period(got.hybrid_hwr);
  const [iscmrFrom, iscmrTo] = period(got.iscmr);
  const [pyHwrFrom, pyHwrTo] = period(PY2_PERIODS.hybrid_hwr);
  const [pyIscmrFrom, pyIscmrTo] = period(PY2_PERIODS.iscmr);
  const others = Object.values(MEASURES).filter((m) => !m.public).length;
  return {
    id: 'quality', heading: t('qHeading'), body: html`${para(t('qRule'), C.cohort)}
${para(fill('qHere', { hwrName: t('q_hybrid_hwr').toLowerCase(), hwr: count(cohort.hybrid_hwr), iscmrName: t('q_iscmr').toLowerCase(), iscmr: count(cohort.iscmr) }))}
${para(fill('qPeriods', { hwrFrom, hwrTo, iscmrFrom, iscmrTo, py: PY2_NUMBER, pyHwrFrom, pyHwrTo, pyIscmrFrom, pyIscmrTo }), C.periods)}
${para(fill('qMissing', { missing: String(MISSING_QUALITY), n: numberWord(others) }), C.missing)}`,
  };
}

function cqsSection() {
  const max = String(CQS_SCALE);
  const sheet = externalLink(SOURCE_LINKS.qualityScoring, t('cqsSheet'));
  return {
    id: 'cqs', heading: t('cqsHeading'), body: html`${para(t('cqsWeights'), C.weights)}
${para(fill('cqsSum', { max }), C.cqs)}
${para(fill('cqsAdjust', { gain: pct(CQS_CAPS[TA].gain, 0), max, lossB: pct(CQS_CAPS[TB].loss, 0), tb: TB, lossC: pct(CQS_CAPS[TC].loss, 0), tc: TC }), C.cqsAdjust)}
${para(sentence('cqsSource', { sheet }))}`,
  };
}

// The band's evidence: this site's own count, so no claim; Track 2's limit only when the default band equals it.
function bandSection() {
  const band = `±${pct(BAND_DEFAULT, 0)}`;
  const track2 = TRACKS[TB].gain === BAND_DEFAULT && TRACKS[TB].loss === BAND_DEFAULT;
  return {
    id: BAND_ANCHOR, heading: t('bandHeading'), body: html`${para(fill('bandWhat', { band, lo: pct(BAND_MIN, 0), hi: pct(BAND_MAX, 0) }))}
${para(sentence('bandCount', { file: externalLink(SOURCE_LINKS.cjrRecon, t('bandFile')) }, {
    band, share: fractionWord(CJR_BAND.share, 'about'), within: pct(CJR_BAND.within, 0), wideShare: fractionWord(CJR_BAND.wideShare), wideWithin: pct(CJR_BAND.wideWithin, 0),
  }))}
${para(sentence('bandBpci', { eval: externalLink(SOURCE_LINKS.bpciEval, t('bandEval')) }))}
${track2 ? para(fill('bandTrack2', { band, tb: TB }), C.track2) : ''}
${para(fill('bandCaveat', { n: numberWord(CATEGORIES.length) }), C.categories)}`,
  };
}

function movesSection() {
  return {
    id: 'moves', heading: t('movesHeading'), body: html`${para(t('movesStd'), C.standardized)}
${para(fill('movesTarget', { norm: pct(TARGET_CAPS.normalization, 0), trend: pct(TARGET_CAPS.trend, 0) }), C.moves)}
${para(t('movesSo'))}`,
  };
}

function leftSection() {
  return {
    id: 'left-out', heading: t('leftHeading'), body: leads([
      ['leftRiskHead', t('leftRisk'), C.risk],
      ['leftPostHead', t('leftPost'), C.post],
      ['leftCapHead', fill('leftCap', { pctile: ordinal(OUTLIER_PERCENTILE) }), C.outlier],
    ]),
  };
}

// The unknowns (C15): each item what the calculator assumes, then where the real value lives, each with its citation.
function unknownsSection() {
  const py = PY2_NUMBER;
  const missing = String(MISSING_QUALITY);
  const part = (label, words, ref) => html`<p><span class="tm-meth__k">${t(label)}</span> ${words}${ref ? cite(ref) : ''}</p>`;
  const item = (head, assume, where, extra = '') => html`<li><h3 class="tm-meth__sub">${t(head)}</h3>
${part('unkAssumes', ...assume)}
${part('unkWhere', ...where)}${extra}</li>`;
  const find = html`<a href="${PROGRAM_PATH}#find">${labelOf('find')}</a>`;
  return {
    id: 'unknowns', heading: t('unkHeading'), body: html`${para(t('unkIntro'))}
<ul class="tm-meth__unknowns">
${item('unkTrackHead', [fill('unkTrackAssume', { tc: String(DEFAULT_TRACK), py }), CITES.tracks], [t('unkTrackWhere'), C.track])}
${item('unkReportHead', [t('unkReportAssume')], [fill('unkReportWhere', { months: String(RECON_MONTHS), days: String(ERROR_DAYS) }), C.report])}
${item('unkFallsHead', [fill('unkFallsAssume', { missing, py }), C.fallsAssume], [t('unkFallsWhere'), C.falls], html`
${para(fill('unkFallsCfr', { cfrYear: FALLS_PRF_CFR_YEAR, py }), C.fallsCfr)}
${para(fill('unkFallsCms', { cmsYear: yearOf(PY2_START) }), C.fallsCms)}`)}
${item('unkLowHead', [t('unkLowAssume')], [t('unkLowWhere'), C.lowWhere])}
${item('unkMdhHead', [t('unkMdhAssume')], [fill('unkMdhWhere', { tb: TB }), C.mdh])}
${item('unkOwnHead', [t('unkOwnAssume')], [sentence('unkOwnWhere', { find })])}
</ul>`,
  };
}

function areaSection(team, delineation) {
  const { mandatory, placed, mismatched } = team.method.areaCheck;
  const codes = Object.values(team.status).map(([code]) => code);
  const n = (code) => count(codes.filter((c) => c === code).length);
  const month = isoMonth(`${delineation}-01`);
  const check = mismatched === 0
    ? fill('areaCheckAll', { mandatory: count(mandatory), placed: count(placed) })
    : fill('areaCheckSome', { mandatory: count(mandatory), placed: count(placed), mismatched: count(mismatched) });
  return {
    id: 'area', heading: t('areaHeading'), body: html`${para(fill('areaRule', { n: count(team.counts.selectedAreas) }), C.areas)}
${para(fill('areaPlace', { omb: `${month.month} ${month.year}`, fy: String(team.fy) }))}
${para(check)}
${para(fill('areaUnknownNote', { n: n('area_unknown') }))}
${para(fill('areaUnlisted', { n: n('unlisted') }), C.newHospital)}`,
  };
}

function otherSection() {
  return {
    id: 'other', heading: t('otherHeading'), body: html`${para(fill('methodsMap', { year: yearOf(PY2_START) }))}
${para(fill('methodsExample', { target: money(EXAMPLE.target), spend: pct(-EXAMPLE.spend, 0), cqs: String(EXAMPLE.cqs), track: String(EXAMPLE.track) }))}`,
  };
}

function codeSection(team) {
  return {
    id: 'code', heading: t('codeHeading'), body: html`${para(sentence('codeText', { repo: externalLink(SITE.repo, SITE.repo.replace(/^https:\/\//, '')) }))}
${para(sentence('codeChanges', { log: html`<a href="${SITE.pages.corrections}">${t('codeLog')}</a>` }, { v: String(team.methods_version) }))}`,
  };
}

// team: data.js loadTeam()'s file; sources: loadSources(team), the manifest's entry for each of the file's pins;
// shared: the ids of the pins the hospital master also reads (data.js sharedSources), listed in a table of their own.
export function methodsPage({ team, sources, shared, robots, assets }) {
  if (!team || !sources || !shared) throw new TypeError('TEAM Methods: team, sources and shared (data.js loadTeam, loadSources, loadSharedSources) are required');
  const delineation = sources.find((e) => e.delineated)?.delineated;
  if (!delineation) throw new RangeError('TEAM Methods: no source gives the CBSA delineation\'s month');
  const sections = [
    sourcesSection(team, sources, shared), episodesSection(team), lowVolumeSection(team), pricesSection(team), qualitySection(team), cqsSection(),
    bandSection(), movesSection(), leftSection(), unknownsSection(), areaSection(team, delineation), otherSection(), codeSection(team),
  ];
  const body = html`<article class="wrap page tm tm-meth">
<header class="page__head">
<h1>${t('methodsTitle')}</h1>
<p class="tm-meth__lede">${fill('methodsIntro', { cite: CITES.subpart })}</p>
</header>
${docSections({ contents: t('contentsHeading'), sections })}
</article>`;
  return page({
    title: `${t('methodsTitle')} · ${SITE.name}`,
    description: t('methodsDescription'),
    path: METHODS_PATH,
    robots,
    body,
    assets,
    ...shellOf({ current: 'methods' }),
  });
}
