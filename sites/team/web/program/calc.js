// Part 5, your hospital: its words over the calculator, drawn for the emitter's rule-picked default hospital (the median
// yearly target among mandatory, active participants with no Track 2 flag and four or more episode types). The frame is
// the build's alone: the worksheet's title bar, the hospital's name, the picker (the family's search box, mounted by the
// page's script; hidden without it) and "Show one at random", the banner a shared link turns on, the no-JS sentence, the
// calculator itself (calc-view.js calcMarkup, the same markup the browser draws first) and the default hospital's row in
// the page (calc-data.js), so the calculator runs before anything loads. Every other participant's row is in one hashed
// file (dataUrl), fetched on the reader's first move toward another hospital, with the family search's names (searchUrl).
import { BAND_MAX, BAND_MIN, CATEGORIES, LOW_VOLUME, MISSING_QUALITY, TRACKS } from '../../../../engine/js/team/params.js';
import { sentenceOf } from '../../../../web/render/components.js';
import { fractionWord, pct, spelled } from '../../../../web/render/format.js';
import { html, jsonScript } from '../../../../web/render/html.js';
import { searchForm } from '../../../../web/render/shell.js';
import { activeCcns, calcMeta, calcRow, hospOf, whoOf } from '../../../../web/team/calc-data.js';
import { t as tCalc } from '../calc-copy.js';
import { calcMarkup, calcView } from '../calc-view.js';
import { initialState } from '../../../../web/team/opening.js';
import { BAND_ANCHOR, CITES, CJR_BAND, DEFAULT_TRACK, PY2_START, yearOf } from '../constants.js';
import { fill, t } from '../copy.js';
import { METHODS_PATH, PROGRAM_PATH } from '../links.js';
import { PY2_NUMBER, partOf } from '../pages/parts.js';

const sentence = sentenceOf(fill);

// The default hospital as the browser will read it: its row (through hospOf, as every other hospital's) and its name.
export function defaultHosp(team, search) {
  const p = team.participants.find((x) => x.ccn === team.defaultCcn);
  if (!p) throw new RangeError('TEAM: the default hospital is not among the participants');
  const row = calcRow(p);
  const who = whoOf(search, p.ccn);
  return { row, who, hosp: hospOf(row, who) };
}

// The calculator's parts that are the same for every hospital (calc-view.js staticBox): the quality note, "How each
// line works" and the band's "why?". The build writes them once; the page's script keeps them as it draws another
// hospital. dataYear: the year the episode counts come from.
export function calcStatics(dataYear) {
  const { qGain, qLoss } = TRACKS[DEFAULT_TRACK];
  const why = sentence('whyText', { methods: html`<a href="${METHODS_PATH}#${BAND_ANCHOR}">${t('whyMethods')}</a>` }, {
    share: fractionWord(CJR_BAND.share, 'about'), band: `±${pct(CJR_BAND.within, 0)}`, lo: pct(BAND_MIN, 0), hi: pct(BAND_MAX, 0),
  });
  return {
    qFoot: html`<p class="tc-foot">${fill('qFoot', { missing: String(MISSING_QUALITY) })} <span class="tm-cite">${CITES.cqs}</span></p>`,
    how: html`<details class="tc-more tc-how"><summary>${t('howSummary')}</summary>
<p>${fill('howEpisodes', { year: String(dataYear) })} ${t('howPrice')}</p>
<p>${fill('howLv', { lv: String(LOW_VOLUME) })} ${t('howSpend')}</p>
<p>${fill('howQuality', { keep: pct(1 - qGain, 0), cut: pct(qLoss, 0), n: String(DEFAULT_TRACK) })} ${t('howLimits')} ${t('howPost')} <span class="tm-cite">${CITES.limitsAll}</span></p>
</details>`,
    why: html`<details class="tc-why"><summary>${t('whySummary')}</summary><p>${why}</p></details>`,
  };
}

// The calculator's section (#calc). search: the family search's file (names); files: { searchUrl, dataUrl }.
export function calcSection({ team, search, files }) {
  const { row, who, hosp } = defaultHosp(team, search);
  const meta = calcMeta(team);
  const view = calcView({ hosp, state: initialState(hosp), team: meta });
  const statics = calcStatics(meta.dataYear);
  return html`<section id="calc" class="tc" data-src="${files.dataUrl}" data-search="${files.searchUrl}" data-failed="${tCalc('calcFailed')}">
<p class="tc__title"><span>${fill('calcTitle', { year: yearOf(PY2_START), py: PY2_NUMBER })}</span><span data-v="where">${view.hosp.where}</span></p>
<div class="tc__pick"><p class="tc__name" data-v="name">${view.hosp.name}</p>
${searchForm({ id: 'tc-pick', src: files.searchUrl, label: t('calcPick'), find: t('calcPick'), findRest: t('calcPickRest'), placeholder: t('calcPickHolder'), only: 'hospital' })}
<button type="button" class="fig__btn tc__random" data-calc-random hidden>${t('calcRandom')}</button></div>
<p class="wi-banner tc__banner" data-calc-banner hidden>${t('calcBanner')} <a href="${PROGRAM_PATH}#calc" data-calc-reset>${t('calcBannerLink')}</a> <span data-calc-rejected></span></p>
<p class="tc__nojs">${t('calcNoScript')}</p>
<p class="vh" role="status" data-calc-say></p>
<div class="tc__body" data-calc-body>${calcMarkup(view, { statics })}</div>
${jsonScript('tc-data', { meta, row, who, ccns: activeCcns(team) })}
</section>`;
}

// Part 5: its words over the calculator, the page's width. files: { searchUrl, dataUrl }.
export const yoursPart = ({ n, team, search, files }) => partOf({
  id: 'yours', n, wide: true, heading: t('yoursHeading'), words: html`<p>${fill('yoursIntro', { n: spelled(CATEGORIES.length) })}</p>`,
  after: calcSection({ team, search, files }),
});
