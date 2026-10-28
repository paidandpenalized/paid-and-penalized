// The interim Readmissions pages, until Thirty Day Readmissions folds in: /hrrp/, the program's masthead with a summary of
// CMS's FY file across all its hospitals, and /hrrp/hospital/<ccn>/, one slim page for each hospital in that file. They show
// the pinned file's CMS values (the payment adjustment factor, the reduction and the conditions CMS measured) as CMS
// published them, the estimate of the dollars the front page's net uses (a different fiscal year, labeled), and a large link
// to the full explorer there. Server-rendered, no script of their own: the family search and the shell's script are the
// only ones they load. The masthead's styles (hub/styles.css, the .rd__ rules) are shared with the placeholder pages
// (hub/coming.js), so retiring this page for Thirty Day Readmissions' fold-in must keep them.
import { programDek } from '../../web/programs.js';
import { estTag, fillCopy, formField, formTitle, pill } from '../../web/render/components.js';
import { count, decimal, money, pct, shown } from '../../web/render/format.js';
import { html } from '../../web/render/html.js';
import { externalLink } from '../../web/render/layout.js';
import { searchForm } from '../../web/render/shell.js';
import { SITE, hospitalPathOf } from '../../web/site.js';
import { COPY as HOSPITAL } from '../hospital/copy.js';
import { recordSpecs } from '../hospital/page.js';
import { hubPage } from '../parts.js';
import { COPY } from './copy.js';

const fill = (key, values) => fillCopy(COPY, key, values);

// CMS publishes the excess readmission ratio and the payment adjustment factor to four decimal places; the reduction is
// the factor's complement as a percent, so two. (The pinned file keeps more places of a ratio, chosen so that four of them
// print CMS's value.) A ratio of one is the expected number of readmissions: above it is more than expected, and the words
// follow the ratio as printed, so a ratio printed as exactly one is "at or below".
const ERR_DP = 4;
const FACTOR_DP = 4;
const REDUCTION_DP = 2;
const ERR_PAR = 1;

const HRRP = SITE.programs.find((p) => p.id === 'hrrp');
const arrow = html`<span class="ico ico--arrow" aria-hidden="true"></span>`;
// The large link out, to Thirty Day Readmissions (the site, or one hospital's place on it): new tab, rel noopener.
const explorer = (href) => html`<p class="rd__go">${externalLink(href, html`${fill('explorer')} ${arrow}`)}</p>`;

// ---------- /hrrp/ ----------

// The pinned file's hospitals counted: `n` in all, `cut` of them with a payment adjustment factor below one, and their share.
export function summaryOf(tdr) {
  const all = [...tdr.hospitals.values()];
  if (!all.length) throw new RangeError('hub: the Thirty Day Readmissions file has no hospitals');
  const cut = all.filter((r) => r.paf < 1).length;
  return { n: all.length, cut, share: cut / all.length };
}

function summaryCard({ n, cut, share }, fy) {
  const fields = [
    { label: fill('summaryCut'), value: count(cut), size: 'big', note: fill('summaryCutNote', { n: count(n) }) },
    { label: fill('summaryShare'), value: pct(share, 1), size: 'big', note: fill('summaryShareNote') },
    { label: fill('summaryFy'), value: fill('summaryFyValue', { fy }), size: 'big', note: fill('summaryFyNote'), wide: true },
  ];
  return html`<div class="form rd__sum">
${formTitle(fill('summaryTitle', { fy }), fill('summarySource'))}
${fields.map((field, i) => formField({ no: i + 1, ...field }))}
</div>`;
}

// The page. tdr: loadHub().tdr ({ fy, hospitals }); assets: the build's (the hub's fiscal year, the net's, is the shell's);
// robots: the page's robots value.
export function hrrpProgramPage({ tdr, assets, robots }) {
  const fy = String(tdr.fy);
  const summary = summaryOf(tdr);
  const find = searchForm({ id: 'find', src: assets.shell.hubUrl, label: fill('findLabel'), find: fill('findWord'), findRest: fill('findRest'), placeholder: fill('findPlaceholder'), hero: true, hub: true, only: 'hospital' });
  const body = html`<article class="wrap rd rd--program">
<header class="rd__top">
<div class="rd__intro stack">
<p class="cap kicker rd__kicker">${fill('kicker')}</p>
<h1 class="rd__title">${fill('titleLead')} <span class="rd__pen">${fill('titlePen')}</span></h1>
<p class="dek">${programDek('hrrp')}</p>
${find}
${explorer(SITE.tdr.url)}
<p class="rd__note">${fill('explorerNote')}</p>
<p class="rd__note">${fill('fyNote', { fy, hubFy: String(assets.shell.fy) })}</p>
</div>
${summaryCard(summary, fy)}
</header>
</article>`;
  return hubPage({
    title: `${fill('title', { fy })} · ${SITE.name}`,
    description: fill('description', { fy, cut: count(summary.cut), n: count(summary.n) }),
    path: HRRP.path,
    robots,
    body,
    assets,
    program: 'hrrp',
  });
}

