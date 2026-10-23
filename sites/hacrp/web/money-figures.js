// The hospital page's dollars (this site's estimate, money.js): the verdict's figure, the record card's field, the
// statement of the payment line by line, and the share control with its sentence (also the page's description).
// Every dollar figure carries the estimate tag and its range (pending until the back-test). The money is a cliff: a
// hospital over CMS's line loses 1% of everything Medicare pays it for inpatient care; one under it loses nothing.
import { SCORE_DECIMALS as DP } from '../../../engine/js/hacrp/score.js';
import { cliff } from '../../../web/charts/cliff.js';
import { drawn, figure, num } from '../../../web/charts/figure.js';
import { cmsText, count, decimal, dollars, isoDate, listText, money } from '../../../web/render/format.js';
import { html } from '../../../web/render/html.js';
import { lineScore } from '../../../web/whatif/marks.js';
import { SITE } from '../../../web/site.js';
import { CLIFF_NEAR, REDUCTION_TEXT } from './constants.js';
import { DOLLARS_HREF } from './links.js';
import { countBins, edgesAround } from './compare.js';
import { BASE_PARTS, OTHER_PARTS } from './money.js';
import { fill, fillKeep, t } from './money/copy.js';

const FACTOR_DP = 4;

// The source line every dollar figure carries: this site's arithmetic on CMS's payment files and the HACRP file, its
// release date kept on one line. source: the HACRP dataset's manifest entry ({ id, pdcReleased }).
export const moneySourceText = ({ fy, source }) => fillKeep('stmtSource', { fy: String(fy), id: source.id, date: isoDate(source.pdcReleased) }, ['date']);
const zero = () => money(0);

// The estimate tag every dollar figure carries (Thirty Day Readmissions' outlined tag), linking to how this site
// makes the estimate.
export const estTag = () => html`<a class="est-tag" href="${DOLLARS_HREF}" aria-label="${t('estTagLabel')}">${t('estTag')}</a>`;

// The range line under a dollar figure: the back-test's likely range, or, until it arrives, a placeholder made to be
// seen in review (a production build refuses it: generate.js).
export function rangeLine(m) {
  if (m.range !== null) throw new RangeError('rangeLine: ranges are not drawn yet');
  return html`<p class="money__range money__range--pending">${t('rangePending')}</p>`;
}

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
      beside: html`<div class="money money--none"><p class="money__none"><span>${t('moneyNone')}</span></p></div>`,
      below: html`<p class="money__of">${m.status === 'parhm' ? t('moneyParhm') : fill('moneyNoInputs', { fy })}</p>`,
    };
  }
  const after = money(m.after);
  if (m.cut) {
    return {
      beside: html`<div class="money money--cut"><p class="money__big">${money(m.atStake)}</p><p class="money__what">${fill('moneyCutWhat', { fy })} ${estTag()}</p></div>`,
      below: html`<div class="money__below"><p class="money__of">${fill('moneyOfWhole', { pct: REDUCTION_TEXT, after, perStay: money(m.perStay) })}</p>
${rangeLine(m)}</div>`,
    };
  }
  const distance = distanceText(view);
  return {
    beside: html`<div class="money money--zero"><p class="money__big">${zero()}</p><p class="money__what">${t('moneyZeroWhat')}</p></div>`,
    below: html`<div class="money__below"><p class="money__would"><strong>${fill('moneyWouldHave', { amount: money(m.atStake) })}</strong> ${estTag()} ${fill('moneyWouldOf', { pct: REDUCTION_TEXT, after })}${distance ? html` ${fill('moneyCliffNo', { distance, lowestYes: view.boundaryText.lowestYes })}` : ''}</p>
${rangeLine(m)}</div>`,
  };
}

// ---------- the cliff ----------

