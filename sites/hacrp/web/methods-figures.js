// The Methods page's figures: the self-check drawn (every recomputed score against CMS's, every decision against the
// line this site finds), the periods behind each year's cut, and the pipeline from CMS's file to the pages. Every
// number comes from the checks the build runs (engine/js/hacrp/history.js) and the pinned-input manifest.
import { figure, imagePair, num } from '../../../web/charts/figure.js';
import { proofStrips } from '../../../web/charts/proofStrips.js';
import { ruleStack } from '../../../web/charts/ruleStack.js';
import { periodsChart } from '../../../web/charts/periods.js';
import { WIDTH } from '../../../web/charts/svg.js';
import { cmsText, count, decimal, isoDate, longDate } from '../../../web/render/format.js';
import { html } from '../../../web/render/html.js';
import { SCORE_TOLERANCE } from '../../../engine/js/hacrp/history.js';
import { SCORE_DECIMALS as DP } from '../../../engine/js/hacrp/score.js';
import { SHORT_NAMES } from './constants.js';
import { fill, fillKeep, t } from './methods/copy.js';

// The pinned-input manifest's fingerprint, by name.
const HASH_NAME = 'SHA-256';
// The proof strips' bin width: a tenth of the score's last decimal.
const PROOF_STEP = 0.00001;
// The wide drawings' width, about the page's figure column.
export const METHODS_WIDE = 640;
const limitText = decimal(SCORE_TOLERANCE, 3);
const missText = (x) => decimal(x, 5);
const fyLabel = (fy) => `FY${fy}`;
// "fiscal years 2015 to 2026", or "fiscal year 2026" for one.
const yearsText = (checks) => (checks.length === 1 ? `FY${checks[0].fy}` : `FY${checks[0].fy}–FY${checks[checks.length - 1].fy}`);

// checks: [{ fy, rule, check }] oldest first; check: yearCheck() (engine/js/hacrp/history.js).
export function proofFigure(checks, { n, source }) {
  const rows = [...checks].reverse().map(({ fy, check }) => ({ label: fyLabel(fy), note: check.scored ? fill('proofNote', { scores: count(check.scored), miss: missText(check.maxError) }) : t('proofNoteNone'), diffs: check.diffs }));
  const draw = (width) => proofStrips({ rows, limit: SCORE_TOLERANCE, step: PROOF_STEP, labels: { fail: t('proofFail') }, width, format: (v) => cmsText(v === 0 ? '0' : decimal(v, 4)) });
  const scores = checks.reduce((s, c) => s + c.check.scored, 0);
  const miss = Math.max(...checks.map((c) => c.check.maxError));
  const takeaway = checks.length === 1
    ? fill('proofTakeawayOne', { scores: count(scores), fy: String(checks[0].fy), miss: missText(miss), limit: limitText })
    : fill('proofTakeaway', { years: yearsText(checks), scores: count(scores), miss: missText(miss), limit: limitText });
  return figure({
    n, takeaway, source, claimLevel: 'recomputed', csvName: 'hacrp-score-check', alt: t('proofAlt'),
    svg: draw(WIDTH), svgWide: draw(METHODS_WIDE),
    table: {
      columns: [{ name: t('proofColYear') }, { name: t('proofColScores'), numeric: true }, { name: fill('proofColWithin', { limit: limitText }), numeric: true }, { name: t('proofColMiss'), numeric: true }, { name: t('proofColWithheld'), numeric: true }, { name: t('proofColRule') }],
      rows: checks.map(({ fy, rule, check }) => [fyLabel(fy), num(count(check.scored), check.scored), num(count(check.within), check.within), num(missText(check.maxError), check.maxError), num(count(check.withheld.length), check.withheld.length), rule]),
    },
  });
}

