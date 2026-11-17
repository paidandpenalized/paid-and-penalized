// A hospital's page across the programs, /hospital/<ccn>/, server-rendered, for every hospital in the dollar file, and, its
// body drawn by outside.js (outsidePage), for every other hospital in the hospital master (one outside the penalty
// programs). With an
// estimate: the record card, the net of the three programs (its stamp and the common fiscal year's note) with each
// program's dollars as rows adding to it, each beside its peers' median; the headline that compares the net with the
// same-state peers' median, over the frame the page's script draws the peer swarm in; the what-if section's rows; the
// peer table's fold; the source and fairness lines. After the what-if, apart from the net and never added to it, the
// Medicaid work-requirement band (medicaid.js: a scenario, not a payment), for a hospital the scenario file has a row for.
// Without one (Maryland's all-payer model, or no inputs): the record card, the status and why, the program pages it has,
// and the Medicaid band as above. Everything a reader needs is in the HTML; the script (entry hub-hospital,
// hub/client/hospital.js) adds the swarm, the peer toggle, the strips and the peer table, on these hooks:
//   [data-peers]        the sticky peer row; its buttons, and the disabled toggles' notes under it ([data-peer-note]), are
//                       hidden until the script
//   [data-headline]     the headline; [data-swarm], an empty <div> for the canvas (not displayed while empty), and
//                       [data-swarm-note], its caption and hint (hidden until the script)
//   #whatif [data-row]  hrrp, hacrp, hvbp and net, each with an empty [data-strip]; [data-result] (aria-live) in net's,
//                       and its [data-match] and [data-reset] buttons (hidden until the script)
//   [data-peer-table]   the peer table's <details>, which the script fills; [data-load-error], one quiet line (hidden)
import { rangeBar } from '../../engine/js/dollars/ranges.js';
import { PEER_MODES, peerKey } from '../../engine/js/peers.js';
import { fillCopy, pill, stamp } from '../../web/render/components.js';
import { count, dollars, factor, money, moneyRange, placeText } from '../../web/render/format.js';
import { html } from '../../web/render/html.js';
import { SITE, hospitalPathOf, programById } from '../../web/site.js';
import { arrow, estimateTag, hubPage } from '../parts.js';
import { COPY } from './copy.js';
import { medicaidBand } from './medicaid.js';
import { outsideBody, outsideDescription } from './outside.js';
import { closed, deepLink, pageOf, recordCard, shownName } from './record.js';
import { ROWS, barSpan, inProgram, peerGroup, rowDollars, sumScale, sumValues, trackAt } from './peers.js';
import { HAC_CUT_TEXT, addsAsPrinted, comparison, inkOf, outKey, rowWord, signOf, signedMoney, whyText } from './text.js';

const fill = (key, values) => fillCopy(COPY, key, values);

// The fonts the first screen shows: the name in the display face, the body face, and IBM Plex Mono in both weights (the
// record's fields and the net's large figure).
const FONTS = Object.freeze(['alfa-slab-one-400', 'libre-franklin-400', 'ibm-plex-mono-400', 'ibm-plex-mono-700']);

// Each group (a mode and its key) and what its peers show (peers.js peerGroup), worked out once per list of hospitals.
const GROUPS = new WeakMap();
function groupOf(hospitals, h, mode) {
  let groups = GROUPS.get(hospitals);
  if (!groups) GROUPS.set(hospitals, (groups = new Map()));
  const id = `${mode}:${peerKey(h, mode)}`;
  if (!groups.has(id)) groups.set(id, peerGroup(fill, hospitals, h, mode));
  return groups.get(id);
}

// ---------- the net and its rows ----------

const word = (id, dollars) => rowWord(fill, id, dollars);

// A row's track: the signed bar from the zero line (none for $0) and the peers' median tick (none when it has no median).
function track(x, own, median) {
  const { a, w } = barSpan(x, own);
  const bar = own === 0 ? '' : html`<span class="hh__bar hh__bar--${inkOf(own)}" style="--a:${a};--w:${w}"></span>`;
  const tick = median === null ? '' : html`<span class="hh__tick" style="--m:${trackAt(x(median))}"></span>`;
  return html`<span class="hh__track" aria-hidden="true">${bar}${tick}</span>`;
}

