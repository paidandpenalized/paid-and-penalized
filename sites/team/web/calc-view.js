// Part 5's calculator, rev. 3: the view of one hospital's 2027 reconciliation and its markup, shared by the build (which
// draws the rule-picked default hospital) and the browser (client/calc.js, which redraws it as the reader types). Pure: a
// hospital (web/team/calc-data.js hospOf), the reader's state and the file's meta in; plain data and the kit's escaped markup out.
// Every dollar is the engine's (engine/js/team/: reconcile, bandOf, solveSpend, marginal, compositeQuality); the view
// only gathers the inputs, formats and words them.
//
// The state: { ccn, track (1|2|3), s (the "all five" spending, percent: 5 is 5% over target), sk { CAT: percent } (a row's
// own spending, overriding s for that row), band (percent either side of target), ov { n: { CAT }, p: { CAT } } (episodes
// and average target prices the reader typed), lv { CAT: bool } (a low-volume box the reader set), q { measure: percentile }
// (a quality percentile the reader typed), mine (a Set of the keys of the reader's own numbers, typed or carried by a
// link, each "your number": n, p, q and lv; a row's spending is a scenario input like the slider, never one), moved (whether the reader has set any spending: "What would it take?" then prices quality at the scenario),
// earn, owe (the amounts "What would it take?" solves for; null: the band's ends) }. s, sk and band are percents, as the
// share link (client/share.js) carries them.
//
// The markup marks every part that changes: data-v="key" on an element whose text and attributes follow the state, and
// data-in="key" on each input (the browser sets its value, unless the reader is typing in it). The figure (data-v="fig")
// is the costly part, so the browser redraws it once per frame.
import { BAND_DEFAULT, LOW_VOLUME, MEASURES, MISSING_QUALITY, QUALITY_STEP, SOLVE_SPAN, TRACKS } from '../../../engine/js/team/params.js';
import { bandOf, marginal, reconcile, resultAt, snap, solveSpend } from '../../../engine/js/team/reconcile.js';
import { payoff } from '../../../web/charts/payoff.js';
import { WIDTH } from '../../../web/charts/svg.js';
import { count, isoDate, money, moneyShown, moneyTick, pct, placeText, roundedDollars, spelled } from '../../../web/render/format.js';
import { Safe, html } from '../../../web/render/html.js';
import { flagsNote } from '../../../web/team/copy.js';
import { engineInput, inputsOf } from '../../../web/team/opening.js';
import { CALC, PAYOFF, PY2_START, TRACK1_LAST, yearOf } from './constants.js';
import { fill, t } from './calc-copy.js';
import { tight } from './tight.js';

const MEASURE_KEYS = Object.keys(MEASURES);
const TRACK_NUMBERS = Object.keys(TRACKS).map(Number);
const signed = (x) => money(x, { sign: true });
// A percent the reader set (5 is 5%), at one decimal only when it has one: "0%", "+2.5%", "−3%".
const pctOf = (p, { sign = true } = {}) => pct(p / 100, Number.isInteger(Math.round(p * 10) / 10) ? 0 : 1, { sign });
// A share as "4.5%", unsigned (the solver's answers say under or over in words).
const shareOf = (s) => pct(Math.abs(s), 1);
const bandText = (p) => `±${pctOf(p, { sign: false })}`;
// The composite quality score at one decimal, a whole score without its ".0".
const scoreText = (x) => String(Math.round(x * 10) / 10);

// A source tag's words and whether it is the reader's own.
const src = (mine, words) => ({ mine, text: mine ? t('srcMine') : words });

// The note under the track control: Track 1's eligibility when it is chosen, and the hospital's public Track 2 flags (or,
// on Track 2 with none, who Track 2 is open to). Track 1 and 2 stay selectable: the reader's scenario, not advice.
function noteOf(hosp, track) {
  const parts = [];
  const [ta, tb] = TRACK_NUMBERS.map(String);
  if (track === 1) parts.push(fill('noteTrack1', { ta, year: yearOf(TRACK1_LAST) }));
  if (hosp.flags.length) {
    parts.push(flagsNote(hosp.flags, tb));
  } else if (track === 2) {
    parts.push(fill('noteTrack2', { tb }));
  }
  return parts.join(' ');
}

