// Part 5, your hospital: its words over the calculator, drawn for the emitter's rule-picked default hospital (the median
// yearly target among mandatory, active participants with no Track 2 flag and four or more episode types). The frame is
// the build's alone: the worksheet's title bar, the hospital's name, the picker (the family's search box, mounted by the
// page's script; hidden without it) and "Show one at random", the banner a shared link turns on, the no-JS sentence, the
// calculator itself (calc-view.js calcMarkup, the same markup the browser draws first) and the default hospital's row in
// the page (calc-data.js), so the calculator runs before anything loads. Every other participant's row is in one hashed
// file (dataUrl), fetched on the reader's first move toward another hospital, with the family search's names (searchUrl).
import { CATEGORIES } from '../../../../engine/js/team/params.js';
import { spelled } from '../../../../web/render/format.js';
import { html, jsonScript } from '../../../../web/render/html.js';
import { searchForm } from '../../../../web/render/shell.js';
import { calcMeta, calcRow, hospOf, whoOf } from '../calc-data.js';
import { fill as fillCalc, t as tCalc } from '../calc-copy.js';
import { calcMarkup, calcView, initialState } from '../calc-view.js';
import { MODEL_START, PY2_START } from '../constants.js';
import { fill, t } from '../copy.js';
import { PROGRAM_PATH } from '../links.js';
import { partOf } from '../pages/parts.js';

const yearOf = (iso) => iso.slice(0, 4);
// The performance year PY2_START opens: years count from the model's first.
const PY = String(Number(yearOf(PY2_START)) - Number(yearOf(MODEL_START)) + 1);

// The default hospital as the browser will read it: its row (through hospOf, as every other hospital's) and its name.
export function defaultHosp(team, search) {
  const p = team.participants.find((x) => x.ccn === team.defaultCcn);
  if (!p) throw new RangeError('TEAM: the default hospital is not among the participants');
  const row = calcRow(p);
  const who = whoOf(search, p.ccn);
  return { row, who, hosp: hospOf(row, who) };
}

// The calculator's section (#calc). search: the family search's file (names); files: { searchUrl, dataUrl }.
export function calcSection({ team, search, files }) {
  const { row, who, hosp } = defaultHosp(team, search);
  const meta = calcMeta(team);
  const view = calcView({ hosp, state: initialState(hosp), team: meta });
  return html`<section id="calc" class="tc" data-src="${files.dataUrl}" data-search="${files.searchUrl}" data-failed="${tCalc('calcFailed')}">
<p class="tc__title"><span>${fillCalc('calcTitle', { year: yearOf(PY2_START), py: PY })}</span><span data-v="where">${view.hosp.where}</span></p>
<div class="tc__pick"><p class="tc__name" data-v="name">${view.hosp.name}</p>
${searchForm({ id: 'tc-pick', src: files.searchUrl, label: tCalc('calcPick'), find: tCalc('calcPick'), findRest: tCalc('calcPickRest'), placeholder: tCalc('calcPickHolder'), only: 'hospital' })}
<button type="button" class="fig__btn tc__random" data-calc-random hidden>${tCalc('calcRandom')}</button></div>
<p class="wi-banner tc__banner" data-calc-banner hidden>${tCalc('calcBanner')} <a href="${PROGRAM_PATH}#calc">${tCalc('calcBannerLink')}</a> <span data-calc-rejected></span></p>
<p class="tc__nojs">${tCalc('calcNoScript')}</p>
<p class="vh" role="status" data-calc-say></p>
<div class="tc__body" data-calc-body>${calcMarkup(view)}</div>
${jsonScript('tc-data', { meta, row, who })}
</section>`;
}

// Part 5: its words over the calculator, the page's width. files: { searchUrl, dataUrl }.
export const yoursPart = ({ n, team, search, files }) => partOf({
  id: 'yours', n, wide: true, heading: t('yoursHeading'), words: html`<p>${fill('yoursIntro', { n: spelled(CATEGORIES.length) })}</p>`,
  after: calcSection({ team, search, files }),
});