// The dollar rows: each program's dollars, then the net, on one scale from a zero line, with the peers' median ticks.
// The scale holds the medians of every way the hospital can be grouped (sets), so the page's peer toggle moves only the
// ticks.
function sumRows(h, figures, fy, sets) {
  const rows = [...ROWS.map((r) => ({ id: r.id, label: programById(r.id).name })), { id: 'net', label: fill('sumNet') }]
    .map((row) => ({ ...row, ...rowDollars(h.est, row.id, figures) }));
  const x = sumScale(sumValues(h.est, sets));
  const zero = x(0);
  const parts = rows.filter((row) => row.id !== 'net' && row.own !== null).map((row) => row.own);
  const line = (row) => {
    const cls = `hh__sr${row.id === 'net' ? ' hh__sr--net' : ''}`;
    if (row.own === null) return html`<li class="${cls} hh__sr--out" data-sum="${row.id}"><span class="hh__sl">${row.label}</span><span class="hh__out"><span>${fill(outKey(row.id, 'notInProgram'))}</span></span></li>`;
    const med = row.median === null ? '' : html`<span class="vh">; ${fill('sumMedian', { amount: signedMoney(row.median) })}</span>`;
    return html`<li class="${cls}" data-sum="${row.id}"><span class="hh__sl">${row.label}</span>${track(x, row.own, row.median)}<span class="hh__sv">${signedMoney(row.own)}</span><span class="hh__sw">${word(row.id, row.own)}${med}</span></li>`;
  };
  // Under the zero line: "$0", with which side is a cut and which a bonus where the side has room for its word.
  const axis = html`<li class="hh__axis" aria-hidden="true"><span class="hh__ax" style="--z:${trackAt(zero)}">${zero > 0.3 ? html`<span class="hh__ax-cut">← ${fill('wordCut')}</span>` : ''}<span class="hh__ax-0">${money(0)}</span>${zero < 0.7 ? html`<span class="hh__ax-bonus">${fill('wordBonus')} →</span>` : ''}</span></li>`;
  return html`<ul class="hh__sum" role="list" aria-label="${fill('sumLabel', { fy })}" style="--z:${trackAt(zero)}">
${rows.map(line)}
${axis}
</ul>
<p class="hh__key"><span class="hh__key-tick" aria-hidden="true"></span>${fill('sumKey')}</p>
<p class="hh__round" data-sum-round${addsAsPrinted(parts, h.est.net) ? ' hidden' : ''}>${fill('sumRounded')}</p>`;
}

// Where the likely ranges come from: the HACRP Methods page's back-test (its id there is the site's BACKTEST_ID), which
// compared the same estimates with hospitals' cost reports. The build's link check holds the address to a real id.
const BACKTEST_HREF = `${SITE.sites.hacrp.path}methods/#backtest`;

// The net's likely range (h.netRange), as the HACRP pages draw one: its key (to the back-test), the two ends as they print
// a range (moneyRange; in whole dollars when rounding would print both ends alike), and a small bar with the estimate's
// place on it; '' for none (a net of $0).
function band(h) {
  if (!h.netRange) return '';
  const [lo, hi] = h.netRange;
  const places = rangeBar(h.netRange, h.est.net);
  const bar = places ? html`<span class="hh__rng-bar" style="--lo:${places.lo};--hi:${places.hi};--at:${places.at}" aria-hidden="true"></span>` : '';
  const text = money(lo) === money(hi) ? fill('bandRange', { lo: dollars(lo), hi: dollars(hi) }) : moneyRange(lo, hi);
  return html`<p class="hh__rng"><a class="hh__rng-k" href="${BACKTEST_HREF}">${fill('bandLikely')}</a> <span class="hh__rng-v">${text}</span>${bar}</p>`;
}

// The net block: its label and tag, the large figure and its stamp, the net's likely range (hidden by the what-if while a
// scenario shows), the common fiscal year's note, the note on a hospital whose agreement has ended, the rows, and the
// button down to the what-if.
function netBlock(h, master, figures, fy, sets) {
  const { net } = h.est;
  const sign = signOf(net);
  const stampLabel = fill({ cut: 'stampCut', bonus: 'stampBonus', zero: 'stampZero' }[sign]);
  return html`<section class="hh__net" aria-labelledby="hh-net-h">
<p class="hh__netlab" id="hh-net-h">${fill('netLabel', { fy })} ${estimateTag()}</p>
<div class="hh__netline">
<p class="hh__big">${signedMoney(net)}</p>
<div class="hh__stamp hh__stamp--${sign}">${stamp({ label: stampLabel, ink: sign === 'zero' })}</div>
</div>
<div class="hh__band" data-band>${band(h)}</div>
<p class="hh__fy">${fill('fyNote', { fy })}</p>
${closed(h, master, fy)}
${sumRows(h, figures, fy, sets)}
<a class="hh__wbtn" href="#whatif"><span class="ico ico--capsule" aria-hidden="true"></span>${fill('whatIfButton')}</a>
</section>`;
}

