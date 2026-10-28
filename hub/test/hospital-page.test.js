// A hospital's page across the programs (hub/hospital/page.js) on the pinned data, rows picked by property, never by name
// or CCN. Failure messages say what was checked and print no hospital's name, CCN or figure.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { median, peerKey } from '../../engine/js/peers.js';
import { STATE_NAMES } from '../../engine/js/states.js';
import { createContext } from '../../pipeline/site/context.js';
import { ASSETS, chipOf, headerOf, withTemp } from '../../pipeline/test/helpers.js';
import { HAC_CUT_PCT } from '../../web/programs.js';
import { decimal, money, pct } from '../../web/render/format.js';
import { escapeHtml } from '../../web/render/html.js';
import { SITE, hospitalPathOf } from '../../web/site.js';
import { loadHub } from '../data.js';
import { COPY } from '../hospital/copy.js';
import { hospitalPage } from '../hospital/page.js';
import { peerFigures, peersOf } from '../hospital/peers.js';
import { shareText, signedShareText } from '../hospital/text.js';
import { hubHospitals, storyFacts } from '../model.js';
import { generateHub } from '../pages.js';

const HUB = loadHub();
const HOSPITALS = hubHospitals(HUB);
const FACTS = storyFacts(HOSPITALS);
const FY = String(ASSETS.shell.fy);
const esc = (text) => escapeHtml(text);

const pick = (pred, what) => {
  const h = HOSPITALS.find(pred);
  assert.ok(h, `the data has ${what}`);
  return h;
};
const render = (h, robots = null) => hospitalPage({ h, hospitals: HOSPITALS, facts: FACTS, assets: ASSETS, robots, master: HUB.master.get(h.ccn) });
// The page's <main>: the shell's header and footer carry their own figures (the chip's net, the footer's totals).
const mainOf = (page) => page.slice(page.indexOf('<main'), page.indexOf('</main>'));
// The markup of one element, from its opening tag's attribute to its closing tag (the first after it).
const block = (text, attr, close) => {
  const at = text.indexOf(attr);
  return at < 0 ? null : text.slice(text.lastIndexOf('<', at), text.indexOf(close, at) + close.length);
};
const sumRow = (page, id) => block(page, `data-sum="${id}"`, '</li>');
const whatifRow = (page, id) => block(page, `data-row="${id}"`, '<div class="hh__strip" data-strip></div>');
const signed = (x) => money(x, { sign: true });

// The same-state peers and the words the headline compares the net with, computed here from the rule, not the page's code.
function sameState(h) {
  const peers = HOSPITALS.filter((x) => x.est && x.state === h.state);
  return { peers, group: `${STATE_NAMES[h.state]} hospitals`, median: median(peers.map((x) => x.est.share)) };
}
const medianWords = (m) => (m === 0 ? 'no change' : `a ${shareText(m)} ${m < 0 ? 'cut' : 'bonus'}`);

const CUT = pick((h) => h.est && h.est.cut && h.est.net < 0 && h.est.hrrpListed && h.est.vbpListed && h.est.hrrp < 0 && Math.abs(h.est.share) >= 1e-4 && h.inTdr, 'an estimated hospital with a HAC cut and a net cut, in all three programs and in Thirty Day Readmissions');
const NOT_IN_TDR = pick((h) => h.est && !h.inTdr, 'an estimated hospital Thirty Day Readmissions does not have');
const BONUS = pick((h) => h.est && h.est.net > 0 && h.est.vbpListed, 'an estimated hospital with a net bonus');
const ZERO = pick((h) => h.est && h.est.net === 0, 'an estimated hospital with no net change');
const NO_VBP = pick((h) => h.est && !h.est.vbpListed, 'an estimated hospital value-based purchasing does not list');
const NO_HRRP = pick((h) => h.est && !h.est.hrrpListed, 'an estimated hospital Readmissions does not list');
const NO_TEACH = pick((h) => h.est && h.teach === null, 'an estimated hospital with no teaching status');
const MARYLAND = pick((h) => h.status === 'maryland', 'a Maryland hospital');
const NO_INPUTS = pick((h) => h.status === 'no-inputs', 'a hospital with no inputs');

