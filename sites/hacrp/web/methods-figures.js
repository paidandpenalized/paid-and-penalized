// The Methods page's figures: the self-check drawn (every recomputed score against CMS's, every decision against the
// line this site finds), the periods behind each year's cut, and the pipeline from CMS's file to the pages. Every
// number comes from the checks the build runs (engine/js/hacrp/history.js) and the pinned-input manifest.
import { drawn, figure, num } from '../../../web/charts/figure.js';
import { proofStrips } from '../../../web/charts/proofStrips.js';
import { ruleStack } from '../../../web/charts/ruleStack.js';
import { periodsChart } from '../../../web/charts/periods.js';
import { printout } from '../../../web/render/components.js';
import { cmsText, count, decimal, dollars, isoDate, longDate, money, pct } from '../../../web/render/format.js';
import { html } from '../../../web/render/html.js';
import { SCORE_TOLERANCE } from '../../../engine/js/hacrp/history.js';
import { SCORE_DECIMALS as DP } from '../../../engine/js/hacrp/score.js';
import { REDUCTION_TEXT, SHORT_NAMES } from './constants.js';
import { fyLabel } from './copy.js';
import { fill, fillKeep, t } from './methods/copy.js';

// The pinned-input manifest's fingerprint, by name.
const HASH_NAME = 'SHA-256';
// The proof strips' bin width: a tenth of the score's last decimal.
const PROOF_STEP = 0.00001;
// The wide drawings' width, about the page's figure column.
export const METHODS_WIDE = 640;
export const limitText = decimal(SCORE_TOLERANCE, 3);
const missText = (x) => decimal(x, 5);
// "FY2015–FY2026", or "FY2026" for one.
const yearsText = (checks) => (checks.length === 1 ? fyLabel(checks[0].fy) : `${fyLabel(checks[0].fy)}–${fyLabel(checks[checks.length - 1].fy)}`);

// The self-check's totals over every year: scores recomputed, the largest miss, rows withheld, decisions, and
// decisions out of order.
export function checkTotals(checks) {
  const sum = (f) => checks.reduce((n, c) => n + f(c.check), 0);
  return {
    scored: sum((c) => c.scored),
    miss: Math.max(...checks.map((c) => c.check.maxError)),
    withheld: sum((c) => c.withheld.length),
    decided: sum((c) => c.decided),
    wrong: sum((c) => c.wrongSide.length),
  };
}