// ---------- the peer row, the headline and the swarm's frame ----------
const MODES = [['state', 'peerState', null], ['size', 'peerSize', 'peerNoSize'], ['teach', 'peerTeach', 'peerNoTeach']];
function peerRow(h, { peers, group }) {
  const missing = MODES.filter(([mode]) => peerKey(h, mode) === null);
  const buttons = MODES.map(([mode, label]) => {
    const off = missing.some(([m]) => m === mode);
    return html`<button type="button" class="hh__pb" data-peer="${mode}" aria-pressed="${String(mode === 'state')}"${off ? html` disabled aria-describedby="hh-no-${mode}"` : ''} hidden>${fill(label)}</button>`;
  });
  return html`<div class="hh__peers" data-peers>
<div class="wrap hh__pin">
<span class="hh__plbl">${fill('peersLabel')}</span>
<div class="hh__seg" role="group" aria-label="${fill('peersGroupLabel')}">${buttons}</div>
<p class="hh__grp" data-peer-name><b>${count(peers.length)}</b> ${group}</p>
</div>
</div>
${missing.length ? html`<div class="wrap hh__pnotes">${missing.map(([mode, , note]) => html`<p class="hh__pnote" id="hh-no-${mode}" data-peer-note hidden>${fill(note)}</p>`)}</div>` : ''}`;
}

function figure(h, { peers, figures, group }, { fy, all }) {
  const head = comparison(fill, 'head', { share: h.est.share, median: figures.net.median, n: peers.length, group });
  return html`<figure class="hh__fig">
<h2 class="hh__head" data-headline>${head}</h2>
<p class="hh__noscript">${fill('swarmNoScript')}</p>
<div class="hh__swarm" data-swarm></div>
<figcaption class="hh__cap" data-swarm-note hidden>${fill('swarmCaption', { fy, n: count(peers.length), group, all: count(all) })} <span class="hh__hint">${fill('swarmHint')}</span></figcaption>
<p class="hh__err" data-load-error hidden>${fill('loadError')}</p>
</figure>`;
}

// ---------- the what-if section ----------
// The Readmissions row's second line, for a hospital with a Readmissions page here: that page shows CMS's newer file's
// factor (hrrp: loadHub().hrrp), so the row says which and why this page's differs. A hospital this page's year lists
// but the newer file doesn't has no Readmissions page, and the row says why. '' otherwise.
function hrrpYearLine(h, { fy, hrrp }) {
  if (!hrrp || String(hrrp.fy) === fy) return '';
  if (!h.inHrrp) return h.est.hrrpListed ? html`<p class="hh__why">${fill('whyHrrpYearGone', { next: String(hrrp.fy) })}</p>` : '';
  const record = hrrp.hospitals.get(h.ccn);
  if (!record || !Number.isFinite(record.paf)) return '';
  return html`<p class="hh__why">${fill(h.est.hrrpListed ? 'whyHrrpYear' : 'whyHrrpYearOut', { next: String(hrrp.fy), factor: factor(record.paf), fy })}</p>`;
}

function programRow(h, id, figures, ctx) {
  const { name, ab } = programById(id);
  const listed = inProgram(h.est, id);
  const own = rowDollars(h.est, id, figures).own;
  const value = listed
    ? html`<span class="vh">${fill('rowValue', { fy: ctx.fy })} </span><span class="hh__num">${signedMoney(own)}</span> ${pill({ kind: inkOf(own), label: word(id, own) })}`
    : pill({ kind: 'na', label: fill(outKey(id, 'notInProgram')) });
  return html`<div class="hh__row" data-row="${id}">
<div class="hh__rt">
<h3 class="hh__rh">${name} <span class="hh__ab">${ab}</span></h3>
<p class="hh__rv">${value}</p>
<p class="hh__why">${whyText(fill, h, id, figures[id], ctx).join(' ')}</p>
${id === 'hrrp' ? hrrpYearLine(h, ctx) : ''}${deepLink(h, id)}
</div>
<div class="hh__strip" data-strip></div>
</div>`;
}