test('an estimated cut hospital: its record, the net with its tag, stamp and fiscal year note, and the rows adding to it', () => {
  const page = render(CUT);
  const main = mainOf(page);
  assert.equal(main.match(/<h1[\s>]/g)?.length, 1, 'one h1');
  assert.ok(main.includes(`<h1 class="field__value hh__name">${esc(CUT.name)}</h1>`), 'the name is the h1, in the record card');
  assert.ok(main.includes(`<span>CCN ${CUT.ccn}</span>`), 'the record card names the CCN');
  assert.ok(main.includes(`<span>Hospital record · FY${FY}</span>`), 'the record card\'s title');
  assert.ok(main.includes(`<p class="field__value">${esc(CUT.city)}, ${CUT.state}</p>`), 'the location');
  assert.ok(main.includes(`<article class="hh" data-ccn="${CUT.ccn}">`), 'the page root names the CCN');
  // The net: its label and the estimate tag, the large figure, the stamp, the band's empty slot and the note.
  assert.ok(main.includes(`Net, three programs, FY${FY} <a class="est-tag" href="/methods/#estimate"`), 'the net\'s label carries the estimate tag');
  assert.ok(main.includes(`<p class="hh__big">${signed(CUT.est.net)}</p>`), 'the net, signed');
  assert.ok(main.includes('<p class="stamp">Net cut</p>'), 'the stamp');
  assert.ok(main.includes('<div class="hh__band" data-band></div>'), 'the band\'s slot, empty at launch');
  assert.ok(!/±/.test(main), 'no ± band');
  assert.ok(main.includes(esc(`All three programs’ FY${FY} figures, the latest year they share. A program’s own pages may show a newer year.`)), 'the common fiscal year note');
  // Three program rows and the net, each signed as money() writes it, with its word and a median tick.
  const rate = pct(HAC_CUT_PCT / 100, 0);
  const want = { hrrp: [CUT.est.hrrp, 'cut'], hacrp: [CUT.est.hac, `${rate} cut`], hvbp: [CUT.est.hvbp, CUT.est.hvbp < 0 ? 'cut' : CUT.est.hvbp > 0 ? 'bonus' : 'no change'], net: [CUT.est.net, 'cut'] };
  for (const [id, [dollars, word]] of Object.entries(want)) {
    const row = sumRow(main, id);
    assert.ok(row, `the ${id} row`);
    assert.ok(row.includes(`<span class="hh__sv">${signed(dollars)}</span><span class="hh__sw">${word}`), `${id}: its signed dollars and word`);
    assert.ok(row.includes('<span class="hh__tick" style="--m:'), `${id}: the peers' median tick`);
  }
  assert.deepEqual([...main.matchAll(/data-sum="(\w+)"/g)].map((m) => m[1]), ['hrrp', 'hacrp', 'hvbp', 'net'], 'the rows in order, the net last');
  assert.ok(main.includes(esc('Median of its peers, scaled to this hospital’s pay')), 'the tick\'s key');
  assert.ok(main.includes('<a class="hh__wbtn" href="#whatif"><span class="ico ico--capsule" aria-hidden="true"></span>What if? Adjust any program</a>'), 'the button down to the what-if');
});