// An answer's lead figure, to set in bold: the value as the text has it, and with its next word too (a share "under" or
// "over" target) when withWord. null when the text doesn't hold the value.
function leadOf(text, value, withWord = false) {
  const at = text.indexOf(value);
  if (at < 0) return null;
  return withWord ? /^\S+\s\S+/.exec(text.slice(at))?.[0] ?? value : value;
}

// "What would it take?": each row's words, and each answer's lead figures (leads). input: the engine's; limits:
// reconcile's; band: bandOf's.
function wwitOf({ input, inputs, state, r, band }) {
  const { track } = state;
  const canLose = TRACKS[track].loss > 0;
  const n = String(track);
  const target = r.target;
  const per = (s) => money((Math.abs(s) * target) / inputs.episodes);
  const solve = (result) => solveSpend({ ...input, result });
  const mostOwed = -resultAt(input, SOLVE_SPAN);
  const earn = state.earn ?? Math.max(0, moneyShown(band.high));
  const owe = state.owe ?? Math.max(0, moneyShown(-band.low));
  const none = target === 0;
  const need = t('wwNeed');

  const sEarn = none ? null : solve(earn);
  const earnText = none ? need : sEarn === null ? fill('wwNoGain', { n, amount: signed(r.limits.gain) }) : fill('wwUnder', { pct: shareOf(sEarn), per: per(sEarn) });
  const leads = { earn: sEarn === null || none ? [] : [leadOf(earnText, shareOf(sEarn), true)] };
  let oweText = need;
  leads.owe = [];
  if (!canLose) oweText = fill('wwNever', { n });
  else if (!none) {
    // Past the most it could owe (the stop-loss, or less where low-volume types can't add to a repayment), any spending
    // keeps it within the ask.
    const s = mostOwed <= owe ? null : solve(-owe);
    if (s !== null) {
      oweText = fill('wwOver', { pct: shareOf(s), per: per(s) });
      leads.owe = [leadOf(oweText, shareOf(s), true)];
    }
    else if (owe >= r.limits.loss) oweText = fill('wwAnyStop', { n, amount: money(-r.limits.loss) });
    else oweText = fill('wwAnyLow', { amount: money(-mostOwed) });
  }
  const sGain = none ? null : solve(r.limits.gain);
  const gainText = none ? need : sGain === null ? fill('wwNoGain', { n, amount: signed(r.limits.gain) }) : fill('wwGainAt', { pct: shareOf(sGain), amount: signed(r.limits.gain) });
  leads.gain = sGain === null || none ? [] : [leadOf(gainText, shareOf(sGain), true)];
  let lossText = need;
  leads.loss = [];
  if (!canLose) lossText = fill('wwNever', { n });
  else if (!none) {
    const s = solve(-r.limits.loss);
    lossText = s === null ? fill('wwLossNot', { amount: money(-mostOwed) }) : fill('wwLossAt', { pct: shareOf(s), amount: money(-r.limits.loss) });
    if (s !== null) leads.loss = [leadOf(lossText, shareOf(s), true)];
  }

  // Ten more points (to 100 at most): marginal's, at the reader's scenario once they have set any spending, else at the
  // engine's reference (BAND_DEFAULT over target; under it on Track 1, which can't lose). When it is $0, say why.
  const m = marginal(input, state.moved);
  const top = inputs.cqs + QUALITY_STEP > 100;
  const quality = { label: top ? fill('wwQualityTop', { top: '100' }) : fill('wwQuality', { n: String(QUALITY_STEP) }) };
  const amount = signed(m.per10Quality);
  if (none) quality.text = need;
  else if (m.per10Quality !== 0) {
    const at = pct(BAND_DEFAULT, 0);
    quality.text = state.moved ? fill('wwQHere', { amount }) : fill(canLose ? 'wwQOver' : 'wwQUnder', { amount, pct: at });
  } else {
    const reference = state.moved ? input : { ...input, cats: input.cats.map((c) => ({ ...c, spend: canLose ? BAND_DEFAULT : -BAND_DEFAULT })) };
    const ref = reconcile(reference);
    // The amount before Track 1's floor, and whether any spending is over target: a $0 here is not "on target" when the
    // spending is over it and either the track has no repayment or low-volume types hold the repayment at zero.
    const before = reference.cats.reduce((sum, c) => sum + (c.lowVolume ? Math.max(0, -c.spend * c.target) : -c.spend * c.target), 0);
    const over = reference.cats.some((c) => c.spend > 0 && c.target > 0);
    if (inputs.cqs >= 100) quality.text = fill('wwQTop', { amount });
    else if (ref.capped) quality.text = fill('wwQCapped', { amount, n });
    else if (!canLose && snap(before) < 0) quality.text = fill('wwQNoRepay', { amount, n });
    else if (over && snap(before) === 0) quality.text = fill('wwQLowVolume', { amount });
    else quality.text = fill('wwQOnTarget', { amount });
  }
  const [under, over] = [signed(m.perPctUnder), signed(-m.perPctOver)];
  const perPct = none ? need : fill('wwPctValue', { under, over });
  leads.pct = none ? [] : [leadOf(perPct, under), leadOf(perPct, over)];
  leads.q = none ? [] : [leadOf(quality.text, amount)];
  return {
    tag: fill('wwTag', { cqs: scoreText(inputs.cqs) }),
    earn: { value: money(earn), text: earnText },
    owe: { value: money(owe), text: oweText, canLose },
    gain: gainText,
    loss: lossText,
    perPct,
    quality,
    // Each answer's lead figures, in the order its text has them (wwitMarkup sets them in bold).
    leads: Object.fromEntries(Object.entries(leads).map(([k, v]) => [k, v.filter(Boolean)])),
  };
}

