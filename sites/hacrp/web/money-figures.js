// The hospital page's dollars (this site's estimate, money.js): the verdict's figure, the record card's field, the
// statement of the payment line by line, and the share control with its sentence (the page's description is a neutral
// one, copy.js hospitalDescription: a link's preview names neither the decision nor the dollars).
// Every dollar figure carries the estimate tag and its likely range, from the back-test. The money is a cliff: over
// CMS's line, CMS cuts 1% of what Medicare pays a hospital for inpatient stays; under it, this program cuts nothing.
import { SCORE_DECIMALS as DP } from '../../../engine/js/hacrp/score.js';
import { cliff } from '../../../web/charts/cliff.js';
import { PAGE, drawn, figure, num } from '../../../web/charts/figure.js';
import { cmsText, count, decimal, dollars, isoDate, listText, money, moneyRange, pct, roundedDollars } from '../../../web/render/format.js';
import { estTag as estTagShell, shareBlock as shareShell, wsOp, wsTerm } from '../../../web/render/components.js';
import { html } from '../../../web/render/html.js';
import { SITE } from '../../../web/site.js';
import { CLIFF_NEAR, REDUCTION_TEXT } from './constants.js';
import { BACKTEST_HREF, DOLLARS_HREF } from './links.js';
import { BASE_PARTS, OTHER_PARTS, hasMaTeaching, maKey } from './money.js';
import { fill, fillKeep, t } from './money/copy.js';

const FACTOR_DP = 4;

// The source line every dollar figure carries: this site's arithmetic on CMS's payment files and the HACRP file, its
// release date kept on one line. source: the HACRP dataset's manifest entry ({ id, pdcReleased }).
export const moneySourceText = ({ fy, source }) => fillKeep('stmtSource', { fy: String(fy), id: source.id, date: isoDate(source.pdcReleased) }, ['date']);
const zero = () => money(0);

// The estimate tag every dollar figure carries (Thirty Day Readmissions' outlined tag), linking to how this site
// makes the estimate.
export const estTag = () => estTagShell({ href: DOLLARS_HREF, label: t('estimateTagLabel'), text: t('estimateTag') });

// The range line under a dollar figure: the back-test's likely range ("Likely range $1.0–1.4M"), its words linking to
// where the range comes from. With `estimate`, a small drawing beside it: the range as a box and the estimate as a tick,
// on one scale from the lower of the range's low end and the estimate to the higher of its high end and the estimate.
// A range need not be centred on its estimate, nor hold it (its multipliers carry its group's median miss, and the
// national range is the estimate times the resampled ratio's percentiles), so the tick may sit anywhere on that scale.
// '' with no range: an estimate of $0 has none.
export function rangeLine(range, { estimate = null } = {}) {
  if (!range) return '';
  const [from, to] = estimate === null ? range : [Math.min(range[0], estimate), Math.max(range[1], estimate)];
  const at = (x) => ((x - from) / (to - from)).toFixed(3);
  const bar = estimate === null || to === from ? ''
    : html`<span class="money__range-bar" style="--lo: ${at(range[0])}; --hi: ${at(range[1])}; --at: ${at(estimate)}" aria-hidden="true"></span>`;
  return html`<p class="money__range"><a class="money__range-k" href="${BACKTEST_HREF}">${t('rangeLikely')}</a> <span class="money__range-v">${moneyRange(...range)}</span>${bar}</p>`;
}

// A range in a sentence on the page: "$1.0–1.4M", word joiners holding it on one line (a narrow column would break it
// after the dash). A sentence copied as text (the share sentence, a figure's table) has the plain moneyRange.
const JOIN = '\u2060';
const rangeText = (range) => moneyRange(...range).replace('–', `${JOIN}–${JOIN}`);

// The hospital's distance to CMS's line, as the verdict states it: over the highest score CMS didn't cut (a hospital
// it cut), under the lowest it cut (one it didn't). null without a score.
const distanceText = (view) => (view.distance ? cmsText(view.distance.text) : null);

// ---------- the verdict ----------