// ---------- /hrrp/hospital/<ccn>/ ----------

// A condition's row: its label, eligible discharges, the ratio as CMS published it with the words for which side of one it
// is on (a word, so color is never the only mark), the median of the hospital's peer group (what CMS compares the ratio with)
// and whether CMS counted it toward the reduction (its flag: enough discharges and a ratio above that median, not above one).
// Only a counted row carries the penalty ink. The words are said once for all the rows.
const WORDS = {
  discharges: fill('colDischarges'), ratio: fill('colRatio'), median: fill('colMedian'), counted: fill('colCounted'),
  yes: fill('counted'), no: fill('notCounted'), noMedian: fill('noMedian'),
  above: fill('above', { par: String(ERR_PAR) }), atOrBelow: fill('atOrBelow', { par: String(ERR_PAR) }),
};
function conditionRow(condition, c, median) {
  const side = shown(c.err, ERR_DP) > ERR_PAR ? 'above' : 'atOrBelow';
  const counted = c.flag === 1;
  return html`<tr>
<th scope="row">${condition.label}</th>
<td class="num" data-label="${WORDS.discharges}">${count(c.n)}</td>
<td class="num" data-label="${WORDS.ratio}"><span class="rd__r">${decimal(c.err, ERR_DP)}</span> <span class="rd__w">${WORDS[side]}</span></td>
<td class="num" data-label="${WORDS.median}">${median === null ? WORDS.noMedian : decimal(median, ERR_DP)}</td>
<td data-label="${WORDS.counted}"${counted ? html` class="rd__yes"` : ''}>${counted ? WORDS.yes : WORDS.no}</td>
</tr>
`;
}

// The conditions CMS measured for the hospital (the ones it has, in the file's order of conditions), in a table, with the
// note on what "counted" means. tdr.peerMedians is each peer group's median ratio by condition.
function conditions(record, tdr) {
  const medians = tdr.peerMedians?.[String(record.peer)] ?? {};
  const rows = tdr.conditions.filter((condition) => record.c[condition.key]);
  const fy = String(tdr.fy);
  return html`<section class="rd__cond" aria-labelledby="rd-cond-h">
<h2 class="h-sm" id="rd-cond-h">${fill('conditionsHeading', { fy })}</h2>
<table class="gb rd__tbl">
<caption class="vh">${fill('conditionsCaption', { fy })}</caption>
<thead><tr><th scope="col">${fill('colCondition')}</th><th scope="col" class="num">${WORDS.discharges}</th><th scope="col" class="num">${WORDS.ratio}</th><th scope="col" class="num">${WORDS.median}</th><th scope="col">${WORDS.counted}</th></tr></thead>
<tbody>
${rows.map((condition) => conditionRow(condition, record.c[condition.key], medians[condition.key] ?? null))}</tbody>
</table>
<p class="rd__cnote">${fill('conditionsNote', { par: String(ERR_PAR) })}</p>
</section>`;
}

// The record card: the hospital, where it is and what it is (the hospital page's fields), then CMS's two decisions for the
// year, the factor and the reduction, the second with the word for it.
function recordCard({ view, master, record, fy }) {
  const cut = record.paf < 1;
  const fields = [
    ...recordSpecs(view, master),
    { label: fill('factorLabel', { fy }), value: decimal(record.paf, FACTOR_DP), size: 'big', note: fill('factorNote') },
    { label: fill('reductionLabel'), value: `${decimal(record.red, REDUCTION_DP)}%`, size: 'big', note: html`${pill({ kind: cut ? 'pen' : null, label: fill(cut ? 'wordCut' : 'wordNoCut') })} ${fill('reductionNote')}` },
  ];
  return html`<div class="form hh__card">
${formTitle(fill('recordTitle', { fy }), fillCopy(HOSPITAL, 'recordCcn', { ccn: view.ccn }))}
${fields.map((field, i) => formField({ no: i + 1, ...field }))}
</div>`;
}