// The payoff figure's two drawings (the phone's and the column's), the engine's result at each spending level.
function figureOf({ input, r, state }) {
  const at = (s) => resultAt(input, s);
  const { gain, loss } = TRACKS[state.track];
  const words = {
    // The band goes unnamed in the drawing (its note names it): at this width its name would cross the stop-gain's.
    under: t('payoffUnder'), over: t('payoffOver'), band: '',
    stopGain: fill('payoffStopGain', { pct: pct(gain, 0, { sign: true }), amount: signed(r.limits.gain) }),
    stopLoss: fill('payoffStopLoss', { pct: pct(-loss, 0), amount: signed(-r.limits.loss) }),
    x: (s) => (s === 0 ? t('payoffOn') : pct(s, 0, { sign: true })), y: moneyTick,
    tip: (s, v) => fill('payoffTip', { s: s === 0 ? t('payoffOn') : pct(s, 0, { sign: true }), amount: signed(v) }),
  };
  const alt = fill('figAlt', { lo: pct(PAYOFF.span, 0), hi: pct(PAYOFF.span, 0), n: String(state.track) });
  const draw = (width, fit) => {
    const svg = payoff({ at, limits: r.limits, span: PAYOFF.span, step: PAYOFF.step, band: state.band / 100, marker: null, words, width });
    return new Safe(html`<svg role="img" aria-label="${alt}" data-fit="${fit}" `.text + svg.text.slice('<svg '.length));
  };
  return html`${draw(WIDTH, 'narrow')}
${draw(CALC.figWide, 'wide')}`;
}

// "Copy for a slide" (the what-if standard's): the view as plain text, one fact a line: the hospital, its track and limits,
// the band's range, this scenario's result and its spending, "Hypothetical · standardized dollars" (and "includes your
// numbers" once the reader's own numbers are in it), and the sources with their dates. Words from the copy, numbers from
// the view; what the reader typed shows only as the result already holds it.
function slideOf(v, { state, sources }) {
  const [from, to] = [sources.years[0], sources.years[sources.years.length - 1]].map(String);
  const spend = Object.keys(state.sk).length ? t('slideRows') : v.ledger.s.valuetext;
  return [
    fill('slideHosp', { name: v.hosp.name, where: v.hosp.where }),
    fill('slideTrack', { year: yearOf(PY2_START), track: fill('trackName', { n: String(state.track) }), limits: v.ledger.limits }),
    v.result.none ? t('outNone') : fill('slideRange', { band: v.result.label, range: v.result.range }),
    fill('slideResult', { spend, result: v.ledger.result }),
    v.tags.mine ? fill('slideHypMine', { hyp: t('slideHyp'), mine: t('tagMine') }) : t('slideHyp'),
    fill('slideSource', { list: isoDate(sources.list), prices: isoDate(sources.prices), from, to, quality: isoDate(sources.quality) }),
  ].join('\n');
}

/**
 * The view: plain data for every part of the calculator, plus the payoff's markup and the text for a slide as functions
 * (drawn only when wanted).
 * @param {{hosp: object, state: object, team: {dataYear: number, derived: string[], sources: object}}} args hosp: hospOf's;
 *   team: calcMeta's
 */