export function sidesFigure(checks, { n, source }) {
  const gap = (c) => `${cmsText(decimal(c.highestNo, DP))}–${cmsText(decimal(c.lowestYes, DP))}`;
  const rows = [...checks].reverse().map(({ fy, check }) => ({
    label: fyLabel(fy),
    note: check.yes ? fill('sidesNote', { yes: count(check.yes), decided: count(check.decided), line: gap(check) }) : t('sidesNoteNone'),
    scores: check.sorted.scores,
    yes: check.sorted.yes,
    line: check.yes ? check.yes : null,
  }));
  const decided = checks.reduce((s, c) => s + c.check.decided, 0);
  const wrong = checks.reduce((s, c) => s + c.check.wrongSide.length, 0);
  const takeaway = checks.length === 1
    ? fill('sidesTakeawayOne', { decided: count(decided), fy: String(checks[0].fy), wrong: count(wrong) })
    : fill('sidesTakeaway', { decided: count(decided), years: yearsText(checks), wrong: count(wrong) });
  const draw = (width) => ruleStack({ rows, width });
  const pctText = (x) => (x === null ? '' : num(decimal(x * 100, 1), x * 100));
  return figure({
    n, takeaway, source, csvName: 'hacrp-decision-check', alt: t('sidesAlt'),
    svg: draw(WIDTH), svgWide: draw(METHODS_WIDE),
    table: {
      columns: [{ name: t('proofColYear') }, { name: t('sidesColDecided'), numeric: true }, { name: t('sidesColYes'), numeric: true }, { name: t('sidesColHighNo'), numeric: true }, { name: t('sidesColLowYes'), numeric: true }, { name: t('sidesColWrong'), numeric: true }, { name: t('sidesColPct'), numeric: true }],
      rows: checks.map(({ fy, check: c }) => [fyLabel(fy), num(count(c.decided), c.decided), num(count(c.yes), c.yes),
        c.highestNo === null ? '' : num(cmsText(decimal(c.highestNo, DP)), c.highestNo), c.lowestYes === null ? '' : num(cmsText(decimal(c.lowestYes, DP)), c.lowestYes),
        num(count(c.wrongSide.length), c.wrongSide.length), pctText(c.linePct)]),
    },
  });
}

// CMS's dates ("MM/DD/YYYY") as [year, month, day].
const ymd = (text) => {
  const [m, d, y] = text.split('/').map(Number);
  return [y, m, d];
};
const monthsBetween = (a, b) => (b[0] - a[0]) * 12 + (b[1] - a[1]);

// years: [{ fy, periods: { psi90, hai } }] oldest first, CMS's period dates for each fiscal year.
export function periodsFigure(years, { n, source }) {
  const short = SHORT_NAMES.PSI90;
  const label = { psi: fill('periodsPsi', { short }), hai: t('periodsHai'), pay: t('periodsPay') };
  const pay = (fy) => ({ start: `10/01/${fy - 1}`, end: `09/30/${fy}` });
  const span = (kind, fy, { start, end }) => ({ kind, start: ymd(start), end: ymd(end), tip: fill('periodsTip', { label: label[kind], fy: String(fy), start: longDate(start), end: longDate(end) }) });
  const rows = [...years].reverse().map(({ fy, periods }) => ({
    label: fyLabel(fy),
    spans: [periods.psi90 && span('psi', fy, periods.psi90), periods.hai && span('hai', fy, periods.hai), span('pay', fy, pay(fy))].filter(Boolean),
  }));
  const newest = years[years.length - 1];
  const earliest = [ymd(newest.periods.psi90.start), ymd(newest.periods.hai.start)].sort((a, b) => a[0] - b[0] || a[1] - b[1])[0];
  const lead = monthsBetween(earliest, [newest.fy - 1, 10, 1]);
  const draw = (width) => periodsChart({ rows, kinds: ['psi', 'hai', 'pay'], width });
  return figure({
    n, source, csvName: 'hacrp-periods', alt: t('periodsAlt'),
    takeaway: fill('periodsTakeaway', { fy: String(newest.fy), payStart: longDate(pay(newest.fy).start), lead: fill('periodsLead', { months: String(lead) }) }),
    note: fill('periodsKey', { short }),
    svg: draw(WIDTH), svgWide: draw(METHODS_WIDE),
    table: {
      columns: [{ name: t('periodsColFy') }, { name: fill('periodsColPsi', { short }) }, { name: t('periodsColHai') }, { name: t('periodsColPay') }],
      rows: years.map(({ fy, periods }) => [fyLabel(fy), ...[periods.psi90, periods.hai, pay(fy)].map((p) => (p ? `${longDate(p.start)} – ${longDate(p.end)}` : t('periodsNone')))]),
    },
  });
}