function whatifSection(h, { peers, figures, group }, { fy, hrrp }) {
  const ctx = { fy, group, hrrp };
  const n = peers.length;
  const result = comparison(fill, 'result', { share: h.est.share, median: figures.net.median, n, group });
  return html`<section class="hh__progs" id="whatif" aria-labelledby="whatif-h">
<div class="wrap"><div class="hh__pi">
<div class="hh__sechead">
<div><p class="cap kicker">${fill('whatifKicker')}</p><h2 id="whatif-h"><span class="hh__js">${fill('whatifHeading')}</span> <span class="hh__nojs">${fill('whatifKicker')}</span></h2></div>
<p class="hh__lede">${fill('whatifLede', { fy, n: count(n), group })}</p>
<p class="hh__noscript">${fill('whatifNoScript')}</p>
</div>
<div class="hh__rows">
${ROWS.map((r) => programRow(h, r.id, figures, ctx))}
<div class="hh__row hh__row--net" data-row="net">
<div class="hh__rt">
<h3 class="hh__rh">${fill('netHeading')}</h3>
<div class="hh__result" data-result aria-live="polite">
<p class="hh__rhd">${fill('resultHead', { fy })} ${estimateTag()}</p>
<p class="hh__rbig">${signedMoney(h.est.net)}</p>
<p class="hh__rs">${result}</p>
</div>
<p class="hh__stand">${fill('whatifStanding')}</p>
<p class="hh__actions"><button type="button" class="hh__lnk" data-match hidden>${fill('matchAll')}</button> <button type="button" class="hh__reset" data-reset hidden>${fill('reset')}</button></p>
</div>
<div class="hh__strip" data-strip></div>
</div>
</div>
</div></div>
</section>`;
}

// ---------- the page ----------

function estimatedBody(h, master, group, { fy, all, sets, hrrp, medicaid }) {
  const { peers } = group;
  return html`<article class="hh" data-ccn="${h.ccn}">
${peerRow(h, group)}
<div class="wrap hh__hero">
<div class="hh__money">
${recordCard(h, master, fy)}
${netBlock(h, master, group.figures, fy, sets)}
</div>
${figure(h, group, { fy, all })}
</div>
${whatifSection(h, group, { fy, hrrp })}
${medicaidBand(h, medicaid, { net: true })}<div class="wrap"><div class="hh__tbl">
<details class="hh__det" data-peer-table><summary>${fill('tableSummary')} <span>${fill('tableCount', { n: count(peers.length), group: group.group })}</span></summary></details>
</div></div>
${notes(fy, true)}
</article>`;
}

// The page of a hospital with no estimate: the record card, its status and why, and the program pages it has.
function variantBody(h, master, fy, medicaid) {
  const maryland = h.status === 'maryland';
  const links = ROWS.map((r) => r.id).filter((id) => pageOf(h, id));
  return html`<article class="hh hh--none" data-ccn="${h.ccn}">
<div class="wrap hh__hero">
${recordCard(h, master, fy)}
<div class="hh__none">
<section class="hh__status" aria-labelledby="hh-status-h">
<h2 class="stamp stamp--ink hh__sh" id="hh-status-h">${fill(maryland ? 'statusMaryland' : 'statusNoInputs')}</h2>
<p class="hh__st">${maryland ? fill('statusMarylandText') : fill('statusNoInputsText', { fy })}</p>
${maryland ? '' : html`<p class="hh__st">${h.cut ? fill('statusHacCut', { fy, rate: HAC_CUT_TEXT }) : fill('statusHacNone', { fy })}</p>`}
${closed(h, master, fy)}
</section>
${links.length ? html`<section class="hh__pages" aria-labelledby="hh-pages-h">
<h2 class="h-sm" id="hh-pages-h">${fill('pagesHeading')}</h2>
<ul class="hh__plist" role="list">${links.map((id) => html`<li>${deepLink(h, id)}</li>`)}</ul>
</section>` : ''}
</div>
</div>
${medicaidBand(h, medicaid, { net: false })}${notes(fy, false)}
</article>`;
}