export function calcView({ hosp, state, team }) {
  const inputs = inputsOf(hosp, state);
  const input = engineInput(inputs);
  const r = reconcile(input);
  const band = bandOf({ ...input, width: state.band / 100 });
  const none = r.target === 0;
  const mine = state.mine.size > 0;
  const { track } = state;
  const limits = TRACKS[track].loss > 0 ? fill('limitsBoth', { loss: money(-r.limits.loss), gain: signed(r.limits.gain) }) : fill('limitsUp', { gain: signed(r.limits.gain) });
  const year = yearOf(PY2_START);
  const derived = new Set(team.derived);

  const rows = inputs.cats.map((c) => {
    const pub = hosp.cats[c.key];
    const notes = [];
    if (pub.hidden) notes.push(pub.hidden === 1 ? t('hiddenCellsOne') : fill('hiddenCells', { n: count(pub.hidden) }));
    if (c.key === 'LEJR' || c.key === 'SPINAL') notes.push(t('inpatientOnly'));
    const raw = -c.spend * c.target;
    const name = t(`cat${c.key}`);
    return {
      key: c.key, short: t(`row${c.key}`), name, notes: notes.join(' · '),
      n: { value: count(c.n), label: fill('lblEpisodes', { cat: name }), ...src(state.mine.has(`n.${c.key}`), fill('srcEpisodes', { year: String(team.dataYear) })) },
      p: { value: roundedDollars(c.price), label: fill('lblPrice', { cat: name }), ...src(state.mine.has(`p.${c.key}`), pub.n === 0 && derived.has(c.key) ? t('srcPriceMean') : fill('srcPrice', { year })) },
      // A row's own spending is a scenario input, as the slider is: said as "this row", never "your number".
      s: { value: pctOf(c.spend * 100), label: fill('lblSpend', { cat: name }), own: c.key in state.sk, mine: false, text: t(c.key in state.sk ? 'srcThisRow' : 'srcAllFive') },
      lv: { checked: c.lowVolume, mine: state.mine.has(`lv.${c.key}`), label: fill('lblLv', { cat: name, lv: String(LOW_VOLUME) }) },
      target: money(c.target),
      result: signed(snap(c.lowVolume ? Math.max(0, raw) : raw)),
    };
  });

  const side = state.s > 0 ? t('l2Over') : state.s < 0 ? t('l2Under') : t('l2On');
  const ledger = {
    target: money(r.target),
    s: { value: state.s, text: pctOf(state.s), valuetext: state.s === 0 ? side : fill('l2Value', { pct: pctOf(Math.abs(state.s), { sign: false }), side }) },
    raw: signed(r.raw), cqs: scoreText(inputs.cqs), qadj: signed(r.qadj), limitsLabel: fill('l6', { n: String(track) }), limits,
    post: money(r.postEpisode), result: signed(r.result), capped: r.capped !== null,
  };

  const quality = {
    summary: fill('qSummary', { cqs: scoreText(inputs.cqs), n: spelled(MEASURE_KEYS.length), year }),
    cqs: inputs.cqs,
    rows: MEASURE_KEYS.map((m) => {
      const pub = MEASURES[m].public ? hosp.quality[m] : null;
      const own = state.mine.has(`q.${m}`);
      const name = t(`q_${m}`);
      const words = pub ? t('srcCare') : fill(MEASURES[m].public ? 'srcNoValue' : 'srcNotPublic', { n: String(MISSING_QUALITY) });
      return {
        key: m, name, note: t(MEASURES[m].appliesTo === 'lejr' ? 'qLejr' : 'qInpatient'), value: pub ? String(pub.value) : '—',
        pct: { value: String(inputs.pcts[m] ?? MISSING_QUALITY), label: fill('lblPct', { measure: name, lo: '0', hi: '100' }), ...src(own, words) },
        weight: pct(inputs.weights[m], 0),
      };
    }),
  };

  const range = fill('outRange', { lo: signed(band.low), hi: signed(band.high) });
  const result = {
    label: fill('outBand', { band: bandText(state.band) }), range, none,
    at: fill('outAt', { result: signed(r.result), n: String(track), limits }),
    say: none ? t('sayNone') : fill('say', { band: bandText(state.band), lo: signed(band.low), hi: signed(band.high), result: signed(r.result) }),
  };

  const view = {
    hosp: {
      ccn: hosp.ccn, division: hosp.division,
      name: hosp.name ?? fill('calcNameNone', { ccn: hosp.ccn }),
      where: hosp.state ? fill('calcWhere', { ccn: hosp.ccn, place: placeText(hosp) }) : fill('calcWhereNone', { ccn: hosp.ccn }),
    },
    tracks: TRACK_NUMBERS.map((k) => ({ n: k, checked: k === track, name: fill('trackName', { n: String(k) }), sub: TRACKS[k].loss === 0 ? t('trackUp') : fill('trackBoth', { pct: pct(TRACKS[k].gain, 0) }) })),
    note: noteOf(hosp, track),
    rows, ledger, result, quality, dataYear: team.dataYear,
    band: { value: pctOf(state.band, { sign: false }).replace('%', ''), text: bandText(state.band) },
    wwit: wwitOf({ input, inputs, state, r, band }),
    tags: { mine, text: mine ? t('tagMine') : t('tagPublic') },
    fig: () => figureOf({ input, r, state }),
    slide: () => slideOf(view, { state, sources: team.sources }),
  };
  return view;
}

