// Part 3, how the money works: what CMS adds up and sets against the target, the worked example's ledger (round numbers,
// not a hospital: constants.js EXAMPLE), and Figure 3, the same example at any spending level (web/charts/payoff.js).
// Every line and every point is the engine's (engine/js/team/reconcile.js), so the page and the calculator agree.
import { BAND_DEFAULT } from '../../../../engine/js/team/params.js';
import { reconcile, resultAt } from '../../../../engine/js/team/reconcile.js';
import { drawn, figure, num } from '../../../../web/charts/figure.js';
import { payoff, payoffPoints } from '../../../../web/charts/payoff.js';
import { money, pct } from '../../../../web/render/format.js';
import { html } from '../../../../web/render/html.js';
import { CITES, EPISODE_DAYS, EXAMPLE, PAYOFF } from '../constants.js';
import { fill, t } from '../copy.js';
import { cited, partOf } from '../pages/parts.js';

// The example as the engine takes it: one category holding the whole year.
const INPUT = Object.freeze({ cats: [{ key: 'ALL', target: EXAMPLE.target, spend: EXAMPLE.spend, lowVolume: false }], cqs: EXAMPLE.cqs, track: EXAMPLE.track });
const signed = (x) => money(x, { sign: true });
// A spending level's label: "on target", or the share over (+) or under (−) it.
const spendLabel = (s) => (s === 0 ? t('payoffOn') : pct(s, 0, { sign: true }));

// The ledger, line by line: { op, label, note, value } for each, the last one the result.
export function ledgerLines() {
  const r = reconcile(INPUT);
  const spend = EXAMPLE.target * (1 + EXAMPLE.spend);
  const track = String(EXAMPLE.track);
  const limits = r.limits.gain === r.limits.loss ? `±${money(r.limits.gain)}` : `${signed(r.limits.gain)} / ${money(-r.limits.loss)}`;
  const limitShare = r.limits.gain / r.target;
  return [
    { op: '', label: t('ledgerTarget'), note: t('ledgerTargetNote'), value: money(r.target) },
    { op: '−', label: t('ledgerSpend'), note: fill('ledgerSpendNote', { days: String(EPISODE_DAYS) }), value: money(spend) },
    { op: '=', label: t('ledgerRaw'), note: null, value: signed(r.raw) },
    { op: '±', label: t('ledgerQuality'), note: fill('ledgerQualityNote', { cqs: String(EXAMPLE.cqs), keep: pct(r.quality / r.raw, 0), track }), value: signed(r.qadj) },
    { op: '', label: fill('ledgerLimit', { track }), note: fill('ledgerLimitNote', { limit: `±${pct(limitShare, 0)}` }), value: limits },
    { op: '=', label: t(r.result >= 0 ? 'ledgerPaid' : 'ledgerOwed'), note: null, value: signed(r.result), total: true },
  ];
}

const ledger = () => html`<section class="tm-ledger" aria-labelledby="ledger-h">
<h3 class="vh" id="ledger-h">${t('ledgerLabel')}</h3>
<ol class="tm-ledger__rows" role="list">${ledgerLines().map((l, i) => html`<li class="tm-ledger__row${l.total ? ' tm-ledger__row--total' : ''}"><span class="tm-ledger__no">${String(i + 1)}</span><span class="tm-ledger__k"><span class="tm-ledger__label">${l.op ? html`<span class="tm-ledger__op" aria-hidden="true">${l.op}</span> ` : ''}${l.label}</span>${l.note ? html`<span class="tm-ledger__note">${l.note}</span>` : ''}</span><span class="tm-ledger__v">${l.value}</span></li>`)}</ol>
<p class="tm-ledger__foot">${t('ledgerFoot')}</p>
</section>`;

function payoffFigure(n) {
  const { limits } = reconcile(INPUT);
  const at = (s) => resultAt(INPUT, s);
  const share = (v) => pct(v / EXAMPLE.target, 0, { sign: true });
  const words = {
    under: t('payoffUnder'), over: t('payoffOver'), band: fill('payoffBand', { band: `±${pct(BAND_DEFAULT, 0)}` }),
    stopGain: fill('payoffStopGain', { pct: share(limits.gain), amount: signed(limits.gain) }),
    stopLoss: fill('payoffStopLoss', { pct: share(-limits.loss), amount: signed(-limits.loss) }),
    x: spendLabel, y: signed,
    tip: (s, v) => fill('payoffTip', { s: spendLabel(s), amount: signed(v) }),
  };
  const opts = { at, limits, span: PAYOFF.span, step: PAYOFF.step, band: BAND_DEFAULT, marker: EXAMPLE.spend, words };
  return figure({
    n,
    takeaway: t('payoffTakeaway'),
    ...drawn((width) => payoff({ ...opts, width })),
    note: fill('payoffNote', { band: `±${pct(BAND_DEFAULT, 0)}` }),
    source: fill('payoffSource', { cite: CITES.limitsAll }),
    claimLevel: 'hypothetical',
    alt: fill('payoffAlt', { lo: pct(PAYOFF.span, 0), hi: pct(PAYOFF.span, 0) }),
    csvName: 'team-worked-example',
    table: {
      columns: [{ name: t('payoffColSpend') }, { name: t('payoffColResult'), numeric: true }],
      rows: payoffPoints(opts).map(({ s, result }) => [spendLabel(s), num(signed(result), result)]),
    },
  });
}

// Part 3. n: the Part's number; figureN: the page's figure counter.
export function moneyPart({ n, figureN }) {
  const words = html`${cited(fill('moneyHow', { days: String(EPISODE_DAYS) }), CITES.money)}
${cited(t('moneyStandardized'), CITES.standardized)}
${ledger()}`;
  return partOf({ id: 'money', n, heading: t('moneyHeading'), words, fig: payoffFigure(figureN()) });
}