// checks: [{ fy, rule, check }] oldest first; check: yearCheck() (engine/js/hacrp/history.js).
export function proofFigure(checks, { n, source }) {
  const rows = [...checks].reverse().map(({ fy, check }) => ({ label: fyLabel(fy), note: check.scored ? fill('proofNote', { scores: count(check.scored), miss: missText(check.maxError) }) : t('proofNoteNone'), diffs: check.diffs }));
  const draw = (width) => proofStrips({ rows, limit: SCORE_TOLERANCE, step: PROOF_STEP, labels: { fail: t('proofFail') }, width, format: (v) => cmsText(v === 0 ? '0' : decimal(v, 4)) });
  const { scored, miss } = checkTotals(checks);
  const takeaway = checks.length === 1
    ? fill('proofTakeawayOne', { scores: count(scored), fy: String(checks[0].fy), miss: missText(miss), limit: limitText })
    : fill('proofTakeaway', { years: yearsText(checks), scores: count(scored), miss: missText(miss), limit: limitText });
  return figure({
    n, takeaway, source, claimLevel: 'recomputed', csvName: 'hacrp-score-check', alt: t('proofAlt'),
    ...drawn(draw, METHODS_WIDE),
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
  const { decided, wrong } = checkTotals(checks);
  const takeaway = checks.length === 1
    ? fill('sidesTakeawayOne', { decided: count(decided), fy: String(checks[0].fy), wrong: count(wrong) })
    : fill('sidesTakeaway', { decided: count(decided), years: yearsText(checks), wrong: count(wrong) });
  const draw = (width) => ruleStack({ rows, width });
  const pctText = (x) => (x === null ? '' : num(decimal(x * 100, 1), x * 100));
  return figure({
    n, takeaway, source, csvName: 'hacrp-decision-check', alt: t('sidesAlt'),
    ...drawn(draw, METHODS_WIDE),
    table: {
      columns: [{ name: t('proofColYear') }, { name: t('sidesColDecided'), numeric: true }, { name: t('sidesColYes'), numeric: true }, { name: t('sidesColHighNo'), numeric: true }, { name: t('sidesColLowYes'), numeric: true }, { name: t('sidesColWrong'), numeric: true }, { name: t('sidesColPct'), numeric: true }],
      rows: checks.map(({ fy, check: c }) => [fyLabel(fy), num(count(c.decided), c.decided), num(count(c.yes), c.yes),
        c.highestNo === null ? '' : num(cmsText(decimal(c.highestNo, DP)), c.highestNo), c.lowestYes === null ? '' : num(cmsText(decimal(c.lowestYes, DP)), c.lowestYes),
        num(count(c.wrongSide.length), c.wrongSide.length), pctText(c.linePctDecided)]),
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
    ...drawn(draw, METHODS_WIDE),
    table: {
      columns: [{ name: t('periodsColFy') }, { name: fill('periodsColPsi', { short }) }, { name: t('periodsColHai') }, { name: t('periodsColPay') }],
      rows: years.map(({ fy, periods }) => [fyLabel(fy), ...[periods.psi90, periods.hai, pay(fy)].map((p) => (p ? `${longDate(p.start)} – ${longDate(p.end)}` : t('periodsNone')))]),
    },
  });
}

// An ordered list of stations, each its number, name, value and note (a phone stacks it); a station with check set (the
// self-check's, the HAC cut's) is marked. cls: more classes on the list.
const stationList = (stations, { cls = '' } = {}) => html`<ol class="pipe${cls ? ` ${cls}` : ''}" role="list">${stations.map((s, i) => html`<li class="pipe__st${s.check ? ' pipe__st--check' : ''}">
<p class="pipe__n">${String(i + 1)}</p>
<p class="pipe__name">${s.name}</p>
<p class="pipe__value">${s.value}</p>
<p class="pipe__note">${s.note}</p>
</li>`)}</ol>`;

// The pipeline: six stations, each with its real number for the newest year, as an ordered list.
export function pipeline({ rows, source, pin, measures, check, pages }) {
  return stationList([
    { name: t('pipe1'), value: fill('pipe1Value', { rows: count(rows) }), note: fillKeep('pipe1Note', { id: source.id, date: isoDate(source.pdcReleased) }, ['id', 'date']) },
    { name: t('pipe2'), value: fill('pipe2Value', { bytes: count(pin.bytes) }), note: fillKeep('pipe2Note', { algo: HASH_NAME, hash: `${pin.sha256.slice(0, 12)}…` }, ['hash']) },
    { name: t('pipe3'), value: fill('pipe3Value', { measures: String(measures) }), note: t('pipe3Note') },
    { name: t('pipe4'), value: fill('pipe4Value', { scored: count(check.scored) }), note: t('pipe4Note') },
    { name: t('pipe5'), value: fill('pipe5Value', { miss: missText(check.maxError) }), note: fill('pipe5Note', { decided: count(check.decided), wrong: count(check.wrongSide.length), limit: limitText }), check: true },
    { name: t('pipe6'), value: fill('pipe6Value', { pages: count(pages) }), note: t('pipe6Note') },
  ]);
}

// The receipts: every pinned input this site's HACRP pages read, with its size and fingerprint.
export function receipts(pins) {
  return printout(html`<table class="gb receipts">
<thead><tr><th scope="col">${t('sourcesColFile')}</th><th scope="col" class="num">${t('sourcesColBytes')}</th><th scope="col">${fill('sourcesColHash', { algo: HASH_NAME })}</th><th scope="col">${t('sourcesColGot')}</th></tr></thead>
<tbody>${pins.map((p) => html`<tr><th scope="row">${p.landingPage || p.downloadUrl ? html`<a href="${p.landingPage || p.downloadUrl}">${p.title}</a>` : p.title}</th><td class="num">${count(p.bytes)}</td><td class="receipts__hash"><code>${p.sha256.slice(0, 16)}…</code></td><td>${isoDate(p.retrieved)}</td></tr>`)}</tbody>
</table>`);
}

// The receipt: the self-check as an adding-machine tape, one line a year (its scores recomputed and largest miss, its
// decisions and how many were out of order), then the totals. Every line is a year the build checked.
export function receipt(checks) {
  const dash = t('receiptDash');
  const lines = checks.map(({ fy, check: c }) => html`<tr><th scope="row">${fyLabel(fy)}</th><td>${c.scored ? count(c.scored) : dash}</td><td>${c.scored ? missText(c.maxError) : dash}</td><td>${c.decided ? count(c.decided) : dash}</td><td class="receipt__ok">${!c.scored && !c.decided ? t('receiptNone') : c.ok ? t('receiptOk') : t('receiptFail')}</td></tr>`);
  const { scored, miss, withheld, decided, wrong } = checkTotals(checks);
  return html`<div class="receipt">
<p class="receipt__head">${t('receiptHead')}</p>
<table class="receipt__t">
<thead><tr><th scope="col">${t('receiptColFy')}</th><th scope="col">${t('receiptColScores')}</th><th scope="col">${t('receiptColMiss')}</th><th scope="col">${t('receiptColDecisions')}</th><th scope="col"><span class="vh">${t('receiptColOk')}</span></th></tr></thead>
<tbody>${lines}</tbody>
</table>
<dl class="receipt__sum">
<div><dt>${t('receiptScores')}</dt><dd>${count(scored)}</dd></div>
<div><dt>${t('receiptMiss')}</dt><dd>${missText(miss)}</dd></div>
<div><dt>${t('receiptLimit')}</dt><dd>${limitText}</dd></div>
${withheld ? html`<div><dt>${t('receiptWithheld')}</dt><dd>${count(withheld)}</dd></div>` : ''}
<div><dt>${t('receiptDecisions')}</dt><dd>${count(decided)}</dd></div>
<div><dt>${t('receiptWrong')}</dt><dd>${count(wrong)}</dd></div>
</dl>
</div>`;
}

// ---------- how this site estimates the dollars ----------

// The payment order, drawn on the year's real proportions: the national payment (the headline set's) as one bar split
// into the base and everything else, a bracket over the base for the two programs that adjust it, and one under the
// whole bar for the HAC cut, taken last. As the page's figure n.
export function dollarsOrderFigure(headline, { n, source, fy }) {
  const base = headline.base;
  const rest = headline.total - headline.base;
  const share = base / headline.total;
  const chart = html`<div class="order" style="--base: ${share.toFixed(4)}" aria-hidden="true">
<p class="order__brace order__brace--base"><span>${t('orderTwo')}</span></p>
<div class="order__bar"><p class="order__base"><span class="order__name">${t('orderBase')}</span> <span class="order__money">${money(base)}</span><span class="order__note">${t('orderBaseNote')}</span></p><p class="order__rest"><span class="order__name">${t('orderRest')}</span> <span class="order__money">${money(rest)}</span><span class="order__note">${t('orderRestNote')}</span></p></div>
<p class="order__brace order__brace--all"><span>${fill('orderHac', { pct: REDUCTION_TEXT })}</span></p>
</div>`;
  return figure({
    n, source, claimLevel: 'estimate', chart, csvName: 'hacrp-dollars-payment-order',
    takeaway: fill('orderTakeaway', { share: pct(share, 0), fy: String(fy) }),
    table: {
      columns: [{ name: t('orderColPart') }, { name: t('orderColMoney'), numeric: true }],
      rows: [[t('orderBase'), num(dollars(base), base)], [t('orderRest'), num(dollars(rest), rest)]],
    },
  });
}

// The formula as the pipeline's stations, with the year's real national numbers (the headline set's), the HAC cut's
// station set apart.
export function dollarsPipeline(headline) {
  const one = decimal(1, 0);
  return stationList([
    { name: t('dpipe1'), value: money(headline.base), note: fill('dpipe1Note', { hospitals: count(headline.hospitals) }) },
    { name: t('dpipe2'), value: money(headline.hrrp), note: fill('dpipe2Note', { one }) },
    { name: t('dpipe3'), value: money(headline.hvbp), note: fill('dpipe3Note', { one }) },
    { name: t('dpipe4'), value: money(headline.total - headline.base, { sign: true }), note: t('dpipe4Note') },
    { name: t('dpipe5'), value: money(headline.after), note: t('dpipe5Note') },
    { name: t('dpipe6'), value: money(headline.hac), note: fill('dpipe6Note', { pct: REDUCTION_TEXT, cut: count(headline.cut), yes: count(headline.yes) }), check: true },
  ], { cls: 'pipe--dollars' });
}

// The assumptions, as Thirty Day Readmissions lists its own: each choice and its effect on the estimate.
export function assumptionsTable({ fy, volumeFy }) {
  const rows = [
    ['assumeRates', 'assumeRatesE', { fy: String(fy), volume: String(volumeFy) }], ['assumeModel', 'assumeModelE'], ['assumeShare', 'assumeShareE'],
    ['assumeMdh', 'assumeMdhE', { fy: String(fy) }], ['assumeNtap', 'assumeNtapE'], ['assumeAddons', 'assumeAddonsE'], ['assumeSch', 'assumeSchE'],
    ['assumeUc', 'assumeUcE'], ['assumeUnlisted', 'assumeUnlistedE'], ['assumeMaryland', 'assumeMarylandE'], ['assumeParhm', 'assumeParhmE'],
    ['assumeFfs', 'assumeFfsE'],
  ];
  return printout(html`<table class="gb assume">
<thead><tr><th scope="col">${t('assumeColA')}</th><th scope="col">${t('assumeColE')}</th></tr></thead>
<tbody>${rows.map(([a, e, v]) => html`<tr><th scope="row">${v ? fill(a, v) : t(a)}</th><td>${t(e)}</td></tr>`)}</tbody>
</table>`);
}

// A log ratio as the percentage it moves a figure: 0.0233 reads +2.4%, -0.25 reads −22%.
const logPct = (x, dp) => pct(Math.exp(x) - 1, dp, { sign: true });

// How a dollar check's value and range read on the tape, by check.
const SHARE = { value: (v) => pct(v, 2), range: (c) => fill('dcheckRange', { low: pct(c.low, 2), high: pct(c.high, 2) }) };
const CHECK_FORMAT = {
  hrrp_share: SHARE,
  vbp_net: { value: money, range: (c) => fill('dcheckAtMost', { high: money(c.high) }) },
  hac_share: SHARE,
  hac_count: { value: count, range: (c) => fill('dcheckEqual', { high: count(c.high) }) },
  yes_unestimated: { value: count, range: (c) => fill('dcheckAtMost', { high: count(c.high) }) },
  // The back-test's median error, log(estimate ÷ cost report), read as how far the middle hospital's estimate ran
  // above (+) or below (−) its cost report.
  backtest_hac_median: { value: (v) => logPct(v, 1), range: (c) => fill('dcheckRange', { low: logPct(c.low, 0), high: logPct(c.high, 0) }) },
  backtest_hospitals: { value: count, range: (c) => fill('dcheckAtLeast', { low: count(c.low) }) },
  backtest_cut: { value: count, range: (c) => fill('dcheckAtLeast', { low: count(c.low) }) },
};

// The national checks as an adding-machine tape, in the self-check's style: each check, this build's value, the range
// it is held to, and pass or fail.
export function dollarChecks(checks) {
  return html`<div class="receipt receipt--dollars">
<p class="receipt__head">${t('dchecksHead')}</p>
<table class="receipt__t">
<thead><tr><th scope="col">${t('dcheckColCheck')}</th><th scope="col">${t('dcheckColValue')}</th><th scope="col">${t('dcheckColRange')}</th><th scope="col"><span class="vh">${t('receiptColOk')}</span></th></tr></thead>
<tbody>${checks.map((c) => {
    const f = CHECK_FORMAT[c.id];
    if (!f) throw new RangeError(`dollarChecks: no words for check "${c.id}"`);
    return html`<tr><th scope="row">${t(`dcheck_${c.id}`)}</th><td>${c.value === null ? t('receiptDash') : f.value(c.value)}</td><td>${f.range(c)}</td><td class="receipt__ok">${t(c.pass ? 'dcheckPass' : 'dcheckFail')}</td></tr>`;
  })}</tbody>
</table>
</div>`;
}

// The back-test's place: a placeholder, plainly one, until the check runs.
export const backtestPlaceholder = () => html`<div class="backtest-pending"><p>${t('backtestPending')}</p></div>`;