// ---------- the markup ----------

const tag = (key, { mine, text }) => html`<span class="tc-src${mine ? ' tc-src--mine' : ''}" data-v="${key}">${text}</span>`;
const vh = (id, text) => html`<label class="vh" for="${id}">${text}</label>`;
// A box the reader types a number into (every one: the table's, the band's, "What would it take?"'s).
const textIn = ({ id, key, value, mode = 'decimal', cls = '' }) => html`<input class="tc-in${cls}" id="${id}" data-in="${key}" type="text" inputmode="${mode}" autocomplete="off" spellcheck="false" value="${value}">`;
const box = ({ mine, label, cls = '', ...rest }) => html`${vh(rest.id, label)}${textIn({ ...rest, cls: `${cls}${mine ? ' is-mine' : ''}` })}`;
const scenTag = (tags) => html`<span class="tc-tag${tags.mine ? ' tc-tag--mine' : ''}" data-v="tag">${tags.text}</span>`;

// A column's name over its box, shown only where the table's head is hidden (a phone: styles.css), so each box keeps its
// column's meaning there. Hidden from screen readers: each box's own label already names it.
const colLabel = (text, cls = '') => html`<span class="tc-cl${cls}" aria-hidden="true">${text}</span>`;

function rowMarkup(row) {
  const k = row.key;
  return html`<tr><th scope="row"><abbr title="${row.name}">${row.short}</abbr>${row.notes ? html`<small class="tc-note-row">${row.notes}</small>` : ''}</th>
<td>${colLabel(t('colYear'))}${box({ id: `tc-n-${k}`, key: `n.${k}`, value: row.n.value, mine: row.n.mine, label: row.n.label, mode: 'numeric' })}${tag(`src.n.${k}`, row.n)}</td>
<td>${colLabel(t('colPrice'))}${box({ id: `tc-p-${k}`, key: `p.${k}`, value: row.p.value, mine: row.p.mine, label: row.p.label, cls: ' tc-in--p' })}${tag(`src.p.${k}`, row.p)}</td>
<td>${colLabel(t('colSpend'))}${box({ id: `tc-s-${k}`, key: `sk.${k}`, value: row.s.value, mine: false, label: row.s.label, cls: row.s.own ? ' is-own' : '' })}${tag(`src.s.${k}`, row.s)}</td>
<td class="tc-lvc">${vh(`tc-lv-${k}`, row.lv.label)}<input type="checkbox" id="tc-lv-${k}" data-in="lv.${k}"${row.lv.checked ? html` checked` : ''}${row.lv.mine ? html` class="is-mine"` : ''}>${colLabel(fill('colLvPhone', { lv: String(LOW_VOLUME) }), ' tc-cl--lv')}</td>
<td class="num">${colLabel(`${t('colTarget')} `, ' tc-cl--in')}<span data-v="target.${k}">${row.target}</span></td>
<td class="num">${colLabel(`· ${t('colResultPhone')} `, ' tc-cl--in')}<small class="tc-row-res" data-v="result.${k}">${row.result}</small></td></tr>`;
}

const line = (no, label, value, { op = '', key, cls = '', extra = '' } = {}) => html`<li class="tc-line${cls}"><span class="tc-no">${String(no)}</span><span class="tc-k">${op ? html`<span class="tc-op" aria-hidden="true">${op}</span> ` : ''}${label}</span>${extra}<b class="tc-v" data-v="${key}">${value}</b></li>`;

