// What sits below the home page's story, server-rendered: the program directory (a card per program the dollar
// estimates hold, each with its national figure and a histogram of its hospitals, then the coming programs as dashed
// slips by what they do to payment), "Methods, in brief" with a worksheet that adds up one hospital's estimate (the
// example's; hub/client/story/worksheet.js refills it for a hospital the story finds), and the invitation to say what
// to build next. Every number comes from the data or a program's rule; the words are copy.js's.
//
// The look reuses the family's parts: the form (.form, .field, the numbered boxes, the stamp, the estimate tag) and the
// hospital page's strip drawing (.st: its gutter, grid, base line, inks and labels) and empty-program band.
import { COPY as SHARED } from '../../web/copy.js';
import { HAC_CUT_PCT, HAC_TOP_SHARE, HRRP_CAP_PCT, programDek } from '../../web/programs.js';
import { estTag, fillAround, fillCopy } from '../../web/render/components.js';
import { capitalize, count, fractionWord, money, numberWord, pct } from '../../web/render/format.js';
import { html } from '../../web/render/html.js';
import { externalLink } from '../../web/render/layout.js';
import { SITE } from '../../web/site.js';
import { shareDomain, shareScale } from '../client/scale.js';
import { OUTSIDE, worksheetModel } from '../client/story/worksheet.js';
import { COPY as HOSPITAL_COPY } from '../hospital/copy.js';
import { ROWS, inProgram } from '../hospital/peers.js';
import { holds, simpleFraction } from './claims.js';
import { COPY } from './copy.js';

const fill = (key, values) => fillCopy(COPY, key, values);
// A rule's percent as the page writes it: percent(1) is "1%".
const percent = (n) => pct(n / 100, 0);
const arrow = html`<span class="ico ico--arrow" aria-hidden="true"></span>`;
const estimateTag = () => estTag({ href: `${SITE.pages.methods}#estimate`, label: HOSPITAL_COPY.estimateTagLabel, text: HOSPITAL_COPY.estimateTag });
// A sentence of copy with some placeholders filled with markup (parts) and the rest with words (values).
const sentence = (key, parts, values = {}) => fillAround((marks) => fill(key, { ...values, ...marks }), parts);

// ---------- the program directory ----------

// The width of a histogram's bins, in percentage points of a hospital's pay. Bins run out from $0 both ways, so none
// straddles it; exactly $0 has a gutter of its own.
export const BIN_POINTS = 0.2;
// Readmissions' cuts are "small" when under a third of the cap (as a share of pay); most of them must be.
const SMALL_CUT = HRRP_CAP_PCT / 3 / 100;
// How near the share of its hospitals the HAC program cuts must be to the rule's share (HAC_TOP_SHARE) for the words
// "the quarter with the highest scores" (a hospital in the file without a score is never cut, so the two differ a little).
const RULE_SHARE_NEAR = 0.03;
const DOLLARS_OF = Object.fromEntries(ROWS.map((r) => [r.id, r.key]));

// The hospitals with an estimate in a program's file (a hospital-page row's id: hrrp, hacrp, hvbp), each one's dollars
// there as a percent of its estimated pay, binned: { n } hospitals, { zero } of them at exactly $0, and the bins with any
// hospital, { lo, n }, in order (lo: the bin's low end, in percentage points; a bin holds lo <= v < lo + BIN_POINTS).
export function programBins(hospitals, id) {
  const key = DOLLARS_OF[id];
  if (!key) throw new RangeError(`hub home: no dollars for the program "${id}"`);
  let n = 0;
  let zero = 0;
  const counts = new Map();
  for (const h of hospitals) {
    if (!h.est || !inProgram(h.est, id)) continue;
    n += 1;
    const v = (h.est[key] * 100) / h.est.total;
    if (v === 0) zero += 1;
    else {
      const i = Math.floor(v / BIN_POINTS);
      counts.set(i, (counts.get(i) ?? 0) + 1);
    }
  }
  const bins = [...counts].sort((a, b) => a[0] - b[0]).map(([i, c]) => ({ lo: i * BIN_POINTS, n: c }));
  return { n, zero, bins };
}

