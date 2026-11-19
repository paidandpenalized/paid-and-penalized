// Part 6, what a hospital in TEAM has to do: the rules' duties before, during and after a performance year, each with its
// rule, beside Figure 5, TEAM's clock (the model's dates, each a constant with its claim, and the day CMS dated the year's
// regional prices, the emitted file's). What the rules ask, said plainly: no advice.
import { figure } from '../../../../web/charts/figure.js';
import { count, isoDate, isoMonth, pct } from '../../../../web/render/format.js';
import { html } from '../../../../web/render/html.js';
import {
  CITES, CJRX_START, DEFAULT_TRACK, EPISODE_DAYS, ERROR_DAYS, MODEL_END, MODEL_START, PY2_DATA_DUE, PY2_START, RECON_MONTHS,
  RECORD_YEARS, RULE_NAMES, TRACKS, yearOf,
} from '../constants.js';
import { fill, t } from '../copy.js';
import { cite, partOf } from '../pages/parts.js';
import { TRACK_NUMBERS } from './change.js';

// A date's month and year ("Jul 2027"), for the clock's left column.
const monthYear = (iso) => {
  const { month, year } = isoMonth(iso);
  return `${month.slice(0, 3)} ${year}`;
};
// The first day of the month `months` after an ISO date's month: the day after a performance year ends plus the months
// CMS waits to reconcile it.
function monthsAfter(iso, months) {
  const [y, m] = iso.split('-').map(Number);
  const total = y * 12 + (m - 1) + months;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}-01`;
}
// The first performance year's reconciliation: RECON_MONTHS after the year ends (the day the second year starts).
const RECON_PY1 = monthsAfter(PY2_START, RECON_MONTHS);
const PY2_YEAR = yearOf(PY2_START);
const PY1_YEAR = yearOf(MODEL_START);

// The duties by phase: [phase key, [title key and values, text key and values, citation]].
const DUTIES = () => [
  ['phaseBefore', [
    [['doTrackTitle', { ta: TRACK_NUMBERS.ta, tb: TRACK_NUMBERS.tb }], ['doTrackText', { tc: TRACK_NUMBERS.tc }], CITES.trackAsk],
    [['doDataTitle'], ['doDataText', { year: PY2_YEAR, date: isoDate(PY2_DATA_DUE) }], CITES.data],
    [['doAapmTitle'], ['doAapmText', { tb: TRACK_NUMBERS.tb, tc: TRACK_NUMBERS.tc }], CITES.aapm],
  ]],
  ['phaseDuring', [
    [['doNoticeTitle'], ['doNoticeText'], CITES.notice],
    [['doCostTitle'], ['doCostText'], CITES.noticeCost],
    [['doListTitle'], ['doListText'], CITES.postAcute],
    [['doReferTitle'], ['doReferText'], CITES.primaryCare],
    [['doArrangeTitle'], ['doArrangeText'], CITES.lists],
    [['doSnfTitle', { rule: RULE_NAMES.snfRule }], ['doSnfText', { days: String(EPISODE_DAYS) }], CITES.snf],
    [['doQualityTitle'], ['doQualityText'], CITES.quality],
  ]],
  ['phaseAfter', [
    [['doReconTitle', { months: String(RECON_MONTHS) }], ['doReconText', { year: PY1_YEAR, month: (({ month, year }) => `${month} ${year}`)(isoMonth(RECON_PY1)) }], CITES.recon],
    [['doErrorTitle', { days: String(ERROR_DAYS) }], ['doErrorText', { days: String(ERROR_DAYS) }], CITES.error],
    [['doPayTitle'], ['doPayText', { ta: TRACK_NUMBERS.ta }], CITES.pay],
    [['doRecordsTitle', { years: String(RECORD_YEARS) }], ['doRecordsText'], CITES.records],
  ]],
];
const words = ([key, values]) => (values ? fill(key, values) : t(key));

const checklist = () => html`<div class="tm-check">${DUTIES().map(([phase, items], i) => html`<section class="tm-phase" aria-labelledby="phase-${i + 1}">
<h3 class="tm-phase__h" id="phase-${i + 1}">${t(phase)}</h3>
<ul class="tm-phase__list" role="list">${items.map(([title, text, ref]) => html`<li class="tm-duty"><h4 class="tm-duty__h">${words(title)}</h4><p class="tm-duty__p">${words(text)}${cite(ref)}</p></li>`)}</ul>
</section>`)}</div>`;

// The clock's dates, in order: { date (ISO), label (the left column), text, now (the day the page is about) }.
export function clockDates(team) {
  const limit = `±${pct(TRACKS[DEFAULT_TRACK].gain, 0)}`;
  return [
    { date: MODEL_START, text: fill('clockStart', { ta: TRACK_NUMBERS.ta }) },
    { date: PY2_DATA_DUE, text: fill('clockData', { year: PY2_YEAR }) },
    { date: team.meta.pricesDated, text: fill('clockPrices', { year: PY2_YEAR }) },
    { date: PY2_START, text: fill('clockTrack3', { tc: TRACK_NUMBERS.tc, limit }), now: true },
    { date: RECON_PY1, text: fill('clockRecon', { year: PY1_YEAR, months: count(RECON_MONTHS) }), monthOnly: true },
    { date: CJRX_START, text: t('clockCjrx') },
    { date: MODEL_END, text: t('clockEnd') },
  ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

function clockFigure(team, n) {
  const dates = clockDates(team);
  const whenText = (d) => (d.monthOnly ? (({ month, year }) => `${month} ${year}`)(isoMonth(d.date)) : isoDate(d.date));
  const chart = html`<ol class="tm-clock" role="list">${dates.map((d) => html`<li class="tm-clock__item${d.now ? ' tm-clock__item--now' : ''}"><time class="tm-clock__when" datetime="${d.monthOnly ? d.date.slice(0, 7) : d.date}">${monthYear(d.date)}</time><span class="tm-clock__what">${d.text}</span></li>`)}</ol>`;
  return figure({
    n,
    takeaway: fill('clockTakeaway', { from: yearOf(MODEL_START), to: yearOf(MODEL_END) }),
    chart,
    source: fill('clockSource', { cite: CITES.subpart }),
    csvName: 'team-clock',
    table: { columns: [{ name: t('clockColWhen') }, { name: t('clockColWhat') }], rows: dates.map((d) => [whenText(d), d.text]) },
  });
}

// Part 6. n: the Part's number; figureN: the page's figure counter.
export function dutiesPart({ team, n, figureN }) {
  const body = html`<p>${t('doIntro')}</p>
${checklist()}`;
  return partOf({ id: 'do', n, heading: t('doHeading'), words: body, fig: html`<div class="tm-sticky">${clockFigure(team, figureN())}</div>` });
}