function ledgerMarkup(v) {
  const l = v.ledger;
  const slider = html`<input class="tc-range" type="range" id="tc-s" data-in="s" min="${String(-CALC.slider)}" max="${String(CALC.slider)}" step="${String(CALC.sliderStep)}" value="${String(l.s.value)}" aria-valuetext="${l.s.valuetext}">`;
  return html`<h3 class="vh" id="tc-ledger-h">${t('ledgerCalc')}</h3>
<ol class="tc-lines" role="list" aria-labelledby="tc-ledger-h">
${line(1, t('l1'), l.target, { key: 'l.target' })}
<li class="tc-line tc-line--s"><span class="tc-no">2</span><label class="tc-k" for="tc-s">${t('l2')}</label>${slider}<b class="tc-v" data-v="l.s">${l.s.text}</b></li>
${line(3, t('l3'), l.raw, { op: '=', key: 'l.raw' })}
${line(4, html`${t('l4')} <button type="button" class="tc-open" aria-controls="tc-q" data-calc-open hidden>${t('l4Open')}</button>`, l.cqs, { key: 'l.cqs' })}
${line(5, t('l5'), l.qadj, { op: '±', key: 'l.qadj' })}
${line(6, html`<span data-v="l.limitsLabel">${l.limitsLabel}</span>`, l.limits, { key: 'l.limits' })}
${line(7, html`${t('l7')} <span class="tc-src">${t('l7Tag')}</span>`, l.post, { op: '−', key: 'l.post' })}
${line(8, html`${t('l8')} <span class="tc-src" data-v="l.capped"${l.capped ? '' : html` hidden`}>${t('atLimit')}</span>`, l.result, { op: '=', key: 'l.result', cls: ' tc-line--res' })}
</ol>
<p class="tc-foot">${t('ledgerCalcFoot')}</p>`;
}

function qualityMarkup(v, statics) {
  const q = v.quality;
  return html`<details class="tc-more tc-q" id="tc-q"><summary data-v="q.summary">${q.summary}</summary>
<div class="tc-scroll"><table class="tc-qt">
<thead><tr><th scope="col">${t('qColMeasure')}</th><th scope="col" class="num">${t('qColValue')}</th><th scope="col">${t('qColPct')}</th><th scope="col" class="num">${t('qColWeight')}</th></tr></thead>
<tbody>${q.rows.map((m) => html`<tr><th scope="row">${m.name}<small class="tc-note-row">${m.note}</small></th><td class="num">${m.value}</td>
<td>${box({ id: `tc-q-${m.key}`, key: `q.${m.key}`, value: m.pct.value, mine: m.pct.mine, label: m.pct.label, cls: ' tc-in--q' })}${tag(`src.q.${m.key}`, m.pct)}</td><td class="num" data-v="w.${m.key}">${m.weight}</td></tr>`)}</tbody>
</table></div>
${staticBox('qFoot', statics)}
</details>`;
}

function resultMarkup(v, statics) {
  const r = v.result;
  return html`<div class="tc-out">
<p class="tc-out__lab"><span data-v="out.label">${r.label}</span> ${scenTag(v.tags)}</p>
<p class="tc-out__v"><span data-v="out.range">${tight(r.range)}</span> <span class="tc-out__yr">${t('outYear')}</span></p>
<p class="tc-out__at" data-v="out.at">${r.at}</p>
<p class="tc-out__none" data-v="out.none"${r.none ? '' : html` hidden`}>${t('outNone')}</p>
<div class="tc-out__hyp"><p>${t('outHyp')}</p>
<p class="tc-band"><label for="tc-band">${t('bandLabel')}<span class="vh"> ${t('bandFull')}</span></label>${textIn({ id: 'tc-band', key: 'band', value: v.band.value, cls: ' tc-in--band' })}<span aria-hidden="true">%</span></p>
${staticBox('why', statics)}</div>
</div>`;
}

// An answer's words with its lead figures in bold, each found after the last.
function bolded(text, leads) {
  const parts = [];
  let rest = text;
  for (const lead of leads) {
    const at = rest.indexOf(lead);
    if (at < 0) continue;
    parts.push(rest.slice(0, at), html`<strong>${lead}</strong>`);
    rest = rest.slice(at + lead.length);
  }
  return html`${parts}${rest}`;
}