// The histogram's frame, in viewBox units: its width, the bars' top and base line, the drawing's height, the $0 gutter's
// width, the gap between bars, the shortest bar.
const W = 400;
const TOP = 18;
const BASE = 86;
const H = 104;
const GUTTER = 16;
const GAP = 1;
const MIN_BAR = 1.5;
const r1 = (v) => Math.round(v * 10) / 10;

// A program's histogram: the share axis the story's charts use (domain: shareDomain's), its $0 gutter, a bar per bin
// (cuts in pen, bonuses in rew, $0 neutral; one path per ink), the whole percents ticked, and two labels: the cuts, then
// the bonuses or, without any, the hospitals at $0. An image whose label is the takeaway.
function histogram({ n, zero, bins }, { domain, label }) {
  const { zL, zR, zM, k } = shareScale({ x0: 0, x1: W, gutter: GUTTER, domain });
  const at = (v, side) => Math.min(W, Math.max(0, side + v * k));
  const tallest = Math.max(zero, ...bins.map((b) => b.n));
  const height = (c) => Math.max(MIN_BAR, ((BASE - TOP) * c) / tallest);
  const bar = (x0, x1, c) => `M${r1(x0)} ${BASE}V${r1(BASE - height(c))}H${r1(x1)}V${BASE}Z`;
  const cuts = bins.filter((b) => b.lo < 0);
  const bonuses = bins.filter((b) => b.lo >= 0);
  const span = (b) => {
    const side = b.lo < 0 ? zL : zR;
    return [at(b.lo, side) + GAP, at(b.lo + BIN_POINTS, side) - GAP];
  };
  const path = (ink, d) => (d ? html`<path class="st__d st__d--${ink}" d="${d}"/>` : '');
  const ticks = [];
  for (let t = Math.ceil(domain[0]); t <= Math.floor(domain[1]); t++) ticks.push(t);
  const tickX = (t) => (t === 0 ? zM : at(t, t < 0 ? zL : zR));
  // The labels: over the tallest bin of a side, reaching away from $0, so the two never meet across the gutter.
  const top = (c) => r1(Math.max(11, BASE - height(c) - 4));
  const peak = (side) => side.reduce((best, b) => (b.n > best.n ? b : best));
  const labels = [];
  const cutN = cuts.reduce((s, b) => s + b.n, 0);
  const bonusN = bonuses.reduce((s, b) => s + b.n, 0);
  if (cuts.length) {
    const b = peak(cuts);
    labels.push(html`<text class="st__out" x="${r1(Math.max(60, span(b)[1]))}" y="${top(b.n)}" text-anchor="end">${fill('histCut', { n: count(cutN) })}</text>`);
  }
  if (bonuses.length) {
    const b = peak(bonuses);
    labels.push(html`<text class="st__out" x="${r1(Math.min(W - 70, span(b)[0]))}" y="${top(b.n)}">${fill('histBonus', { n: count(bonusN) })}</text>`);
  } else if (zero) {
    labels.push(html`<text class="st__out" x="${r1(zR + 4)}" y="${top(zero)}">${fill('histZero', { n: count(zero), zero: money(0) })}</text>`);
  }
  if (cutN + bonusN + zero !== n) throw new RangeError('hub home: a histogram\'s bars do not add to its hospitals');
  return html`<svg class="st pc__hist" viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}" focusable="false">
<rect class="st__gut" x="${r1(zL)}" y="${TOP - 6}" width="${GUTTER}" height="${BASE - TOP + 6}"/>
<path class="st__grid" d="${ticks.filter((t) => t !== 0).map((t) => `M${r1(tickX(t))} ${TOP - 6}V${BASE}`).join('')}"/>
${path('pen', cuts.map((b) => bar(...span(b), b.n)).join(''))}${path('rew', bonuses.map((b) => bar(...span(b), b.n)).join(''))}${path('neu', zero ? bar(zL + 3, zR - 3, zero) : '')}
<path class="st__base" d="M0 ${BASE + 0.5}H${W}"/>
${ticks.map((t) => html`<text class="st__tl" x="${r1(tickX(t))}" y="${BASE + 14}" text-anchor="middle">${t === 0 ? money(0) : pct(t / 100, 0, { sign: true })}</text>`)}
${labels}
</svg>`;
}