// Every published score, binned finely for the cliff's strip, once per build; the cliff's wide drawing, about the
// page's width.
const STRIP_BINS = 120;
const CLIFF_DRAWN = 1040;
const STRIPS = new WeakMap();
// near: how many scored within CLIFF_NEAR of CMS's line, either side (the strip's note).
function stripOf(nat, boundary) {
  if (!STRIPS.has(nat)) {
    const edges = edgesAround(nat.domain[0], nat.domain[1], boundary.lowestYes, STRIP_BINS);
    const line = lineScore(boundary);
    STRIPS.set(nat, { edges, counts: countBins(nat.scores, edges), near: nat.scores.filter((x) => Math.abs(x - line) <= CLIFF_NEAR).length });
  }
  return STRIPS.get(nat);
}

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
  const values = { zero: 0, cut: -m.atStake };
  const strip = stripOf(nat, view.boundary);
  const draw = (width) => cliff({ domain: nat.domain, band: [view.boundary.highestNo, view.boundary.lowestYes], actual: view.total, strip, labels, values, width });
  const distance = distanceText(view);
  const takeaway = m.cut ? fill('cliffTakeawayYes', { distance, amount, highest }) : fill('cliffTakeawayNo', { distance, amount, highest });
  const cut = dollars(-m.atStake);
  const mine = m.cut ? cut : dollars(0);
  return figure({
    n, takeaway, ...drawn(draw, CLIFF_DRAWN), source, claimLevel: 'estimate',
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
  const note = m.cut ? fill('fieldMoneyStay', { perStay: money(m.perStay) }) : html`${fill('fieldMoneyWould', { amount: money(m.atStake) })} ${estTag()}`;
  return { label, value, size: 'big', as: 'div', note, fieldCls: 'f-money' };
}

// ---------- the statement ----------

// The statement's lines, in the payment's order: what the payment is made of, the total, then the three programs in
// the order the law applies them, and the net. Each line: { key, kind, label, sub, amount, bar }, where bar places the
// line on one scale (the larger of the payment before and after the two adjustments): a part as its stretch of the
// payment ({ part: [from, to] }), a sum as the whole of it, a program as the stretch it applies to ({ scope }) with
// its adjustment at the stretch's end ({ cut } or { add }). Zero parts are left out and named once (none).
export function statementLines(m) {
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
    sub: m.cut ? fill('stmtHacAll', { pct: REDUCTION_TEXT }) : fill('stmtHacNone', { pct: REDUCTION_TEXT, amount: dollars(m.atStake) }),
    amount: m.hac, bar: { scope: [0, at(m.after)], ...(m.cut ? { cut: [at(m.after - m.atStake), at(m.after)] } : {}) },
  });
  lines.push({ key: 'net', kind: 'net', label: t('stmtNet'), sub: null, amount: m.net, bar: null });
  const none = [...BASE_PARTS, ...OTHER_PARTS].filter((key) => !shown.includes(key)).map((key) => t(`stmtOff_${key}`));
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
<th scope="row"><span class="stmt__name">${l.label}</span>${l.sub ? html` <span class="stmt__sub">${l.sub}</span>` : ''}</th>
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
${group('stmtGroupPay')}${lines.map((l) => html`${GROUP_BEFORE[l.key] ? group(GROUP_BEFORE[l.key]) : ''}${row(l)}
`)}</tbody>
</table>
${none.length ? html`<p class="stmt__none">${fill('stmtNone', { list: listText(none) })}</p>` : ''}
${rangeLine(m)}
</div>`;
}

// The cut in the hospital's own numbers, as the score's worksheet writes its sum: the payment, the two adjustments
// on the base, times the cut's percentage, equals the cut (or, for a hospital CMS didn't cut, what was at stake); then
// that over the hospital's Medicare stays.
export function moneyWorksheet(m) {
  const term = (value, key, cls = '') => html`<span class="ws__term${cls}"><span class="ws__v">${value}</span><span class="ws__k">${t(key)}</span></span>`;
  const op = (x) => html`<span class="ws__op">${x}</span>`;
  return html`<div class="ws ws--money${m.cut ? ' ws--cut' : ''}" role="group" aria-label="${t('wsMoneyLabel')}">