// The estimate the front page's net uses, from the dollar file's year: the hospital's Readmissions dollars with the
// estimate tag, or why there are none (not in that year's Readmissions file; no estimate), and the way to its page across
// the programs when it has one. h: the hub hospital, or null for one the dollar file does not have.
function estimate({ h, hubFy, pinFy }) {
  const link = h ? html`<a class="hh__deep" href="${hospitalPathOf('hub', h.ccn)}">${fill('hubLink')}${arrow}</a>` : '';
  // The estimate tag rides with a figure only.
  const tag = html` ${estTag({ href: `${SITE.pages.methods}#estimate`, label: fill('estimateTagLabel'), text: fill('estimateTag') })}`;
  const figured = h?.est?.hrrpListed === true;
  let figure;
  if (figured) {
    const cut = h.est.hrrp < 0;
    figure = html`<div class="hh__netline"><p class="hh__big">${money(h.est.hrrp)}</p>${pill({ kind: cut ? 'pen' : null, label: fill(cut ? 'wordCut' : 'wordNoCut') })}</div>
<p class="hh__fy">${fill('estimateNote', { fy: hubFy, pinFy })}</p>`;
  } else if (h?.est) {
    figure = html`<div class="hh__netline">${pill({ kind: 'na', label: fill('estimateOutPill', { fy: hubFy }) })}</div>
<p class="hh__fy">${fill('estimateOut', { fy: hubFy })}</p>`;
  } else {
    figure = html`<div class="hh__netline"><p class="stamp stamp--ink">${fill('estimateNone')}</p></div>
<p class="hh__fy">${fill(h ? 'estimateNoneWhy' : 'estimateNotInFile', { fy: hubFy })}</p>`;
  }
  return html`<section class="hh__net rd__est" aria-labelledby="rd-est-h">
<p class="hh__netlab" id="rd-est-h">${fill('estimateLabel', { fy: hubFy })}${figured ? tag : ''}</p>
${figure}
${link}
</section>`;
}

// The page of one hospital in the pinned file. record: its pinned record (loadHub().tdr.hospitals); tdr: { fy, conditions };
// master: its hospital master record; h: its hub hospital (hub/model.js hubHospitals), or null when the dollar file does not
// have it (no estimate, and no page across the programs or in hospital-acquired conditions, so the header links none).
export function hrrpHospitalPage({ record, tdr, master, h = null, assets, robots }) {
  const fy = String(tdr.fy);
  const hubFy = String(assets.shell.fy);
  const view = { ccn: record.id, name: master.name, city: master.city, state: master.state, beds: master.beds ?? null, teach: master.teach ?? null };
  const place = view.city && view.state ? `${view.city}, ${view.state}` : view.state ?? view.city ?? '';
  const body = html`<article class="hh rd rd--hospital">
<div class="wrap hh__hero">
<div class="hh__money">
<p class="cap kicker rd__kicker"><a href="${HRRP.path}">${fill('kicker')}</a></p>
${recordCard({ view, master, record, fy })}
${estimate({ h, hubFy, pinFy: fy })}
</div>
<div class="rd__main">
${conditions(record, tdr)}
${explorer(SITE.tdr.hospital(record.id))}
</div>
</div>
<div class="wrap"><div class="hh__notes">
<p>${fill('source', { fy })}</p>
<p>${fill('fairness')}</p>
</div></div>
</article>`;
  return hubPage({
    title: `${place ? fill('titleAt', { name: view.name, place, fy }) : fill('titleBare', { name: view.name, fy })} · ${SITE.name}`,
    description: place ? fill('descriptionAt', { name: view.name, place, fy, hubFy }) : fill('descriptionBare', { name: view.name, fy, hubFy }),
    path: hospitalPathOf('hrrp', record.id, { inTdr: true }),
    robots,
    body,
    assets,
    program: 'hrrp',
    hospital: { ccn: record.id, name: view.name, net: h?.est ? h.est.net : null, inTdr: true, ...(h ? {} : { pages: { hub: false, hacrp: false } }) },
  });
}