// Each card's takeaway over its histogram, from the program's hospitals (members) and bins; each checks the claim its
// words make.
const TAKEAWAYS = {
  hrrp(members, { n, zero }) {
    const cuts = members.filter((h) => h.est.hrrp < 0).map((h) => -h.est.hrrp / h.est.total);
    holds(cuts.filter((c) => c < SMALL_CUT).length * 2 > cuts.length, COPY.takeHrrp);
    const near = simpleFraction(zero / n);
    return near?.part === 1 ? fill('takeHrrp', { whole: numberWord(near.whole), zero: money(0) })
      : fill('takeHrrpShare', { share: pct(zero / n, 0), zero: money(0) });
  },
  hacrp(members, { n, zero, bins }) {
    holds(bins.every((b) => b.lo < 0), COPY.takeHac);
    holds(Math.abs((n - zero) / n - HAC_TOP_SHARE) <= RULE_SHARE_NEAR, COPY.takeHac);
    return fill('takeHac', { quarter: fractionWord(HAC_TOP_SHARE, 'the'), cut: percent(HAC_CUT_PCT), zero: money(0) });
  },
  hvbp(members, { bins }) {
    holds(bins.some((b) => b.lo < 0) && bins.some((b) => b.lo >= 0), COPY.takeVbp);
    return COPY.takeVbp;
  },
};

// Each card's national figure and the words under it, from the story's facts.
const FIGURES = {
  hrrp: (facts, fy) => ({ big: money(facts.hrrpSum), sub: fill('dirNotPaid', { fy }) }),
  hacrp: (facts, fy) => ({ big: money(facts.hacSum), sub: fill('dirNotPaid', { fy }) }),
  hvbp: (facts, fy) => ({ big: fill('dirMoved', { amount: money(facts.vbpBonus) }), sub: fill('dirNet', { amount: money(facts.vbpNet), fy }) }),
};

// The coming programs' groups, in order: the registry's `group` and its words.
const SOON_GROUPS = [['price', 'soonPrice'], ['reporting', 'soonReporting'], ['episode', 'soonEpisode']];

// A program's card: its name and abbreviation, dek, takeaway and histogram, national figure (an estimate, for the year)
// and the way to its page.
function card(p, { hospitals, facts, fy, domain }) {
  if (!TAKEAWAYS[p.id] || !FIGURES[p.id]) throw new RangeError(`hub home: the directory has no figure for the program "${p.id}"`);
  const bins = programBins(hospitals, p.id);
  const members = hospitals.filter((h) => h.est && inProgram(h.est, p.id));
  const { big, sub } = FIGURES[p.id](facts, fy);
  const cutN = bins.bins.filter((b) => b.lo < 0).reduce((s, b) => s + b.n, 0);
  const label = fill('histLabel', {
    n: count(bins.n), program: p.ab, fy, bin: String(BIN_POINTS), cutN: count(cutN), zeroN: count(bins.zero), zero: money(0),
    bonusN: count(bins.n - cutN - bins.zero),
  });
  return html`<article class="pc">
<h3><span>${p.name}</span> <abbr class="ab" title="${p.long}">${p.ab}</abbr></h3>
<p class="pc__dek">${programDek(p.id)}</p>
<figure><figcaption>${TAKEAWAYS[p.id](members, bins)}</figcaption>${histogram(bins, { domain, label })}</figure>
<p class="pc__big">${big}${estimateTag()}</p>
<p class="pc__sub">${sub}</p>
<a class="go" href="${p.path}">${fill('dirOpen', { name: p.name })}${arrow}</a>
</article>`;
}