<p class="ws__line"><span class="ws__paren">(</span>${term(dollars(m.total), 'wsPayment')}${op(m.hrrp < 0 ? '−' : '+')}${term(dollars(Math.abs(m.hrrp)), 'wsHrrp')}${op(m.hvbp < 0 ? '−' : '+')}${term(dollars(Math.abs(m.hvbp)), 'wsHvbp')}<span class="ws__paren">)</span><span class="ws__tail">${op('×')}${term(REDUCTION_TEXT, 'wsPct')}${op('=')}${term(dollars(m.atStake), m.cut ? 'wsCut' : 'wsStake', ' ws__term--total')}</span></p>
<p class="ws__line">${term(dollars(m.atStake), m.cut ? 'wsCut' : 'wsStake')}${op('÷')}${term(count(m.bills), 'wsStays')}${op('=')}${term(dollars(Math.round(m.perStay)), 'wsPerStay', ' ws__term--total')}</p>
</div>`;
}

// The statement as the page's figure n: the takeaway, the statement, and its lines as the figure's table.
export function statementFigure(view, m, { n, source }) {
  const s = statementLines(m);
  const values = { pct: REDUCTION_TEXT, amount: money(m.atStake), hrrp: money(m.hrrp), hvbp: money(m.hvbp) };
  if (values.hvbp !== '$0' && m.hvbp > 0) values.hvbp = `+${values.hvbp}`;
  const takeaway = fill(m.cut ? 'stmtTakeawayYes' : 'stmtTakeawayNo', values);
  return figure({
    n,
    takeaway,
    chart: statementTable(view, m, s),
    source,
    claimLevel: 'estimate',
    note: t('stmtWhole'),
    table: {
      columns: [{ name: t('stmtColLine') }, { name: t('stmtColAmount'), numeric: true }],
      rows: s.lines.map((l) => [l.sub ? `${l.label} (${l.sub})` : l.label, num(signedAmount(l), String(l.amount))]),
    },
    csvName: `hacrp-dollars-${view.ccn.toLowerCase()}`,
  });
}

// ---------- sharing ----------

// The sentence a shared link carries, and the page's description: CMS's decision (the view's), the dollars where this
// site has an estimate (m: hospitalMoney(), or null for none; named as the site's estimate, by the site's name, since
// the sentence travels without the page) and the distance to CMS's line.
export function shareSentence(view, m) {
  const values = { fy: String(view.fy), name: view.name };
  if (view.status === 'maryland') return fill('shareMaryland', { name: view.name });
  const est = m?.estimated ? m : null;
  const site = SITE.name;
  const distance = distanceText(view);
  if (view.status === 'yes' || view.status === 'yes-no-score') {
    if (!est) return fill('shareYesNoEstimate', { ...values, pct: REDUCTION_TEXT });
    const amount = money(est.atStake);
    return distance ? fill('shareYes', { ...values, pct: REDUCTION_TEXT, amount, site, distance }) : fill('shareYesNoScore', { ...values, pct: REDUCTION_TEXT, amount, site });
  }
  return est && distance ? fill('shareNo', { ...values, distance, amount: money(est.atStake), site }) : fill('shareNoPlain', values);
}

// The share control: the link and the sentence, readable and selectable without JavaScript (a disclosure);
// client/share.js adds the copy buttons and, where the device has one, its own share sheet. No third-party script.
export function shareBlock(view, m) {
  const url = SITE.origin + view.path;
  const sentence = shareSentence(view, m);
  return html`<details class="share" data-share data-copied="${t('shareCopied')}" data-failed="${t('shareFailed')}">
<summary class="share__summary">${t('shareHeading')}</summary>
<div class="share__body">
<p class="share__text" data-share-text>${sentence} <span class="share__url" data-share-url>${url}</span></p>
<p class="share__row"><button type="button" class="fig__btn" data-share-copy="link" hidden>${t('shareCopyLink')}</button> <button type="button" class="fig__btn" data-share-copy="text" hidden>${t('shareCopyText')}</button> <button type="button" class="fig__btn" data-share-native hidden>${t('shareNative')}</button> <span class="small" data-share-status role="status"></span></p>
<p class="small muted">${t('shareNote')}</p>
</div>
</details>`;
}