// The estimate in the verdict, in two parts. beside: the dollars next to the stamp, big, in the penalty ink for a cut
// ($0 from this program for a hospital CMS didn't cut; Maryland's $0 is the law's, not an estimate). below: under
// CMS's decision, what the dollars are (1% of the whole payment, per stay) or, quieter, what a cut would have taken,
// with the range.
export function moneyVerdict(view, m) {
  const fy = String(view.fy);
  if (m.status === 'maryland') {
    return {
      beside: html`<div class="money money--zero"><p class="money__big">${zero()}</p><p class="money__what">${t('moneyMaryland')}</p></div>`,
      below: '',
    };
  }
  if (!m.estimated) {
    return {
      beside: html`<div class="money money--none"><p class="hosp__none"><span>${t('moneyNone')}</span></p></div>`,
      below: html`<p class="money__of">${m.status === 'parhm' ? t('moneyParhm') : fill('moneyNoInputs', { fy })}</p>`,
    };
  }
  const after = money(m.after);
  if (m.cut) {
    return {
      beside: html`<div class="money money--cut"><p class="money__big">${money(m.atStake)}</p><p class="money__what">${fill('moneyCutWhat', { fy })} ${estTag()}</p></div>`,
      below: html`<div class="money__below"><p class="money__of">${fill(maKey(m, 'moneyOfWhole'), { pct: REDUCTION_TEXT, after, perStay: money(m.perStay) })}</p>
${rangeLine(m.ranges.hac, { estimate: m.atStake })}</div>`,
    };
  }
  const distance = distanceText(view);
  return {
    beside: html`<div class="money money--zero"><p class="money__big">${zero()}</p><p class="money__what">${t('moneyZeroWhat')}</p></div>`,
    below: html`<div class="money__below"><p class="money__would"><strong>${fill('moneyWouldHave', { amount: money(m.atStake) })}</strong> ${estTag()} ${fill(maKey(m, 'moneyWouldOf'), { pct: REDUCTION_TEXT, after })}${distance ? html` ${fill('moneyCliffNo', { distance, lowestYes: view.boundaryText.lowestYes })}` : ''}</p>
${rangeLine(m.ranges.hac, { estimate: m.atStake })}</div>`,
  };
}

// ---------- the cliff ----------

// The cliff for this hospital as figure n: the HAC cut its estimate would be at any score, $0 to the line and the
// whole cut past it, the hospital a dot on it. A scored, estimated hospital only.
export function cliffFigure(view, m, nat, { n, source }) {
  const { highestNo, lowestYes } = view.boundaryText;
  const hi = nat.domain[1];
  const highest = cmsText(decimal(hi, DP));
  const amount = money(m.atStake);
  const labels = {
    zero: zero(), zeroWords: fill('cliffZero', { highestNo }), cut: amount, cutWords: fill('cliffCut', { lowestYes }), line: t('barLine'),
    actual: t('barThis'), actualValue: view.score.text, highest: t('cliffHighest'), highestValue: highest,
  };
  const { strip } = nat;
  const draw = (width) => cliff({ domain: nat.domain, band: [view.boundary.highestNo, view.boundary.lowestYes], actual: view.total, strip, labels, cut: -m.atStake, width });
  const distance = distanceText(view);
  const takeaway = m.cut ? fill('cliffTakeawayYes', { distance, amount, highest }) : fill('cliffTakeawayNo', { distance, amount, highest });
  const cut = dollars(-m.atStake);
  const mine = m.cut ? cut : dollars(0);
  return figure({
    n, takeaway, ...drawn(draw, PAGE), source, claimLevel: 'estimate',
    alt: fill('cliffAlt', { zero: zero(), amount }),
    note: fill('cliffStrip', { n: count(strip.near), all: count(nat.scores.length), near: decimal(CLIFF_NEAR, 1) }),
    table: {
      columns: [{ name: t('cliffColPoint') }, { name: t('cliffColScore'), numeric: true }, { name: t('cliffColCut'), numeric: true }],
      rows: [
        [fill('cliffRowUnder', { highestNo }), num(highestNo, String(view.boundary.highestNo)), num(dollars(0), '0')],
        [fill('cliffRowOver', { lowestYes }), num(lowestYes, String(view.boundary.lowestYes)), num(cut, String(-m.atStake))],
        [t('barThis'), num(view.score.text, view.score.raw), num(mine, String(m.cut ? -m.atStake : 0))],
        [t('cliffHighest'), num(highest, String(hi)), num(cut, String(-m.atStake))],
      ],
    },
    csvName: `hacrp-cliff-${view.ccn.toLowerCase()}`,
  });
}