// A coming program's slip: its abbreviation, name and dek over an empty hatched band, linking to its coming-soon page.
const slip = (p) => html`<a class="slip" href="${p.path}"><abbr class="ab" title="${p.long}">${p.ab}</abbr><b>${p.name}</b><span>${programDek(p.id)}</span><span class="hh__nextbox slip__none"><span>${COPY.soonNone}</span></span></a>`;

// The directory. programs: the registry (SITE.programs); facts: storyFacts; hospitals: hubHospitals; fy: the fiscal year.
// A card per program the dollar estimates hold, then the rest by group.
export function directory({ programs, facts, hospitals, fy }) {
  const fyText = String(fy);
  const live = programs.filter((p) => p.inData);
  const soon = programs.filter((p) => !p.inData);
  for (const p of soon) if (!SOON_GROUPS.some(([g]) => g === p.group)) throw new RangeError(`hub home: the coming program "${p.id}" is in the group "${p.group}", which the directory has no words for`);
  // The share axis every histogram shares with the story's charts (hub/client/scale.js), from each program's and the
  // net's percent of pay.
  const domain = shareDomain(hospitals.filter((h) => h.est).map(({ est }) => ({ est: { pct: Object.fromEntries(['hrrp', 'hac', 'hvbp', 'net'].map((k) => [k, (est[k] * 100) / est.total])) } })));
  const groups = SOON_GROUPS.map(([group, key]) => [key, soon.filter((p) => p.group === group)]).filter(([, members]) => members.length);
  return html`<section class="bsec" id="programs" aria-labelledby="programs-h">
<div class="bsec__head"><div><p class="cap kicker">${COPY.dirKicker}</p><h2 id="programs-h">${fill('dirHead', { count: capitalize(numberWord(live.length)) })}</h2></div>
<p class="bsec__lede">${sentence('dirLede', { gross: html`<b>${money(facts.gross)}</b>` }, { count: numberWord(live.length), fy: fyText })}</p></div>
<p class="grp cap"><span>${COPY.dirGroup}</span><span>${fill('dirGroupNote', { fy: fyText })}</span></p>
<div class="dir">${live.map((p) => card(p, { hospitals, facts, fy: fyText, domain }))}</div>
<div class="soon">${groups.map(([key, members]) => html`<div class="sg" style="--n:${members.length}"><p class="grp cap"><span>${COPY[key]}</span><span>${COPY.soonNote}</span></p>${members.map(slip)}</div>`)}</div>
</section>`;
}

// ---------- methods, in brief ----------

// The worksheet's lines, by number: the formulas' "line 2" and the boxes beside the lines are these.
const LINE = { pay: 1, base: 2, hrrp: 3, hac: 4, vbp: 5, net: 6 };
const no = (n) => html`<span class="field__no">${count(n)}</span>`;
// The three points, each with its bold part (the copy key's B); the first names the fiscal year.
const POINTS = ['estStepPay', 'estStepRule', 'estStepAdd'];
// The stamps, one per sign; the hospital's shows.
const STAMPS = [['cut', 'stampCut', ''], ['bonus', 'stampBonus', ' stamp--rew'], ['zero', 'stampZero', ' stamp--ink']];