// Each dollar figure's block: the section, what-if row or result box it is in, from that block's start to the figure.
test('every dollar figure on the page says "estimate" in its block, with the fiscal year', () => {
  for (const h of [CUT, BONUS, ZERO, NO_VBP]) {
    const main = mainOf(render(h));
    const starts = [...main.matchAll(/<section\b|<div class="hh__row\b|<div class="hh__result"/g)].map((m) => m.index);
    const figures = [...main.matchAll(/[−+]?\$[\d.,]+[KMB]?/g)];
    assert.ok(figures.length >= 6, 'the page shows its dollar figures');
    for (const m of figures) {
      const start = Math.max(...starts.filter((i) => i < m.index));
      const before = main.slice(start, m.index);
      assert.ok(/estimat/i.test(before), 'a dollar figure says "estimate" in its block');
      assert.ok(before.includes(`FY${FY}`), 'a dollar figure has the fiscal year in its block');
    }
  }
});

test('the headline compares the net share with the same-state median, as median() computes it', () => {
  for (const [h, lead] of [[CUT, (s) => `A ${shareText(s)} net cut`], [BONUS, (s) => `A ${shareText(s)} net bonus`], [ZERO, () => 'No net change']]) {
    const { peers, group, median: m } = sameState(h);
    const of = h.est.net === 0 ? 'in' : 'of';
    const want = `${lead(h.est.share)} ${of} Medicare inpatient pay, against ${medianWords(m)} at the median of ${peers.length.toLocaleString('en-US')} ${group}.`;
    const main = mainOf(render(h));
    assert.ok(main.includes(`<h2 class="hh__head" data-headline>${esc(want)}</h2>`), 'the headline');
    assert.ok(main.includes(`<p class="hh__grp" data-peer-name><b>${peers.length.toLocaleString('en-US')}</b> ${esc(group)}</p>`), 'the peer row names the group');
    assert.ok(main.includes(esc(`(${peers.length.toLocaleString('en-US')} ${group}, alphabetical)`)), 'the peer table\'s summary counts the group');
  }
  // The stamps of a bonus and of no change.
  assert.ok(mainOf(render(BONUS)).includes('<div class="hh__stamp hh__stamp--bonus"><p class="stamp">Net bonus</p></div>'), 'a net bonus\'s stamp');
  assert.ok(mainOf(render(ZERO)).includes('<p class="stamp stamp--ink">No net change</p>'), 'no net change\'s stamp, in ink');
});

test('a share too small for two decimals prints with more, never as 0.00% beside dollars that are not zero', () => {
  assert.equal(shareText(-0.0057), '0.57%');
  assert.equal(shareText(0.00004), '0.004%');
  assert.equal(shareText(-0.0000004), '0.00004%');
  assert.equal(signedShareText(-0.0013), '−0.13%');
  assert.equal(signedShareText(0.0004), '+0.04%');
  assert.equal(signedShareText(0), '0.00%');
});

test('the what-if section: a row per program with its value, pill, why and deep link, the next program\'s row, the net\'s result', () => {
  const main = mainOf(render(CUT));
  const whatif = block(main, 'id="whatif"', '</section>');
  assert.ok(whatif, 'the #whatif section');
  assert.deepEqual([...whatif.matchAll(/data-row="(\w+)"/g)].map((m) => m[1]), ['hrrp', 'hacrp', 'hvbp', 'net'], 'one row per program, then the net');
  const fig = peerFigures(peersOf(HOSPITALS, CUT, 'state'));
  const { peers, group } = sameState(CUT);
  const hrrp = whatifRow(whatif, 'hrrp');
  assert.ok(hrrp.includes(`<span class="vh">Estimated FY${FY}: </span><span class="hh__num">${signed(CUT.est.hrrp)}</span> <span class="pill pill--pen">cut</span>`), 'Readmissions: its value and pill');
  assert.ok(hrrp.includes(`Payment factor ${decimal(CUT.est.hrrpFactor, 4)}. Of the ${peers.length} ${esc(group)}: ${fig.hrrp.cut} with a cut, ${fig.hrrp.none} with no cut`), 'Readmissions: why, with the peer counts');
  assert.ok(hrrp.includes(`Peer median, among those in the program: ${signedShareText(fig.hrrp.median)} of pay.`), 'Readmissions: the peers\' median');
  assert.ok(fig.hrrp.cut + fig.hrrp.none + fig.hrrp.out === peers.length, 'the counts add to the group');
  // The deep links: a built hospital page, or the program's folder while it says "coming".
  assert.ok(hrrp.includes(`<a class="hh__deep" href="${hospitalPathOf('hrrp', CUT.ccn, { inTdr: true })}">Readmissions for this hospital<span class="ico ico--arrow" aria-hidden="true"></span></a>`), 'Readmissions: its interim page');
  // A hospital Thirty Day Readmissions does not have has no such page: the row opens the program's own page, which is not "coming".
  const outside = whatifRow(block(mainOf(render(NOT_IN_TDR)), 'id="whatif"', '</section>'), 'hrrp');
  assert.ok(outside.includes('<a class="hh__deep" href="/hrrp/">Readmissions: program page<span class="ico ico--arrow" aria-hidden="true"></span></a>'), 'Readmissions: the program page for a hospital with none of its own');
  assert.ok(!/hrrp\/hospital\//.test(outside), 'and no interim page link');
  assert.ok(whatifRow(whatif, 'hacrp').includes(`<a class="hh__deep" href="${hospitalPathOf('hacrp', CUT.ccn)}">Hospital-acquired conditions for this hospital<span class="ico ico--arrow" aria-hidden="true"></span></a>`), 'HACRP: its hospital page');
  assert.ok(whatifRow(whatif, 'hacrp').includes(`CMS’s FY${FY} decision: the flat ${pct(HAC_CUT_PCT / 100, 0)} cut.`), 'HACRP: CMS\'s decision');
  assert.ok(whatifRow(whatif, 'hvbp').includes('<a class="hh__deep hh__deep--soon" href="/hvbp/">Value-based purchasing: coming</a>'), 'HVBP: its coming page');
  assert.ok(whatif.includes('<div class="hh__row hh__row--next">') && whatif.includes('Room for the next program'), 'the next program\'s empty row');
  // The net's row: the result in a live region, the standing line, and the two buttons hidden until the script.
  const net = whatifRow(whatif, 'net');
  assert.ok(net.includes('<div class="hh__result" data-result aria-live="polite">'), 'the result is a polite live region');
  assert.ok(net.includes(`<p class="hh__rbig">${signed(CUT.est.net)}</p>`), 'the result\'s net');
  assert.ok(net.includes(esc(`That is a ${shareText(CUT.est.share)} net cut of Medicare inpatient pay; the median of the ${peers.length} ${group} is ${medianWords(sameState(CUT).median)}.`)), 'the result sentence');
  assert.ok(net.includes(esc('A what-if shows the formula’s arithmetic, not what a hospital could realistically change or how. CMS’s real result also depends on other hospitals. This one moves each program’s payment factor; each program’s own pages have the measure-level what-if.')), 'the standing line');
  assert.ok(net.includes('<button type="button" class="hh__lnk" data-match hidden>Match the peer median on all three</button>'), 'match the median: hidden until the script');
  assert.ok(net.includes('<button type="button" class="hh__reset" data-reset hidden>Reset to actual</button>'), 'reset: hidden until the script');
  // No what-if word that judges.
  assert.ok(!/\b(should|failed|could have avoided)\b/i.test(main), 'no word that judges a hospital');
});

test('the hooks the page\'s script uses, its script-only controls hidden, and the source and fairness lines', () => {
  const main = mainOf(render(CUT));
  assert.ok(main.includes('<div class="hh__peers" data-peers>'), 'the peer row');
  const buttons = [...main.matchAll(/<button type="button" class="hh__pb" data-peer="(\w+)" aria-pressed="(true|false)"[^>]*>/g)];
  assert.deepEqual(buttons.map((m) => [m[1], m[2]]), [['state', 'true'], ['size', 'false'], ['teach', 'false']], 'the toggle, same state pressed');
  assert.ok(buttons.every((m) => / hidden>$/.test(m[0])), 'every toggle button hidden until the script');
  assert.ok(main.includes('<div class="hh__swarm" data-swarm></div>'), 'the swarm\'s empty frame');
  assert.ok(main.includes('<figcaption class="hh__cap" data-swarm-note hidden>'), 'the swarm\'s caption, hidden until it draws');
  assert.ok(main.includes(`all ${FACTS.n.toLocaleString('en-US')} hospitals with an estimate`), 'the caption counts every hospital with an estimate');
  assert.ok(main.includes('Hover or tap a dot for its name; click it to open that hospital.'), 'the swarm\'s hint');
  assert.ok(main.includes(`<p class="hh__err" data-load-error hidden>${esc('Couldn’t load the chart data. Reload to try again.')}</p>`), 'the one quiet load-error line, hidden');
  assert.ok(main.includes('<details class="hh__det" data-peer-table><summary>Every peer as a table <span>'), 'the peer table\'s fold');
  assert.ok(main.includes(esc(`Source: CMS FY${FY} program files (HRRP, HACRP, HVBP) and this site’s dollar model. Dollars are estimates of FY${FY} effects on Medicare inpatient pay; percentages are each hospital’s estimated change divided by its estimated Medicare inpatient pay.`)), 'the source line');
  assert.ok(main.includes(esc('A cut is a program’s formula at work, not a verdict on a hospital’s care. Peers are listed alphabetically; nothing on this page ranks hospitals.')), 'the fairness line');
});

test('a program a hospital is not in reads "Not in this program", hatched, never $0', () => {
  for (const [h, id] of [[NO_VBP, 'hvbp'], [NO_HRRP, 'hrrp']]) {
    const main = mainOf(render(h));
    const row = sumRow(main, id);
    assert.ok(row.includes('<span class="hh__out"><span>Not in this program</span></span>'), `${id}: the dollar row is hatched with the words`);
    assert.ok(!row.includes('$') && !row.includes('hh__tick'), `${id}: the dollar row has no dollars and no median tick`);
    const wrow = whatifRow(main, id);
    assert.ok(wrow.includes('<span class="pill pill--na">Not in this program</span>'), `${id}: the what-if row says so`);
    assert.ok(!wrow.includes('$'), `${id}: the what-if row has no dollars`);
    assert.ok(wrow.includes(id === 'hvbp' ? `Not in CMS’s FY${FY} value-based purchasing file.` : `Not in CMS’s FY${FY} Readmissions file.`), `${id}: why`);
  }
});

test('a toggle the hospital has no group for is disabled, with the reason', () => {
  const main = mainOf(render(NO_TEACH));
  assert.equal(peerKey(NO_TEACH, 'teach'), null);
  assert.ok(main.includes('<button type="button" class="hh__pb" data-peer="teach" aria-pressed="false" disabled aria-describedby="hh-no-teach" hidden>Same teaching</button>'), 'same teaching is disabled and described');
  assert.ok(main.includes('<p class="hh__pnote" id="hh-no-teach" data-peer-note hidden>Same teaching: no teaching status on record for this hospital.</p>'), 'the reason');
  assert.ok(!mainOf(render(CUT)).includes('data-peer-note'), 'no note where every group exists');
});

test('Maryland\'s and a no-inputs hospital\'s pages are the variant: record, status and why, program pages; no swarm, no what-if', () => {
  for (const [h, status, text] of [[MARYLAND, 'Not in these programs', 'Maryland’s hospitals are paid under the state’s all-payer model, outside these three programs.'], [NO_INPUTS, 'No estimate', `CMS’s FY${FY} payment file has no usable row for this hospital, so this site can’t price it.`]]) {
    const page = render(h, 'noindex');
    const main = mainOf(page);
    assert.ok(main.includes(`<article class="hh hh--none" data-ccn="${h.ccn}">`), `${status}: the variant's root`);
    assert.ok(main.includes(`<h1 class="field__value hh__name">${esc(h.name)}</h1>`), `${status}: the record card`);
    assert.ok(main.includes(`<h2 class="stamp stamp--ink hh__sh" id="hh-status-h">${status}</h2>`), `${status}: the status`);
    assert.ok(main.includes(esc(text)), `${status}: why`);
    assert.ok(main.includes(`<a class="hh__deep" href="${hospitalPathOf('hacrp', h.ccn)}">`), `${status}: its HACRP page`);
    for (const hook of ['data-swarm', 'id="whatif"', 'data-peers', 'data-headline', 'data-peer-table', 'hh__big']) assert.ok(!main.includes(hook), `${status}: no ${hook}`);
    assert.ok(!/\$/.test(main), `${status}: no dollar figure`);
    assert.ok(page.includes('<meta name="robots" content="noindex">'), `${status}: noindex`);
    assert.ok(chipOf(headerOf(page)) && !chipOf(headerOf(page)).includes('chip__v'), `${status}: the chip names it without a figure`);
  }
});

test('the header follows the hospital: All programs is this page, the chip names it, Readmissions opens its interim page (the program\'s folder when Thirty Day Readmissions lacks the hospital)', () => {
  const page = render(CUT);
  const header = headerOf(page);
  assert.ok(header.includes(`data-hospital="${CUT.ccn}"`), 'the header names the hospital');
  const own = hospitalPathOf('hub', CUT.ccn);
  const tabs = [...header.matchAll(/<a class="tab[^"]*" href="([^"]*)"(?: title="[^"]*")?( aria-current="page")?>/g)].map((m) => [m[1] === own ? 'own' : m[1] === hospitalPathOf('hacrp', CUT.ccn) ? 'hacrp page' : m[1], Boolean(m[2])]);
  const interim = hospitalPathOf('hrrp', CUT.ccn, { inTdr: true });
  const named = tabs.map(([href, current]) => [href === interim ? 'interim page' : href, current]);
  assert.deepEqual(named, [['own', true], ['interim page', false], ['hacrp page', false], ...SITE.programs.slice(2).map((p) => [p.path, false])]);
  const outside = [...headerOf(render(NOT_IN_TDR)).matchAll(/<a class="tab[^"]*" href="([^"]*)"/g)].map((m) => m[1]);
  assert.equal(outside[1] === '/hrrp/', true, 'Readmissions opens its folder for a hospital Thirty Day Readmissions lacks');
  assert.ok(chipOf(header).includes(`<a class="chip__n" href="${own}">`), 'the chip\'s name links this page');
  assert.ok(page.includes(`<link rel="canonical" href="${SITE.origin}${own}">`), 'the canonical address');
  assert.ok(page.includes('/assets/fonts/ibm-plex-mono-700.woff2'), 'the large figure\'s font is preloaded');
  // A hub page: the family search in the bar, and its script.
  assert.ok(header.includes('<form class="omni" id="omni" role="search" aria-label="Search hospitals and states"'), 'the family search in the bar');
  assert.ok(page.includes(`<script type="module" src="${ASSETS.js['hub-search']}"></script>`), 'the family search\'s script');
});

test('the copy holds no word that judges', () => {
  for (const text of Object.values(COPY)) assert.ok(!/\b(should|failed|could have avoided|worst|best)\b/i.test(text), 'a judging word in the copy');
});

test('the hub writes a page for every hospital in the dollar file, each at its address, none with NaN, undefined or Infinity', () =>
  withTemp('pp-hub-hosp-', async (dir) => {
    const base = createContext({ outDir: join(dir, 'a'), env: 'production', assets: ASSETS });
    await generateHub(base, { hospitals: [], master: new Map() });
    const ctx = createContext({ outDir: join(dir, 'b'), env: 'production', assets: ASSETS });
    await generateHub(ctx);
    assert.equal(ctx.pages - base.pages, HUB.dollars.hospitals.length + HUB.tdr.hospitals.size, 'one page per hospital in the dollar file, and one interim Readmissions page per hospital in the pinned file');
    let bad = 0;
    let wrongCanonical = 0;
    for (const h of HOSPITALS) {
      const path = hospitalPathOf('hub', h.ccn);
      const text = readFileSync(join(dir, 'b', path, 'index.html'), 'utf8');
      if (/NaN|undefined|Infinity/.test(text)) bad += 1;
      if (!text.includes(`<link rel="canonical" href="https://paidandpenalized.org/hospital/${h.ccn.toLowerCase()}/">`)) wrongCanonical += 1;
    }
    assert.equal(bad, 0, 'pages with NaN, undefined or Infinity');
    assert.equal(wrongCanonical, 0, 'pages without their canonical address');
    // The hub is not released, so none is indexed, and the sitemap lists none.
    assert.ok(!ctx.indexable.some((p) => p.startsWith('/hospital/')), 'no hospital page indexable while the hub is unreleased');
  }));