// The pipeline: six stations, each with its real number for the newest year, as an ordered list (a phone stacks it).
export function pipeline({ rows, source, pin, measures, check, pages }) {
  const stations = [
    { name: t('pipe1'), value: fill('pipe1Value', { rows: count(rows) }), note: fillKeep('pipe1Note', { id: source.id, date: isoDate(source.pdcReleased) }, ['id', 'date']) },
    { name: t('pipe2'), value: fill('pipe2Value', { bytes: count(pin.bytes) }), note: fillKeep('pipe2Note', { algo: HASH_NAME, hash: `${pin.sha256.slice(0, 12)}…` }, ['hash']) },
    { name: t('pipe3'), value: fill('pipe3Value', { measures: String(measures) }), note: t('pipe3Note') },
    { name: t('pipe4'), value: fill('pipe4Value', { scored: count(check.scored) }), note: t('pipe4Note') },
    { name: t('pipe5'), value: fill('pipe5Value', { miss: missText(check.maxError) }), note: fill('pipe5Note', { decided: count(check.decided), wrong: count(check.wrongSide.length), limit: limitText }) },
    { name: t('pipe6'), value: fill('pipe6Value', { pages: count(pages) }), note: t('pipe6Note') },
  ];
  return html`<ol class="pipe" role="list">${stations.map((s, i) => html`<li class="pipe__st${i === 4 ? ' pipe__st--check' : ''}">
<p class="pipe__n">${String(i + 1)}</p>
<p class="pipe__name">${s.name}</p>
<p class="pipe__value">${s.value}</p>
<p class="pipe__note">${s.note}</p>
</li>`)}</ol>`;
}

// The receipts: every pinned input this site's HACRP pages read, with its size and fingerprint.
export function receipts(pins) {
  return html`<div class="printout"><div class="printout__scroll"><table class="gb receipts">
<thead><tr><th scope="col">${t('sourcesColFile')}</th><th scope="col" class="num">${t('sourcesColBytes')}</th><th scope="col">${fill('sourcesColHash', { algo: HASH_NAME })}</th><th scope="col">${t('sourcesColGot')}</th></tr></thead>
<tbody>${pins.map((p) => html`<tr><th scope="row">${p.landingPage || p.downloadUrl ? html`<a href="${p.landingPage || p.downloadUrl}">${p.title}</a>` : p.title}</th><td class="num">${count(p.bytes)}</td><td class="receipts__hash"><code>${p.sha256.slice(0, 16)}…</code></td><td>${isoDate(p.retrieved)}</td></tr>`)}</tbody>
</table></div></div>`;
}

// The receipt: the self-check as an adding-machine tape, one line a year (its scores recomputed and largest miss, its
// decisions and how many were out of order), then the totals. Every line is a year the build checked.
export function receipt(checks) {
  const dash = t('receiptDash');
  const lines = checks.map(({ fy, check: c }) => html`<tr><th scope="row">${fyLabel(fy)}</th><td>${c.scored ? count(c.scored) : dash}</td><td>${c.scored ? missText(c.maxError) : dash}</td><td>${c.decided ? count(c.decided) : dash}</td><td class="receipt__ok">${!c.scored && !c.decided ? t('receiptNone') : c.ok ? t('receiptOk') : t('receiptFail')}</td></tr>`);
  const scores = checks.reduce((n, c) => n + c.check.scored, 0);
  const decided = checks.reduce((n, c) => n + c.check.decided, 0);
  const wrong = checks.reduce((n, c) => n + c.check.wrongSide.length, 0);
  const miss = Math.max(...checks.map((c) => c.check.maxError));
  const withheld = checks.reduce((n, c) => n + c.check.withheld.length, 0);
  return html`<div class="receipt">
<p class="receipt__head">${t('receiptHead')}</p>
<table class="receipt__t">
<thead><tr><th scope="col">${t('receiptColFy')}</th><th scope="col">${t('receiptColScores')}</th><th scope="col">${t('receiptColMiss')}</th><th scope="col">${t('receiptColDecisions')}</th><th scope="col"><span class="vh">${t('receiptColOk')}</span></th></tr></thead>
<tbody>${lines}</tbody>
</table>
<dl class="receipt__sum">
<div><dt>${t('receiptScores')}</dt><dd>${count(scores)}</dd></div>
<div><dt>${t('receiptMiss')}</dt><dd>${missText(miss)}</dd></div>
<div><dt>${t('receiptLimit')}</dt><dd>${limitText}</dd></div>
${withheld ? html`<div><dt>${t('receiptWithheld')}</dt><dd>${count(withheld)}</dd></div>` : ''}
<div><dt>${t('receiptDecisions')}</dt><dd>${count(decided)}</dd></div>
<div><dt>${t('receiptWrong')}</dt><dd>${count(wrong)}</dd></div>
</dl>
</div>`;
}