// ---------- the record card ----------

// The record card's dollars field (formField options), beside the score and CMS's decision.
export function moneyField(m) {
  const label = t('fieldMoney');
  if (m.status === 'maryland') return { label, value: zero(), size: 'big', note: t('fieldMoneyExempt'), fieldCls: 'f-money' };
  if (!m.estimated) {
    return { label, value: html`<span class="hosp__none"><span>${t('moneyNone')}</span></span>`, as: 'div', note: m.status === 'parhm' ? null : t('fieldMoneyNoRow'), fieldCls: 'f-money' };
  }
  // The $0 of a hospital CMS didn't cut is no estimate; what a cut would have been is.
  const value = m.cut ? html`<span class="money__field money__field--cut">${money(m.atStake)}</span> ${estTag()}` : html`<span class="money__field">${zero()}</span>`;
  const range = rangeText(m.ranges.hac);
  const note = m.cut ? fill('fieldMoneyStay', { range, perStay: money(m.perStay) }) : html`${fill('fieldMoneyWould', { amount: money(m.atStake), range })} ${estTag()}`;
  return { label, value, size: 'big', as: 'div', note, fieldCls: 'f-money' };
}

// ---------- the statement ----------

// The statement's lines, in the payment's order: what the payment is made of, the total, then the three programs (the
// readmissions and value-based adjustments to the base, the HAC cut last, as the law sets), and the net. Each line:
// { key, kind, label, sub, amount, bar }, where bar places the line on one scale (the larger of the payment before and after the two adjustments): a part as its stretch of the
// payment ({ part: [from, to] }), a sum as the whole of it, a program as the stretch it applies to ({ scope }) with
// its adjustment at the stretch's end ({ cut } or { add }). Zero parts are left out and named once (none). A sub with a
// likely range in it comes twice (rangedSub): `sub` plain, for the figure's table, and `held`, the same words with the
// range kept on one line, for the page (statementTable).
export function statementLines(m) {
  // A sub naming a likely range: the copy filled once with the plain range and once with the held one.
  const rangedSub = (key, values, range) => ({ sub: fill(key, { ...values, range: moneyRange(...range) }), held: fill(key, { ...values, range: rangeText(range) }) });
  const scale = Math.max(m.total, m.after);
  const at = (x) => x / scale;
  const lines = [];
  let from = 0;
  const part = (key) => {
    const amount = m.parts[key];
    const line = { key, kind: 'part', label: t(`stmt_${key}`), sub: key === 'fed' && !m.parts.mdhAddon ? t('stmtBaseNote') : null, amount, bar: { part: [at(from), at(from + amount)] } };
    from += amount;
    return line;
  };
  const shown = [...BASE_PARTS, ...OTHER_PARTS].filter((key) => m.parts[key] !== 0);
  for (const key of BASE_PARTS.filter((k) => shown.includes(k))) lines.push(part(key));
  if (m.parts.mdhAddon) lines.push({ key: 'base', kind: 'sum', label: t('stmtBase'), sub: t('stmtBaseNote'), amount: m.base, bar: { part: [0, at(m.base)] } });
  for (const key of OTHER_PARTS.filter((k) => shown.includes(k))) lines.push(part(key));
  lines.push({ key: 'total', kind: 'sum', label: t('stmtTotal'), sub: null, amount: m.total, bar: { part: [0, at(m.total)] } });
  const factorSub = (factor, listed, unlisted) => (listed ? fill('stmtFactor', { factor: decimal(factor, FACTOR_DP), one: decimal(1, 0) }) : t(unlisted));
  const adjust = (amount) => (amount < 0 ? { cut: [at(m.base + amount), at(m.base)] } : { add: [at(m.base), at(m.base + amount)] });
  lines.push({ key: 'hrrp', kind: 'program', label: t('stmtHrrp'), sub: factorSub(m.hrrpFactor, m.hrrpListed, 'stmtHrrpUnlisted'), amount: m.hrrp, bar: { scope: [0, at(m.base)], ...adjust(m.hrrp) } });
  lines.push({ key: 'hvbp', kind: 'program', label: t('stmtHvbp'), sub: factorSub(m.vbpFactor, m.vbpListed, 'stmtHvbpUnlisted'), amount: m.hvbp, bar: { scope: [0, at(m.base)], ...adjust(m.hvbp) } });
  lines.push({ key: 'after', kind: 'sum', label: t('stmtAfter'), sub: null, amount: m.after, bar: { part: [0, at(m.after)] } });
  lines.push({
    key: 'hac', kind: 'program', label: t('stmtHac'),
    ...(m.cut ? rangedSub('stmtHacAll', { pct: REDUCTION_TEXT }, m.ranges.hac) : { sub: fill('stmtHacNone', { pct: REDUCTION_TEXT, amount: dollars(m.atStake) }) }),
    amount: m.hac, bar: { scope: [0, at(m.after)], ...(m.cut ? { cut: [at(m.after - m.atStake), at(m.after)] } : {}) },
  });
  lines.push({ key: 'net', kind: 'net', label: t('stmtNet'), ...(m.ranges.net ? rangedSub('stmtLikely', {}, m.ranges.net) : { sub: null }), amount: m.net, bar: null });
  // Not paid: the parts left out, named once (a hospital with no teaching payments has none on Medicare Advantage
  // stays either, which goes without saying).
  const none = [...BASE_PARTS, ...OTHER_PARTS].filter((key) => !shown.includes(key) && !(key === 'imeMa' && !m.parts.ime)).map((key) => t(`stmtOff_${key}`));
  return { lines, none };
}