// The source line, and with dollars on the page, what they are and the fairness line.
export const notes = (fy, dollars) => html`<div class="wrap"><div class="hh__notes">
<p>${fill('source', { fy })}${dollars ? html` ${fill('sourceDollars', { fy })}` : ''}</p>
${dollars ? html`<p>${fill('fairness')}</p>` : ''}</div></div>`;

// A hub hospital's description, body and scripts: with an estimate, the net, its peers and the what-if (and the script
// that draws them); without one (Maryland's, or no inputs), its status and why.
function hubParts({ h, hospitals, facts, assets, master = null, hrrp = null, medicaid }, fy, place) {
  if (!h.est) {
    const maryland = h.status === 'maryland';
    return { description: fill(maryland ? 'descriptionMaryland' : 'descriptionNoInputs', maryland ? place : { ...place, fy }), body: variantBody(h, master, fy, medicaid), scripts: [] };
  }
  // The page opens on the same-state peers; the dollar rows' scale holds every group's medians (the toggle's).
  const groups = PEER_MODES.map((mode) => groupOf(hospitals, h, mode));
  const group = groups[0] ?? null;
  if (!group) throw new RangeError(`hub: ${h.ccn} has an estimate but no same-state peers`);
  const sets = groups.filter(Boolean).map((g) => g.figures);
  return {
    description: fill('description', { ...place, fy, n: count(group.peers.length), group: group.group }),
    body: estimatedBody(h, master, group, { fy, all: facts.n, sets, hrrp, medicaid }),
    scripts: [assets.js['hub-hospital']],
  };
}

// An outside hospital's (outside.js): no script until its figures have one.
function outsideParts({ h, assets, master = null, medicaid, programYears, near = '', like = '' }, fy, place) {
  // The body first: it stops the build on a page with nothing to explain it, which outsideDescription would only misname.
  const body = outsideBody(h, { master, fy, programYears, medicaid, near, like });
  // The nearest hospitals' map has tooltips on its pins and its table a scroll box: the figure script serves both.
  return { description: outsideDescription(h, place, fy), body, scripts: near ? [assets.js.figure] : [] };
}

// The page shell around a body: the title, path, fonts and the header's hospital chip, shared by a hub hospital's page and
// an outside hospital's. parts: { description, body, scripts }; inHacrp: whether the dollar file has the hospital (so the
// HACRP tab opens a page; the hub has a page for every hospital).
function shell({ h, assets, robots }, place, fy, { description, body, scripts }, inHacrp = true) {
  return hubPage({
    title: `${fill('title', { ...place, fy })} · ${SITE.name}`,
    description,
    path: hospitalPathOf('hub', h.ccn),
    robots,
    body,
    assets,
    scripts,
    preloadFonts: FONTS,
    hospital: { ccn: h.ccn, name: place.name, net: h.est ? h.est.net : null, inHrrp: h.inHrrp, inHacrp },
  });
}

// The page at hospitalPathOf('hub', h.ccn). h: a hub hospital (hub/model.js hubHospitals); hospitals: every hub hospital
// (its peers are among them); facts: storyFacts(hospitals) (`n`, the hospitals with an estimate); master: h's hospital
// master record (the Type field's kind, ownership and urban or rural); assets: the build's (the fiscal year is the
// shell's); robots: the page's robots value; hrrp: loadHub().hrrp, for the Readmissions row's note on its page's newer
// factor (none: no note); medicaid: loadHub().medicaid, for the Medicaid band (required: loadHub always reads the scenario
// file; a hospital with no row in it gets no band).
export function hospitalPage(args) {
  const fy = String(args.assets.shell.fy);
  const place = { name: shownName(args.h), place: placeText(args.h) };
  return shell(args, place, fy, hubParts(args, fy, place));
}

// The page of a hospital outside the penalty programs (hub/outside.js outsideHospitals) at the same path. args as
// hospitalPage's, but with no hospitals, facts or hrrp (it has no peers), and: programYears, loadHub().programYears
// (required: the years its reasons name); near and like, its figure blocks ('' for none; outside-figures.js nearBlock,
// which brings the figure script, and likeBlock). A hospital no CMS file names goes by "Hospital <CCN>" in its title,
// description and the header's chip, as on its card (record.js shownName), as on hospitalPage's.
export function outsidePage(args) {
  const fy = String(args.assets.shell.fy);
  const place = { name: shownName(args.h), place: placeText(args.h) };
  return shell(args, place, fy, outsideParts(args, fy, place), false);
}
