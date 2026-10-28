// A hospital's page across the programs, /hospital/<ccn>/, server-rendered, for every hospital in the dollar file. With an
// estimate: the record card, the net of the three programs (its stamp and the common fiscal year's note) with each
// program's dollars as rows adding to it, each beside its peers' median; the headline that compares the net with the
// same-state peers' median, over the frame the page's script draws the peer swarm in; the what-if section's rows; the
// peer table's fold; the source and fairness lines. Without one (Maryland's all-payer model, or no inputs): the record
// card, the status and why, and the program pages it has. Everything a reader needs is in the HTML; the script (entry
// hub-hospital, hub/client/hospital.js) adds the swarm, the peer toggle, the strips and the peer table, on these hooks:
//   [data-peers]        the sticky peer row; its buttons, and the disabled toggles' notes under it ([data-peer-note]), are
//                       hidden until the script
//   [data-headline]     the headline; [data-swarm], an empty <div> for the canvas (not displayed while empty), and
//                       [data-swarm-note], its caption and hint (hidden until the script)
//   #whatif [data-row]  hrrp, hacrp, hvbp and net, each with an empty [data-strip]; [data-result] (aria-live) in net's,
//                       and its [data-match] and [data-reset] buttons (hidden until the script)
//   [data-peer-table]   the peer table's <details>, which the script fills; [data-load-error], one quiet line (hidden)
import { PEER_MODES, peerKey } from '../../engine/js/peers.js';
import { estTag, fillCopy, formField, formTitle, pill, stamp } from '../../web/render/components.js';
import { count, money } from '../../web/render/format.js';
import { html } from '../../web/render/html.js';
import { SITE, hospitalPathOf } from '../../web/site.js';
import { hubPage } from '../parts.js';
import { COPY } from './copy.js';
import { ROWS, groupName, inProgram, peerFigures, peersOf, rowDollars, sumScale, sumValues } from './peers.js';
import { HAC_RATE, comparison, signOf, whyText } from './text.js';

const fill = (key, values) => fillCopy(COPY, key, values);
const PROGRAM = Object.fromEntries(SITE.programs.map((p) => [p.id, p]));

// The fonts the first screen shows: the name in the display face, the body face, and IBM Plex Mono in both weights (the
// record's fields and the net's large figure).
const FONTS = Object.freeze(['alfa-slab-one-400', 'libre-franklin-400', 'ibm-plex-mono-400', 'ibm-plex-mono-700']);

// The family's pages for a hospital that are not built yet (render/shell.js familyHeader's hospital.pages): its
// Readmissions page. Until it is, the header's Readmissions tab and this page's Readmissions row open the program's
// folder, so no link opens a missing page.
const NOT_BUILT = Object.freeze({ hrrp: false });

// The hospital's page in a program, or null when it has none there yet. Every hospital in the dollar file has a
// hospital-acquired conditions page: the dollar file has a row for each hospital in that program's file.
const pageOf = (h, id) => (NOT_BUILT[id] === false ? null : hospitalPathOf(id, h.ccn, { inTdr: h.inTdr }));

const arrow = html`<span class="ico ico--arrow" aria-hidden="true"></span>`;

// A program row's link: to the hospital's page there, or to the program's folder, which says it is coming.
function deepLink(h, id) {
  const { name, path } = PROGRAM[id];
  const own = pageOf(h, id);
  return own
    ? html`<a class="hh__deep" href="${own}">${fill('deepHospital', { name })}${arrow}</a>`
    : html`<a class="hh__deep hh__deep--soon" href="${path}">${fill('deepComing', { name })}</a>`;
}

// Each group (a mode and its key) and what its peers show, worked out once per list of hospitals: { peers, figures,
// group }, or null for a hospital with no group in that mode.
const GROUPS = new WeakMap();
function groupOf(hospitals, h, mode) {
  let groups = GROUPS.get(hospitals);
  if (!groups) GROUPS.set(hospitals, (groups = new Map()));
  const id = `${mode}:${peerKey(h, mode)}`;
  if (!groups.has(id)) {
    const peers = peersOf(hospitals, h, mode);
    groups.set(id, peers && peers.length ? { peers, figures: peerFigures(peers), group: groupName(fill, h, mode) } : null);
  }
  return groups.get(id);
}