function wwitMarkup(v) {
  const w = v.wwit;
  const L = w.leads;
  const row = (label, key, text, leads) => html`<tr><th scope="row">${label}</th><td data-v="${key}">${bolded(text, leads)}</td></tr>`;
  const ask = (label, id, key, value, full) => html`<label for="${id}">${label}<span class="vh"> ${full}</span></label> ${textIn({ id, key, value, cls: ' tc-in--m' })}`;
  return html`<section class="tc-ww" aria-labelledby="tc-ww-h"><h3 class="tc-ww__h"><span id="tc-ww-h">${t('wwHeading')}</span> <span class="tc-src" data-v="ww.tag">${w.tag}</span></h3>
<table class="tc-wwt"><tbody>
<tr><th scope="row">${ask(t('wwEarn'), 'tc-earn', 'earn', w.earn.value, t('wwEarnFull'))}</th><td data-v="ww.earn">${bolded(w.earn.text, L.earn)}</td></tr>
<tr><th scope="row">${ask(t('wwOwe'), 'tc-owe', 'owe', w.owe.value, t('wwOweFull'))}</th><td data-v="ww.owe">${bolded(w.owe.text, L.owe)}</td></tr>
${row(t('wwGain'), 'ww.gain', w.gain, L.gain)}
${row(t('wwLoss'), 'ww.loss', w.loss, L.loss)}
${row(fill('wwPct', { one: pct(0.01, 0) }), 'ww.pct', w.perPct, L.pct)}
<tr><th scope="row" data-v="ww.qLabel">${w.quality.label}</th><td data-v="ww.q">${bolded(w.quality.text, L.q)}</td></tr>
</tbody></table></section>`;
}

// A part that is the same for every hospital (the quality note, "How each line works", the band's "why?"): the build
// writes its words (program/calc.js calcStatics) and the browser keeps them when it draws another hospital, so the page's
// script carries none of them. statics: { name: markup }, or null for an empty box.
const staticBox = (name, statics) => html`<div class="tc-static" data-static="${name}">${statics?.[name] ?? ''}</div>`;

/**
 * The calculator's changing part: the two columns, for the view's hospital and state. fig: false leaves the figure's box
 * empty; statics: the hospital-independent parts' markup (the build's), or null for their empty boxes (the browser's).
 */
export function calcMarkup(v, { fig = true, statics = null } = {}) {
  return html`<div class="tc-grid">
<div class="tc-left">
<fieldset class="tc-track"><legend class="vh">${t('trackLegend')}</legend>${v.tracks.map((k) => html`<label class="tc-track__opt"><input type="radio" name="tc-track" value="${String(k.n)}" data-in="t.${String(k.n)}"${k.checked ? html` checked` : ''}><span>${k.name} <small>${k.sub}</small></span></label>`)}</fieldset>
<p class="tc-note" data-v="note"${v.note ? '' : html` hidden`}>${v.note}</p>
<div class="tc-scroll"><table class="tc-ep">
<thead><tr><th scope="col">${t('colEpisode')}</th><th scope="col">${t('colYear')}</th><th scope="col">${t('colPrice')}</th><th scope="col">${t('colSpend')}</th><th scope="col" class="tc-lvc"><abbr title="${fill('colLvFull', { lv: String(LOW_VOLUME) })}">${fill('colLv', { lv: String(LOW_VOLUME) })}</abbr></th><th scope="col" class="num">${t('colTarget')}</th><th scope="col" class="num tc-ep__res">${t('colResultPhone')}</th></tr></thead>
<tbody>${v.rows.map(rowMarkup)}</tbody>
</table></div>
${ledgerMarkup(v)}
${qualityMarkup(v, statics)}
${staticBox('how', statics)}
</div>
<div class="tc-right">
${resultMarkup(v, statics)}
<figure class="tc-fig"><div data-v="fig">${fig ? v.fig() : ''}</div><figcaption class="tc-foot">${t('figNote')}</figcaption></figure>
${wwitMarkup(v)}
<div class="tc-share"><button type="button" class="fig__btn" data-calc-copy hidden>${t('copyLink')}</button><label class="tc-incl" hidden><input type="checkbox" data-calc-incl> ${t('includeMine')}</label><button type="button" class="fig__btn" data-calc-slide hidden>${t('copySlide')}</button><span class="tc-copied" role="status"></span><p class="tc-link" data-calc-link hidden></p><p class="tc-link tc-slide" data-calc-slide-text hidden></p><p class="tc-private">${t('private')}</p></div>
</div>
</div>`;
}