// The worksheet for a hospital with an estimate, h: the title (fiscal year, CCN), the six lines in a table (each line's
// amount in a cell worksheet.js can rewrite, each formula a note), then the line to find another hospital, the way to
// its page and its stamp. src: the hub asset's address, for the script that refills it.
function worksheet(h, { fy, src }) {
  const m = worksheetModel(h);
  const t = m.text;
  const cell = (key) => html`<td data-ws="${key}"${key in OUTSIDE && !m.show[OUTSIDE[key]] ? html` data-na` : ''}>${t[key]}</td>`;
  const note = (words, flag = null) => html`<small${flag ? html` data-ws-if="${flag}"${m.show[flag] ? '' : html` hidden`}` : ''}>${words}</small>`;
  const row = (n, head, key, cls = null) => html`<tr${cls ? html` class="${cls}"` : ''}><td>${no(n)}</td><th scope="row">${head}</th>${cell(key)}</tr>`;
  const factor = (key) => sentence('wsFactor', { factor: html`<span data-ws="${key}">${t[key]}</span>` }, { one: count(1), base: count(LINE.base) });
  const cut = percent(HAC_CUT_PCT);
  return html`<div class="form wsx" data-worksheet data-src="${src}" data-ccn="${t.ccn}">
<p class="form__title"><span>${fill('wsTitle', { fy })}<span data-ws-ex> · ${COPY.wsExample}</span></span><span>${sentence('wsCcn', { ccn: html`<span data-ws="ccn">${t.ccn}</span>` })}</span></p>
<table class="wst"><caption class="vh">${fill('wsLabel', { fy })}</caption><tbody>
${row(LINE.pay, sentence('wsPay', { name: html`<b data-ws="name">${t.name}</b>`, place: html`<span data-ws="place">${t.place}</span>` }), 'total')}
${row(LINE.base, html`${COPY.wsBase}${note(COPY.wsBaseNote)}`, 'base')}
${row(LINE.hrrp, html`${COPY.wsHrrp}${note(factor('hrrpF'), 'hrrp')}`, 'hrrp')}
${row(LINE.hac, html`${COPY.wsHac}${note(fill('wsCut', { cut, pay: count(LINE.pay), hrrp: count(LINE.hrrp), vbp: count(LINE.vbp) }), 'cut')}${note(fill('wsNoCut', { cut }), 'nocut')}`, 'hac')}
${row(LINE.vbp, html`${COPY.wsVbp}${note(factor('vbpF'), 'vbp')}`, 'hvbp')}
${row(LINE.net, html`${sentence('wsNet', { net: html`<b>${COPY.wsNetWord}</b>` }, { a: count(LINE.hrrp), b: count(LINE.hac), c: count(LINE.vbp) })}${estimateTag()}${note(COPY.wsNetNote)}`, 'net', 'wst__net')}
</tbody></table>
<div class="field wsx__foot"><p>${COPY.wsFind} <a data-ws="go" href="${m.href}">${COPY.wsGo}</a></p>${STAMPS.map(([sign, key, cls]) => html`<p class="stamp${cls}" data-sign="${sign}"${sign === m.sign ? '' : html` hidden`}>${HOSPITAL_COPY[key]}</p>`)}</div>
</div>`;
}

// "Methods, in brief": what an estimate is, how the dollars are made in three points, the way to the methods, and the
// worksheet for h (the example hospital). fy: the fiscal year; src: the hub asset's address.
export function methodsBrief({ h, fy, src }) {
  if (!h?.est) throw new RangeError(`hub home: the worksheet's hospital ${h?.ccn} has no estimate`);
  const fyText = String(fy);
  return html`<section class="bsec ests" id="estimate" aria-labelledby="estimate-h">
<div><p class="cap kicker">${COPY.estKicker}</p><h2 id="estimate-h">${COPY.estHead}</h2>
<p>${COPY.estText}</p>
<ol class="nsteps">${POINTS.map((key, i) => html`<li>${no(i + 1)}<span>${sentence(key, { b: html`<b>${COPY[`${key}B`]}</b>` }, key === 'estStepPay' ? { fy: fyText } : {})}</span></li>`)}</ol>
<a class="more" href="${SITE.pages.methods}">${COPY.estMore}${arrow}</a></div>
${worksheet(h, { fy: fyText, src })}
</section>`;
}

// ---------- your turn ----------

// The invitation in its dashed box: what to suggest, and the feedback form (feedback: its address, prefilled for the
// page), which opens in a new tab.
export const yourTurn = ({ feedback }) => html`<section class="ask" aria-labelledby="ask-h">
<div><p class="cap kicker">${COPY.askKicker}</p><h2 id="ask-h">${COPY.askHead}</h2><p>${COPY.askText}</p></div>
<div class="ask__act">${externalLink(feedback, html`${COPY.askGo}${arrow}`)}<p>${SHARED.footFeedbackNote}</p></div>
</section>`;