// ---------- the record card ----------
const TEACH = { major: 'typeTeachMajor', minor: 'typeTeachMinor', none: 'typeTeachNone' };
// The Type field: what the master knows (teaching, beds, ownership, urban or rural), or null when it knows none of it.
// An ownership the master calls Unknown says nothing, so it is left out.
function typeText(h, master) {
  const own = master?.own && master.own !== 'Unknown' ? master.own : null;
  const parts = [
    TEACH[h.teach] && fill(TEACH[h.teach]),
    Number.isInteger(h.beds) && fill('typeBeds', { beds: count(h.beds) }),
    own,
    typeof master?.urban === 'boolean' ? fill(master.urban ? 'typeUrban' : 'typeRural') : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

function recordCard(h, master, fy) {
  const type = typeText(h, master);
  const place = h.city && h.state ? fill('location', { city: h.city, state: h.state }) : h.state ?? h.city ?? '';
  const specs = [
    { label: fill('fieldHospital'), value: h.name, as: 'h1', cls: 'hh__name', wide: true },
    { label: fill('fieldLocation'), value: place, wide: !type },
    type && { label: fill('fieldType'), value: type, size: 'sm' },
  ].filter(Boolean);
  return html`<div class="form hh__card">
${formTitle(fill('recordTitle', { fy }), fill('recordCcn', { ccn: h.ccn }))}
${specs.map((spec, i) => formField({ no: i + 1, ...spec }))}
</div>`;
}

// ---------- the net and its rows ----------
const estimateTag = () => estTag({ href: `${SITE.pages.methods}#estimate`, label: fill('estimateTagLabel'), text: fill('estimateTag') });
const signed = (dollars) => money(dollars, { sign: true });
const inkOf = (dollars) => ({ cut: 'pen', bonus: 'rew', zero: null })[signOf(dollars)];

// The word beside a row's dollars: a cut (hospital-acquired conditions': its flat rate), a bonus, or none.
function word(id, dollars) {
  const sign = signOf(dollars);
  if (sign === 'cut') return id === 'hacrp' ? fill('wordHacCut', { rate: HAC_RATE }) : fill('wordCut');
  if (sign === 'bonus') return fill('wordBonus');
  return id === 'hrrp' || id === 'hacrp' ? fill('wordNoCut') : fill('wordNoChange');
}

// A number for a style attribute (a custom property): a fraction to four places.
const frac = (x) => String(Math.round(x * 1e4) / 1e4);

// A row's track: the signed bar from the zero line (none for $0) and the peers' median tick (none when it has no median).
function track(x, own, median) {
  const zero = x(0);
  const end = x(own);
  const bar = own === 0 ? '' : html`<span class="hh__bar hh__bar--${inkOf(own)}" style="--a:${frac(Math.min(zero, end))};--w:${frac(Math.abs(end - zero))}"></span>`;
  const tick = median === null ? '' : html`<span class="hh__tick" style="--m:${frac(x(median))}"></span>`;
  return html`<span class="hh__track" aria-hidden="true">${bar}${tick}</span>`;
}

// The dollar rows: each program's dollars, then the net, on one scale from a zero line, with the peers' median ticks.
// The scale holds the medians of every way the hospital can be grouped (sets), so the page's peer toggle moves only the
// ticks.
function sumRows(h, figures, fy, sets) {
  const rows = [...ROWS.map((r) => ({ id: r.id, label: PROGRAM[r.id].name })), { id: 'net', label: fill('sumNet') }]
    .map((row) => ({ ...row, ...rowDollars(h.est, row.id, figures) }));
  const x = sumScale(sumValues(h.est, sets));
  const zero = x(0);
  const line = (row) => {
    const cls = `hh__sr${row.id === 'net' ? ' hh__sr--net' : ''}`;
    if (row.own === null) return html`<li class="${cls} hh__sr--out" data-sum="${row.id}"><span class="hh__sl">${row.label}</span><span class="hh__out"><span>${fill('notInProgram')}</span></span></li>`;
    const med = row.median === null ? '' : html`<span class="vh">; ${fill('sumMedian', { amount: signed(row.median) })}</span>`;
    return html`<li class="${cls}" data-sum="${row.id}"><span class="hh__sl">${row.label}</span>${track(x, row.own, row.median)}<span class="hh__sv">${signed(row.own)}</span><span class="hh__sw">${word(row.id, row.own)}${med}</span></li>`;
  };
  // Under the zero line: "$0", with which side is a cut and which a bonus where the side has room for its word.
  const axis = html`<li class="hh__axis" aria-hidden="true"><span class="hh__ax" style="--z:${frac(zero)}">${zero > 0.3 ? html`<span class="hh__ax-cut">← ${fill('wordCut')}</span>` : ''}<span class="hh__ax-0">${money(0)}</span>${zero < 0.7 ? html`<span class="hh__ax-bonus">${fill('wordBonus')} →</span>` : ''}</span></li>`;
  return html`<ul class="hh__sum" role="list" aria-label="${fill('sumLabel', { fy })}" style="--z:${frac(zero)}">
${rows.map(line)}
${axis}
</ul>
<p class="hh__key"><span class="hh__key-tick" aria-hidden="true"></span>${fill('sumKey')}</p>`;
}

// The net block: its label and tag, the large figure and its stamp, the slot the estimate's band will fill, the common
// fiscal year's note, the rows, and the button down to the what-if.
function netBlock(h, figures, fy, sets) {
  const { net } = h.est;
  const sign = signOf(net);
  const stampLabel = fill({ cut: 'stampCut', bonus: 'stampBonus', zero: 'stampZero' }[sign]);
  return html`<section class="hh__net" aria-labelledby="hh-net-h">
<p class="hh__netlab" id="hh-net-h">${fill('netLabel', { fy })} ${estimateTag()}</p>
<div class="hh__netline">
<p class="hh__big">${signed(net)}</p>
<div class="hh__stamp hh__stamp--${sign}">${stamp({ label: stampLabel, ink: sign === 'zero' })}</div>
</div>
<div class="hh__band" data-band></div>
<p class="hh__fy">${fill('fyNote', { fy })}</p>
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
<p class="hh__grp" data-peer-name aria-live="polite"><b>${count(peers.length)}</b> ${group}</p>
</div>
</div>
${missing.length ? html`<div class="wrap hh__pnotes">${missing.map(([mode, , note]) => html`<p class="hh__pnote" id="hh-no-${mode}" data-peer-note hidden>${fill(note)}</p>`)}</div>` : ''}`;
}

function figure(h, { peers, figures, group }, { fy, all }) {
  const head = comparison(fill, 'head', { share: h.est.share, median: figures.net.median, n: peers.length, group });
  return html`<figure class="hh__fig">
<h2 class="hh__head" data-headline>${head}</h2>
<div class="hh__swarm" data-swarm></div>
<figcaption class="hh__cap" data-swarm-note hidden>${fill('swarmCaption', { fy, n: count(peers.length), group, all: count(all) })} <span class="hh__hint">${fill('swarmHint')}</span></figcaption>
<p class="hh__err" data-load-error hidden>${fill('loadError')}</p>
</figure>`;
}

// ---------- the what-if section ----------
function programRow(h, id, figures, ctx) {
  const { name, ab } = PROGRAM[id];
  const listed = inProgram(h.est, id);
  const own = rowDollars(h.est, id, figures).own;
  const value = listed
    ? html`<span class="vh">${fill('rowValue', { fy: ctx.fy })} </span><span class="hh__num">${signed(own)}</span> ${pill({ kind: inkOf(own), label: word(id, own) })}`
    : pill({ kind: 'na', label: fill('notInProgram') });
  return html`<div class="hh__row" data-row="${id}">
<div class="hh__rt">
<h3 class="hh__rh">${name} <span class="hh__ab">${ab}</span></h3>
<p class="hh__rv">${value}</p>
<p class="hh__why">${whyText(fill, h, id, figures[id], ctx).join(' ')}</p>
${deepLink(h, id)}
</div>
<div class="hh__strip" data-strip></div>
</div>`;
}

function whatifSection(h, { peers, figures, group }, { fy }) {
  const ctx = { fy, group };
  const n = peers.length;
  const result = comparison(fill, 'result', { share: h.est.share, median: figures.net.median, n, group });
  return html`<section class="hh__progs" id="whatif" aria-labelledby="whatif-h">
<div class="wrap"><div class="hh__pi">
<div class="hh__sechead">
<div><p class="cap kicker">${fill('whatifKicker')}</p><h2 id="whatif-h">${fill('whatifHeading')}</h2></div>
<p class="hh__lede">${fill('whatifLede', { fy, n: count(n), group })}</p>
</div>
<div class="hh__rows">
${ROWS.map((r) => programRow(h, r.id, figures, ctx))}
<div class="hh__row hh__row--next">
<div class="hh__rt"><h3 class="hh__rh">${fill('nextHeading')}</h3><p class="hh__why">${fill('nextText')}</p></div>
<div class="hh__nextbox" aria-hidden="true"><span>${fill('nextBox')}</span></div>
</div>
<div class="hh__row hh__row--net" data-row="net">
<div class="hh__rt">
<h3 class="hh__rh">${fill('netHeading')}</h3>
<div class="hh__result" data-result aria-live="polite">
<p class="hh__rhd">${fill('resultHead', { fy })} ${estimateTag()}</p>
<p class="hh__rbig">${signed(h.est.net)}</p>
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
const notes = (fy, dollars) => html`<div class="wrap"><div class="hh__notes">
<p>${fill('source', { fy })}${dollars ? html` ${fill('sourceDollars', { fy })}` : ''}</p>
${dollars ? html`<p>${fill('fairness')}</p>` : ''}</div></div>`;

function estimatedBody(h, master, group, { fy, all, sets }) {
  const { peers } = group;
  return html`<article class="hh" data-ccn="${h.ccn}">
${peerRow(h, group)}
<div class="wrap hh__hero">
<div class="hh__money">
${recordCard(h, master, fy)}
${netBlock(h, group.figures, fy, sets)}
</div>
${figure(h, group, { fy, all })}
</div>
${whatifSection(h, group, { fy })}
<div class="wrap"><div class="hh__tbl">
<details class="hh__det" data-peer-table><summary>${fill('tableSummary')} <span>${fill('tableCount', { n: count(peers.length), group: group.group })}</span></summary></details>
</div></div>
${notes(fy, true)}
</article>`;
}

// The page of a hospital with no estimate: the record card, its status and why, and the program pages it has.
function variantBody(h, master, fy) {
  const maryland = h.status === 'maryland';
  const links = ROWS.map((r) => r.id).filter((id) => pageOf(h, id));
  return html`<article class="hh hh--none" data-ccn="${h.ccn}">
<div class="wrap hh__hero">
${recordCard(h, master, fy)}
<div class="hh__none">
<section class="hh__status" aria-labelledby="hh-status-h">
<h2 class="stamp stamp--ink hh__sh" id="hh-status-h">${fill(maryland ? 'statusMaryland' : 'statusNoInputs')}</h2>
<p class="hh__st">${maryland ? fill('statusMarylandText') : fill('statusNoInputsText', { fy })}</p>
</section>
${links.length ? html`<section class="hh__pages" aria-labelledby="hh-pages-h">
<h2 class="h-sm" id="hh-pages-h">${fill('pagesHeading')}</h2>
<ul class="hh__plist" role="list">${links.map((id) => html`<li>${deepLink(h, id)}</li>`)}</ul>
</section>` : ''}
</div>
</div>
${notes(fy, false)}
</article>`;
}

// The page at hospitalPathOf('hub', h.ccn). h: the hospital (hub/model.js hubHospitals); hospitals: every one of them (its
// peers are among them); facts: storyFacts(hospitals) (`n`, the hospitals with an estimate); master: h's hospital master
// record (the Type field's ownership and urban or rural); assets: the build's (the fiscal year is the shell's); robots:
// the page's robots value.
export function hospitalPage({ h, hospitals, facts, assets, robots, master = null }) {
  const fy = String(assets.shell.fy);
  const place = { name: h.name, city: h.city ?? '', state: h.state ?? '' };
  // The page opens on the same-state peers; the dollar rows' scale holds every group's medians (the toggle's).
  const groups = h.est ? PEER_MODES.map((mode) => groupOf(hospitals, h, mode)) : [];
  const group = groups[0] ?? null;
  if (h.est && !group) throw new RangeError(`hub: ${h.ccn} has an estimate but no same-state peers`);
  const sets = groups.filter(Boolean).map((g) => g.figures);
  const description = h.est
    ? fill('description', { ...place, fy, n: count(group.peers.length), group: group.group })
    : fill(h.status === 'maryland' ? 'descriptionMaryland' : 'descriptionNoInputs', h.status === 'maryland' ? place : { ...place, fy });
  return hubPage({
    title: `${fill('title', { ...place, fy })} · ${SITE.name}`,
    description,
    path: hospitalPathOf('hub', h.ccn),
    robots,
    body: h.est ? estimatedBody(h, master, group, { fy, all: facts.n, sets }) : variantBody(h, master, fy),
    assets,
    scripts: h.est ? [assets.js['hub-hospital']] : [],
    preloadFonts: FONTS,
    hospital: { ccn: h.ccn, name: h.name, net: h.est ? h.est.net : null, inTdr: h.inTdr, pages: NOT_BUILT },
  });
}