const frac = (x) => x.toFixed(4);
const span = (cls, [from, to]) => html`<span class="${cls}" style="--from: ${frac(from)}; --to: ${frac(to)}"></span>`;
function barCell(bar) {
  if (!bar) return html`<td class="stmt__bar" aria-hidden="true"></td>`;
  return html`<td class="stmt__bar" aria-hidden="true"><span class="stmt__track">${bar.scope ? span('stmt__scope', bar.scope) : ''}${bar.part ? span('stmt__part', bar.part) : ''}${bar.cut ? span('stmt__cut', bar.cut) : ''}${bar.add ? span('stmt__add', bar.add) : ''}</span></td>`;
}

const signedAmount = (line) => dollars(line.amount, { sign: line.kind === 'program' || line.kind === 'net' });

// The two groups' heads, before the first line of each.
const GROUP_BEFORE = { hrrp: 'stmtGroupPrograms' };

function statementTable(view, m, { lines, none }) {
  const row = (l) => html`<tr class="stmt__row stmt__row--${l.kind}${l.amount === 0 ? ' is-zero' : ''}" data-line="${l.key}">
<th scope="row"><span class="stmt__name">${l.label}</span>${l.sub ? html` <span class="stmt__sub">${l.held ?? l.sub}</span>` : ''}</th>
<td class="stmt__amt">${signedAmount(l)}</td>
${barCell(l.bar)}
</tr>`;
  const group = (key) => html`<tr class="stmt__group"><th scope="rowgroup" colspan="3">${t(key)}</th></tr>
`;
  return html`<div class="stmt">
<p class="stmt__title"><span>${fill('stmtTitle', { fy: String(view.fy) })}</span> ${estTag()}</p>
<ul class="stmt__key" role="list" aria-hidden="true"><li><span class="stmt__sw stmt__sw--part"></span>${t('stmtKeyPart')}</li><li><span class="stmt__sw stmt__sw--scope"></span>${t('stmtKeyScope')}</li><li><span class="stmt__sw stmt__sw--cut"></span>${t('stmtKeyCut')}</li></ul>
<table class="stmt__table">
<tbody>
${group(maKey(m, 'stmtGroupPay'))}${lines.map((l) => html`${GROUP_BEFORE[l.key] ? group(GROUP_BEFORE[l.key]) : ''}${row(l)}
`)}</tbody>
</table>
${none.length ? html`<p class="stmt__none">${fill('stmtNone', { list: listText(none) })}</p>` : ''}
</div>`;
}

// The cut in the hospital's own numbers, as the score's worksheet writes its sum: the payment, the two adjustments
// on the base, times the cut's percentage, equals the cut (or, for a hospital CMS didn't cut, what was at stake); then
// that over the hospital's Medicare stays.
export function moneyWorksheet(m) {
  return html`<div class="ws ws--money${m.cut ? ' ws--cut' : ''}" role="group" aria-label="${t('wsMoneyLabel')}">
<p class="ws__line"><span class="ws__paren">(</span>${hasMaTeaching(m) ? html`${wsTerm(dollars(m.total - m.parts.imeMa), t('wsPayment'))}${wsOp('+')}${wsTerm(dollars(m.parts.imeMa), t('wsMaTeaching'))}` : wsTerm(dollars(m.total), t('wsPayment'))}${wsOp(m.hrrp < 0 ? '−' : '+')}${wsTerm(dollars(Math.abs(m.hrrp)), t('wsHrrp'))}${wsOp(m.hvbp < 0 ? '−' : '+')}${wsTerm(dollars(Math.abs(m.hvbp)), t('wsHvbp'))}<span class="ws__paren">)</span><span class="ws__tail">${wsOp('×')}${wsTerm(REDUCTION_TEXT, t('wsPct'))}${wsOp('=')}${wsTerm(dollars(m.atStake), t(m.cut ? 'wsCut' : 'wsStake'), 'ws__term--total')}</span></p>
<p class="ws__line">${wsTerm(dollars(m.atStake), t(m.cut ? 'wsCut' : 'wsStake'))}${wsOp('÷')}${wsTerm(count(m.bills), t('wsStays'))}${wsOp('=')}${wsTerm(roundedDollars(m.perStay), t('wsPerStay'), 'ws__term--total')}</p>
</div>`;
}

// The statement as the page's figure n: the takeaway, the statement, and its lines as the figure's table.
export function statementFigure(view, m, { n, source, backtest }) {
  const s = statementLines(m);
  const takeaway = fill(m.cut ? 'stmtTakeawayYes' : 'stmtTakeawayNo', { pct: REDUCTION_TEXT, amount: money(m.atStake), hrrp: money(m.hrrp), hvbp: money(m.hvbp, { sign: true }) });
  return figure({
    n,
    takeaway,
    chart: statementTable(view, m, s),
    source,
    claimLevel: 'estimate',
    note: `${t('stmtWhole')} ${fill('stmtRanges', { share: pct(backtest.share, 0), fy: String(backtest.fy) })}`,
    table: {
      columns: [{ name: t('stmtColLine') }, { name: t('stmtColAmount'), numeric: true }],
      rows: s.lines.map((l) => [l.sub ? `${l.label} (${l.sub})` : l.label, num(signedAmount(l), String(l.amount))]),
    },
    csvName: `hacrp-dollars-${view.ccn.toLowerCase()}`,
  });
}

// ---------- sharing ----------

// The sentence a shared link carries, and the page's description: CMS's decision (the view's), the dollars where this
// site has an estimate (m: hospitalMoney(); named as the site's estimate, by the site's name, since
// the sentence travels without the page) and the distance to CMS's line.
export function shareSentence(view, m) {
  const values = { fy: String(view.fy), name: view.name };
  if (view.status === 'maryland') return fill('shareMaryland', { name: view.name });
  const est = m.estimated ? m : null;
  const site = SITE.name;
  const distance = distanceText(view);
  if (view.status === 'yes' || view.status === 'yes-no-score') {
    if (!est) return fill('shareYesNoEstimate', { ...values, pct: REDUCTION_TEXT });
    const amount = money(est.atStake);
    const range = moneyRange(...est.ranges.hac);
    return distance ? fill('shareYes', { ...values, pct: REDUCTION_TEXT, amount, range, site, distance }) : fill('shareYesNoScore', { ...values, pct: REDUCTION_TEXT, amount, range, site });
  }
  return est && distance ? fill('shareNo', { ...values, distance, amount: money(est.atStake), range: moneyRange(...est.ranges.hac), site }) : fill('shareNoPlain', values);
}

// The share control (components.js shareBlock) under the verdict: this page's link and its sentence.
export const shareBlock = (view, m) => shareShell({
  heading: t('shareHeading'), sentence: shareSentence(view, m), url: SITE.origin + view.path,
  copyLink: t('shareCopyLink'), copyText: t('shareCopyText'), native: t('shareNative'), note: t('shareNote'), copied: t('shareCopied'), failed: t('shareFailed'),
});
