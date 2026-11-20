// A hospital's page across the programs (hub/hospital/page.js) on the pinned data, rows picked by property, never by name
// or CCN. Failure messages say what was checked and print no hospital's name, CCN or figure.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { hospitalScenario } from '../../engine/js/medicaid/hospital.js';
import { median, peerKey } from '../../engine/js/peers.js';
import { STATE_NAMES } from '../../engine/js/states.js';
import { cmsNamed } from '../../pipeline/master.js';
import { build } from '../../pipeline/site/build.js';
import { createContext } from '../../pipeline/site/context.js';
import { textOf } from '../../pipeline/site/html.js';
import { ASSETS, chipOf, headerOf, withTemp } from '../../pipeline/test/helpers.js';
import { COPY as REASON_COPY } from '../../web/medicaid/copy.js';
import { caseShareTexts, shareRange } from '../../web/medicaid/format.js';
import { HAC_CUT_PCT } from '../../web/programs.js';
import { decimal, dollars, money, moneyRange, pct } from '../../web/render/format.js';
import { escapeHtml } from '../../web/render/html.js';
import { BUDGETS, pageWeight } from '../../tools/ci/size-budget.js';
import { LISTED_PROGRAMS, SITE, hospitalPathOf } from '../../web/site.js';
import { hubModel, loadHub } from '../data.js';
import { COPY } from '../hospital/copy.js';
import { placeOf, rangeBox, scaleTicks, scaleTop } from '../hospital/medicaid.js';
import { hospitalPage, outsidePage } from '../hospital/page.js';
import { peerFigures, peersOf } from '../hospital/peers.js';
import { shareText, signedShareText } from '../hospital/text.js';
import { hubHospitals, storyFacts } from '../model.js';
import { HUB as HUB_SITE, generateHub } from '../pages.js';
import { mainOf } from './helpers.js';

const HUB = loadHub();
const HOSPITALS = hubHospitals(HUB);
const { outside: OUTSIDE } = hubModel();
const FACTS = storyFacts(HOSPITALS);
const FY = String(ASSETS.shell.fy);
const esc = (text) => escapeHtml(text);

const pick = (pred, what) => {
  const h = HOSPITALS.find(pred);
  assert.ok(h, `the data has ${what}`);
  return h;
};
const render = (h, robots = null) => hospitalPage({ h, hospitals: HOSPITALS, facts: FACTS, assets: ASSETS, robots, master: HUB.master.get(h.ccn), hrrp: HUB.hrrp, medicaid: HUB.medicaid });
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

const CUT = pick((h) => h.est && h.est.cut && h.est.net < 0 && h.est.hrrpListed && h.est.vbpListed && h.est.hrrp < 0 && Math.abs(h.est.share) >= 1e-4 && h.inHrrp, 'an estimated hospital with a HAC cut and a net cut, in all three programs and in Thirty Day Readmissions');
const NOT_IN_TDR = pick((h) => h.est && !h.inHrrp, 'an estimated hospital the Readmissions site has no page for');
const BONUS = pick((h) => h.est && h.est.net > 0 && h.est.vbpListed, 'an estimated hospital with a net bonus');
const ZERO = pick((h) => h.est && h.est.net === 0, 'an estimated hospital with no net change');
const NO_VBP = pick((h) => h.est && !h.est.vbpListed, 'an estimated hospital value-based purchasing does not list');
const NO_HRRP = pick((h) => h.est && !h.est.hrrpListed, 'an estimated hospital Readmissions does not list');
const NO_TEACH = pick((h) => h.est && h.teach === null, 'an estimated hospital with no teaching status');
const MARYLAND = pick((h) => h.status === 'maryland', 'a Maryland hospital');
const NO_INPUTS = pick((h) => h.status === 'no-inputs', 'a hospital with no inputs');
const NO_INPUTS_CUT = pick((h) => h.status === 'no-inputs' && h.cut, 'a hospital with no inputs that CMS cut');

test('a hospital with no city: the title, the description and the Location field name its state alone', () => {
  for (const [kind, h] of [['estimated', CUT], ['Maryland', MARYLAND], ['no inputs', NO_INPUTS]]) {
    const page = render({ ...h, name: 'Invented General', city: '' });
    assert.ok(page.includes(`<title>Invented General, ${h.state}: Medicare payment programs, FY${FY} · `), `${kind}: the title`);
    const description = /<meta name="description" content="([^"]*)">/.exec(page)[1];
    assert.ok(description.startsWith(kind === 'estimated' ? `Estimated FY${FY} dollars for Invented General in ${h.state}, in ` : `Invented General in ${h.state}${kind === 'Maryland' ? ' ' : ':'}`), `${kind}: the description`);
    assert.ok(mainOf(page).includes(`<p class="field__value">${h.state}</p>`), `${kind}: the Location field`);
  }
});

test('an estimated cut hospital: its record, the net with its tag, stamp and fiscal year note, and the rows adding to it', () => {
  const page = render(CUT);
  const main = mainOf(page);
  assert.equal(main.match(/<h1[\s>]/g)?.length, 1, 'one h1');
  assert.ok(main.includes(`<h1 class="field__value hh__name">${esc(CUT.name)}</h1>`), 'the name is the h1, in the record card');
  assert.ok(main.includes(`<span>CCN ${CUT.ccn}</span>`), 'the record card names the CCN');
  assert.ok(main.includes(`<span>Hospital record · FY${FY}</span>`), 'the record card\'s title');
  assert.ok(main.includes(`<p class="field__value">${esc(CUT.city)}, ${CUT.state}</p>`), 'the location');
  assert.ok(main.includes(`<article class="hh" data-ccn="${CUT.ccn}">`), 'the page root names the CCN');
  // The net: its label and the estimate tag, the large figure, the stamp, its likely range and the note.
  assert.ok(main.includes(`Net, three programs, FY${FY} <a class="est-tag" href="/methods/#estimate"`), 'the net\'s label carries the estimate tag');
  assert.ok(main.includes(`<p class="hh__big">${signed(CUT.est.net)}</p>`), 'the net, signed');
  assert.ok(main.includes('<p class="stamp">Net cut</p>'), 'the stamp');
  // The likely range is the back-test's net band for the hospital's group (as the HACRP pages give it), in dollars, the
  // estimate inside it, with its key linked to the back-test.
  const row = HUB.dollars.hospitals.find((r) => r.ccn === CUT.ccn);
  const band = row.stratum === 'all' ? HUB.dollars.bands.measures.net.overall : HUB.dollars.bands.measures.net.strata.find((s) => s.stratum === row.stratum);
  const ends = [Math.round(CUT.est.net * band.high), Math.round(CUT.est.net * band.low)];
  assert.deepEqual(CUT.netRange, ends, 'the net times its group\'s two multipliers, low end first');
  assert.ok(ends[0] <= CUT.est.net && CUT.est.net <= ends[1], 'the estimate inside its range');
  const rng = block(main, 'class="hh__rng"', '</p>');
  assert.ok(rng.includes(`<a class="hh__rng-k" href="/hacrp/methods/#backtest">Likely range</a> <span class="hh__rng-v">${esc(moneyRange(...ends))}</span>`), 'the range as the HACRP pages print one, linked to the back-test');
  // A range so narrow that rounding would print both ends alike is printed in whole dollars.
  const narrow = pick((h) => h.netRange && money(h.netRange[0]) === money(h.netRange[1]), 'a hospital whose range rounds to one figure');
  assert.ok(mainOf(render(narrow)).includes(`<span class="hh__rng-v">${esc(`${dollars(narrow.netRange[0])} to ${dollars(narrow.netRange[1])}`)}</span>`), 'whole dollars');
  assert.ok(main.includes('<div class="hh__band" data-band><p class="hh__rng">'), 'in the band\'s slot');
  assert.ok(!/±|%/.test(rng), 'dollars only: no ± and no percent');
  // A net of $0 has no range to show: the slot stays empty.
  assert.ok(mainOf(render(ZERO)).includes('<div class="hh__band" data-band></div>'), 'no range for a net of $0');
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

test('the what-if section: a row per program with its value, pill, why and deep link, then the net\'s result', () => {
  const main = mainOf(render(CUT));
  const whatif = block(main, 'id="whatif"', '</section>');
  assert.ok(whatif, 'the #whatif section');
  assert.deepEqual([...whatif.matchAll(/data-row="(\w+)"/g)].map((m) => m[1]), ['hrrp', 'hacrp', 'hvbp', 'net'], 'one row per program, then the net');
  const fig = peerFigures(peersOf(HOSPITALS, CUT, 'state'));
  const { peers, group } = sameState(CUT);
  const hrrp = whatifRow(whatif, 'hrrp');
  assert.ok(hrrp.includes(`<span class="vh">Estimated FY${FY}: </span><span class="hh__num">${signed(CUT.est.hrrp)}</span> <span class="pill pill--pen">cut</span>`), 'Readmissions: its value and pill');
  assert.ok(hrrp.includes(`FY${FY} payment factor ${decimal(CUT.est.hrrpFactor, 4)}. Of the ${peers.length} ${esc(group)}: ${fig.hrrp.cut} with a cut, ${fig.hrrp.none} with no cut`), 'Readmissions: why, with the fiscal year beside the factor and the peer counts');
  // Its Readmissions page shows CMS's newer file's factor: the row names it, its year, and why this page's differs.
  const record = HUB.hrrp.hospitals.get(CUT.ccn);
  assert.ok(hrrp.includes(esc(`Its Readmissions page shows CMS’s FY${HUB.hrrp.fy} factor, ${decimal(record.paf, 4)}. This page uses FY${FY}’s, the latest year all three programs share.`)), 'Readmissions: the other year\'s factor and why');
  // The HAC row counts the peers CMS didn't score and decide apart (cut or not), so its counts are the HACRP pages' own.
  const hac = whatifRow(whatif, 'hacrp');
  assert.equal(fig.hacrp.cut, peers.filter((x) => x.decided && x.est.cut).length, 'cut: the decided peers CMS cut, as the HACRP pages count them');
  assert.equal(fig.hacrp.cut + fig.hacrp.none + fig.hacrp.unscored + fig.hacrp.unscoredCut, peers.length, 'the HAC counts add to the group');
  assert.equal(fig.hacrp.unscored, peers.filter((x) => !x.decided && !x.est.cut).length, 'unscored: the peers CMS did not score and decide, no cut');
  assert.equal(fig.hacrp.unscoredCut, peers.filter((x) => !x.decided && x.est.cut).length, 'unscoredCut: those CMS cut all the same');
  assert.ok(hac.includes(`${fig.hacrp.cut} with the ${pct(HAC_CUT_PCT / 100, 0)} cut, ${fig.hacrp.none} with no cut`), 'HACRP: the peer counts');
  if (fig.hacrp.unscored) assert.ok(hac.includes(esc(`, ${fig.hacrp.unscored} that CMS didn’t score`)), 'HACRP: the unscored peers');
  // A group holding a hospital CMS cut without a score says it was cut.
  const odd = pick((h) => h.est && h.cut && !h.decided, 'an estimated hospital CMS cut without a score');
  const oddFig = peerFigures(peersOf(HOSPITALS, odd, 'state')).hacrp;
  assert.ok(oddFig.unscoredCut >= 1);
  assert.ok(whatifRow(block(mainOf(render(odd)), 'id="whatif"', '</section>'), 'hacrp').includes(`${oddFig.unscoredCut} with the ${pct(HAC_CUT_PCT / 100, 0)} cut but no score`), 'said as cut');
  // A hospital with a Readmissions page that FY's file did not list: its own words for the other year's factor.
  // (A real one when the data has it; otherwise one made from a listed hospital, so the line is always checked.)
  const listedTdr = pick((h) => h.est && h.inHrrp && h.est.hrrpListed && Number.isFinite(HUB.hrrp.hospitals.get(h.ccn)?.paf), 'a hospital with a Readmissions page');
  const out = HOSPITALS.find((h) => h.est && h.inHrrp && !h.est.hrrpListed && Number.isFinite(HUB.hrrp.hospitals.get(h.ccn)?.paf))
    ?? { ...listedTdr, est: { ...listedTdr.est, hrrpListed: false } };
  assert.ok(whatifRow(block(mainOf(render(out)), 'id="whatif"', '</section>'), 'hrrp').includes(esc(`This page uses FY${FY}, the latest year all three programs share, whose file did not list it.`)), 'the unlisted hospital\'s year line');
  // A hospital FY's file listed that the newer file doesn't (so no Readmissions page): the row says why it has none.
  // (A real one when the data has it; otherwise one made from a listed hospital.)
  const gone = HOSPITALS.find((h) => h.est && !h.inHrrp && h.est.hrrpListed) ?? { ...listedTdr, inHrrp: false };
  assert.ok(whatifRow(block(mainOf(render(gone)), 'id="whatif"', '</section>'), 'hrrp').includes(esc(`CMS’s FY${HUB.hrrp.fy} Readmissions file doesn’t list it, so it has no Readmissions page here.`)), 'the year line of a hospital the newer file dropped');
  assert.ok(!whatifRow(block(mainOf(render(NOT_IN_TDR.est.hrrpListed ? { ...NOT_IN_TDR, est: { ...NOT_IN_TDR.est, hrrpListed: false } } : NOT_IN_TDR)), 'id="whatif"', '</section>'), 'hrrp').includes('Readmissions file doesn’t list it'), 'and none for a hospital neither file lists');
  assert.ok(hac.includes(esc('The HAC pages count only the hospitals CMS scored with a payment decision, with or without an estimate here.')), 'HACRP: why its pages count differently');
  assert.ok(hrrp.includes(`Peer median, among those in CMS’s file: ${signedShareText(fig.hrrp.median)} of pay.`), 'Readmissions: the peers\' median, among those its file lists');
  assert.ok(fig.hrrp.cut + fig.hrrp.none + fig.hrrp.out === peers.length, 'the counts add to the group');
  // The deep links: a built hospital page, or the program's folder, which holds its placeholder page (page not built yet).
  assert.ok(hrrp.includes(`<a class="hh__deep" href="${hospitalPathOf('hrrp', CUT.ccn, { inHrrp: true })}">Readmissions for this hospital<span class="ico ico--arrow" aria-hidden="true"></span></a>`), 'Readmissions: its page');
  // A hospital without a Readmissions page has no such page: the row opens the program's own page, not a placeholder.
  const outside = whatifRow(block(mainOf(render(NOT_IN_TDR)), 'id="whatif"', '</section>'), 'hrrp');
  assert.ok(outside.includes('<a class="hh__deep" href="/hrrp/">Readmissions: program page<span class="ico ico--arrow" aria-hidden="true"></span></a>'), 'Readmissions: the program page for a hospital with none of its own');
  assert.ok(!/hrrp\/hospital\//.test(outside), 'and no hospital page link');
  assert.ok(whatifRow(whatif, 'hacrp').includes(`<a class="hh__deep" href="${hospitalPathOf('hacrp', CUT.ccn)}">Hospital-acquired conditions for this hospital<span class="ico ico--arrow" aria-hidden="true"></span></a>`), 'HACRP: its hospital page');
  assert.ok(whatifRow(whatif, 'hacrp').includes(`CMS’s FY${FY} decision: the flat ${pct(HAC_CUT_PCT / 100, 0)} cut.`), 'HACRP: CMS\'s decision');
  assert.ok(whatifRow(whatif, 'hvbp').includes('<a class="hh__deep hh__deep--soon" href="/hvbp/">Value-based purchasing: page under construction</a>'), 'HVBP: its placeholder page');
  // No empty row waits for another program: the net's row follows the last program's.
  assert.ok(!whatif.includes('hh__row--next') && !whatif.includes('hh__nextbox'), 'no empty row for another program');
  assert.match(whatif, /data-row="hvbp">[\s\S]*?<\/div>\n<\/div>\n<div class="hh__row hh__row--net" data-row="net">/, 'the net\'s row comes straight after the last program\'s');
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
  assert.ok(main.includes(`<p>${esc('A cut is a program’s formula at work, not a verdict on a hospital’s care.')}</p>`), 'the fairness line, whole');
});

// Scripts off, nothing offers what needs them (hub/styles.css's (scripting: none) block hides the button and the what-if's
// words): the section has a heading for what it shows, and a line says what needs JavaScript, here and under the headline.
test('scripts off, the page offers no what-if it cannot run: the section headed by what it shows, and what needs JavaScript said', () => {
  const main = mainOf(render(CUT));
  assert.ok(main.includes('<h2 id="whatif-h"><span class="hh__js">What if? Adjust any program</span> <span class="hh__nojs">Every program, among its peers</span></h2>'), 'the what-if heading, or (scripts off) the kicker\'s words');
  assert.ok(main.includes(`<p class="hh__noscript">${esc('The what-if needs JavaScript. Without it, the figures below stay as they are.')}</p>`), 'the what-if\'s line');
  assert.ok(main.includes('<h2 class="hh__head" data-headline>') && main.includes(`<p class="hh__noscript">${esc('The chart of its peers needs JavaScript. The rows below compare this hospital with them in words.')}</p>\n<div class="hh__swarm" data-swarm>`), 'the chart\'s line, under the headline');
  const css = readFileSync(join(import.meta.dirname, '..', 'styles.css'), 'utf8');
  const off = /@media \(scripting: none\) \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
  assert.match(off, /\.hh__wbtn, \.hh__js, \.hh__sechead \.kicker \{ display: none; \}/, 'the button, the what-if\'s words and the kicker go');
  assert.match(off, /\.hh__nojs \{ display: inline; \}/);
  assert.match(css, /^\.hh__nojs, \.hh__noscript \{ display: none; \}$/m, 'and show only then');
});

// The record's Type field wraps between its items, each "·" at the end of a line, never at the start of one.
test('the Type field holds each "·" to the item before it', () => {
  const h = pick((x) => x.est && x.teach && Number.isInteger(x.beds), 'an estimated hospital with a teaching status and a bed count');
  const main = mainOf(render(h));
  const type = /<p class="field__value field__value--sm">([^<]*)<\/p>/.exec(main)?.[1];
  assert.ok(type && type.includes('\u00a0· '), 'the items joined, each dot after a no-break space');
  assert.ok(!type.includes(' · '), 'never a breakable space before a dot');
});

// The strips' and the dollar rows' median ticks' glides take their length and curve from the page's script, which times
// the same moves (strips.js setGlide): the stylesheet keeps no second copy that could drift from it.
test('the stylesheet\'s glides read their length and curve from the page\'s script, never a copy of them', () => {
  const css = readFileSync(join(import.meta.dirname, '..', 'styles.css'), 'utf8');
  const glides = css.split('\n').filter((line) => /^\.(st--live :is|hh--live \.hh__tick)\b/.test(line));
  assert.equal(glides.length, 2, 'the strips\' glide and the ticks\'');
  for (const line of glides) {
    const transition = /transition: ([^;]+);/.exec(line)?.[1] ?? '';
    assert.match(transition, /var\(--glide\)/, line);
    assert.doesNotMatch(transition, /\d(ms|s)\b|cubic-bezier/, `${line}: no length or curve written here`);
  }
});

test('the dollar rows: a note that each figure is rounded shows only where the rows, as printed, miss the net', () => {
  // A printed amount as dollars, read from the page ("−$41K" is -41000), independent of the page's own check.
  const unit = { '': 1, K: 1e3, M: 1e6, B: 1e9 };
  const printed = (t) => { const [, m, b, u] = /^(−?)\+?\$([\d.]+)([KMB]?)$/.exec(t); return (m ? -1 : 1) * Math.round(Number(b) * unit[u]); };
  const rowsOf = (page) => Object.fromEntries([...page.matchAll(/data-sum="(\w+)">[\s\S]*?<span class="hh__sv">([^<]*)<\/span>/g)].map((m) => [m[1], printed(m[2])]));
  const note = (page) => /<p class="hh__round" data-sum-round( hidden)?>([^<]*)<\/p>/.exec(page);
  // A reader's check: the printed rows added up, then printed as the page prints dollars, against the printed net (so
  // "−$205K" and "+$2.0M" make the "+$1.8M" they sit beside).
  const misses = (page) => { const r = rowsOf(page); return money(Object.entries(r).filter(([k]) => k !== 'net').reduce((s, [, v]) => s + v, 0)) !== money(r.net); };
  const MISS = pick((h) => h.est && misses(render(h)), 'an estimated hospital whose rows, as printed, miss its net');
  for (const [h, miss] of [[CUT, misses(render(CUT))], [MISS, true]]) {
    const n = note(mainOf(render(h)));
    assert.ok(n, 'the note is on the page');
    assert.equal(n[1] === undefined, miss, miss ? 'shown where the rows miss the net' : 'hidden where they add up');
    assert.equal(n[2], 'Each figure is rounded on its own, so the programs’ rows may not add exactly to the net.');
  }
});

test('a program a hospital is not in reads "Not in this program" (Readmissions, whose file not listing it doesn\'t say that: "Not in CMS\'s file"), hatched, never $0', () => {
  for (const [h, id] of [[NO_VBP, 'hvbp'], [NO_HRRP, 'hrrp']]) {
    const main = mainOf(render(h));
    const row = sumRow(main, id);
    const words = id === 'hrrp' ? 'Not in CMS’s file' : 'Not in this program';
    assert.ok(row.includes(`<span class="hh__out"><span>${words}</span></span>`), `${id}: the dollar row is hatched with the words`);
    assert.ok(!row.includes('$') && !row.includes('hh__tick'), `${id}: the dollar row has no dollars and no median tick`);
    const wrow = whatifRow(main, id);
    assert.ok(wrow.includes(`<span class="pill pill--na">${words}</span>`), `${id}: the what-if row says so`);
    if (id === 'hrrp') assert.doesNotMatch(row + wrow, /not in (this|the) program/i, 'Readmissions\' rows never say it is outside the program');
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
  for (const [h, status, text] of [[MARYLAND, 'Not adjusted', 'Maryland’s hospitals are paid under the state’s all-payer model, so these three programs don’t adjust their pay. The hospital-acquired conditions program still scores them.'], [NO_INPUTS, 'No estimate', `CMS’s FY${FY} payment file has no usable row for this hospital, so this site can’t price it.`]]) {
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
  // Without an estimate, a no-inputs page still says what CMS decided in the HAC program, cut or not; Maryland's says
  // nothing of it (exempt).
  const decision = (h) => mainOf(render(h, 'noindex'));
  assert.ok(decision(NO_INPUTS_CUT).includes(esc(`CMS’s FY${FY} hospital-acquired conditions decision: the flat ${pct(HAC_CUT_PCT / 100, 0)} cut. This site has no dollar estimate of it.`)), 'no inputs, cut: CMS cut it');
  const uncut = pick((h) => h.status === 'no-inputs' && !h.cut, 'a hospital with no inputs that CMS did not cut');
  assert.ok(decision(uncut).includes(esc(`CMS’s FY${FY} hospital-acquired conditions decision: no cut.`)), 'no inputs, not cut');
  assert.ok(!decision(MARYLAND).includes('hospital-acquired conditions decision'), 'Maryland: no decision line');
});

test('the header follows the hospital: All programs is this page, the chip names it, Readmissions opens its Readmissions page (the program\'s folder when the hospital has none)', () => {
  const page = render(CUT);
  const header = headerOf(page);
  assert.ok(header.includes(`data-hospital="${CUT.ccn}"`), 'the header names the hospital');
  const own = hospitalPathOf('hub', CUT.ccn);
  const tabs = [...header.matchAll(/<a class="tab[^"]*" href="([^"]*)"(?: title="[^"]*")?( aria-current="page")?>/g)].map((m) => [m[1] === own ? 'own' : m[1] === hospitalPathOf('hacrp', CUT.ccn) ? 'hacrp page' : m[1], Boolean(m[2])]);
  const readmissions = hospitalPathOf('hrrp', CUT.ccn, { inHrrp: true });
  const named = tabs.map(([href, current]) => [href === readmissions ? 'its Readmissions page' : href, current]);
  assert.deepEqual(named, [['own', true], ['its Readmissions page', false], ['hacrp page', false], ...LISTED_PROGRAMS.slice(2).map((p) => [p.path, false])]);
  const outside = [...headerOf(render(NOT_IN_TDR)).matchAll(/<a class="tab[^"]*" href="([^"]*)"/g)].map((m) => m[1]);
  assert.equal(outside[1] === '/hrrp/', true, 'Readmissions opens its folder for a hospital without a Readmissions page');
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

test('the hub writes a page for every hospital in the master, each at its address, none with NaN, undefined or Infinity', () =>
  withTemp('pp-hub-hosp-', async (dir) => {
    const base = createContext({ outDir: join(dir, 'a'), env: 'production', assets: ASSETS });
    await generateHub(base, { hospitals: [], master: new Map() });
    const ctx = createContext({ outDir: join(dir, 'b'), env: 'production', assets: ASSETS });
    await generateHub(ctx, { released: true });
    assert.equal(ctx.pages - base.pages, HUB.dollars.hospitals.length + OUTSIDE.length, 'one page per hospital in the master');
    let bad = 0;
    let wrongCanonical = 0;
    // The TEAM section: on every participant's page (CMS's TEAM list, as the TEAM file has it), on no other.
    let teamWrong = 0;
    for (const h of [...HOSPITALS, ...OUTSIDE]) {
      const path = hospitalPathOf('hub', h.ccn);
      const text = readFileSync(join(dir, 'b', path, 'index.html'), 'utf8');
      if (/NaN|undefined|Infinity/.test(text)) bad += 1;
      if (!text.includes(`<link rel="canonical" href="https://paidandpenalized.org/hospital/${h.ccn.toLowerCase()}/">`)) wrongCanonical += 1;
      if (text.includes('data-team') !== HUB.team.participants.has(h.ccn)) teamWrong += 1;
    }
    assert.equal(bad, 0, 'pages with NaN, undefined or Infinity');
    assert.equal(wrongCanonical, 0, 'pages without their canonical address');
    assert.equal(teamWrong, 0, 'pages with the TEAM section that aren\'t a participant\'s, or a participant\'s without it');
    // The hub released: every page is indexed but one with no inputs (it has no figures) and one for a hospital no CMS
    // file names.
    const indexed = ctx.indexable.filter((p) => p.startsWith('/hospital/')).length;
    assert.equal(indexed, HOSPITALS.filter((h) => h.status !== 'no-inputs').length + OUTSIDE.filter((h) => cmsNamed(h.name, h.ccn)).length, 'hospital pages indexable');
  }));

test('a hospital whose Medicare agreement ended before or during the year carries the note on its net (no estimate: under its status); one still in Medicare carries none', () => {
  const fy = Number(FY);
  const ended = (h, from, to) => { const d = HUB.master.get(h.ccn).inactive?.date; return d != null && d >= from && d <= to; };
  const before = pick((h) => h.est && h.est.net < 0 && ended(h, '0000-01-01', `${fy - 1}-09-30`), 'an estimated net cut whose agreement ended before the year');
  const during = pick((h) => h.est && h.est.net !== 0 && ended(h, `${fy - 1}-10-01`, `${fy}-09-30`), 'an estimated hospital whose agreement ended during the year');
  const none = pick((h) => !h.est && ended(h, '0000-01-01', `${fy}-09-30`), 'a hospital with no estimate whose agreement ended');
  const note = (page) => /<p class="hh__closed">(.*?)<\/p>/.exec(mainOf(page))?.[1] ?? null;
  const closed = (page) => note(page)?.replace(/<[^>]*>/g, '') ?? null;
  assert.match(closed(render(before)), new RegExp(`under CCN ${before.ccn} as ended on .*, before FY${FY} began\\. .*cut is unlikely to have been collected\\. This site keeps it in its totals\\.$`));
  // The tail on what the net likely was is a span of its own, for the what-if to hide; the sentence on the end date is not.
  assert.match(note(render(before)), new RegExp(`began\\. It was not paid under this ID in FY${FY}<span class="hh__closed-tail">, so its estimated cut is unlikely to have been collected</span>\\. This site`));
  assert.match(closed(render(during)), new RegExp(`, during FY${FY}\\. It was not paid under this ID after that, so only part of its estimated (cut|bonus) is likely`));
  const page = render(none);
  assert.ok(page.indexOf('class="hh__closed"') > page.indexOf('class="hh__status"'), 'under its status');
  assert.doesNotMatch(closed(page), /estimated/, 'no estimate to qualify');
  assert.doesNotMatch(note(page), /hh__closed-tail/, 'and no tail to hide');
  assert.ok(HOSPITALS.filter((h) => ended(h, '0000-01-01', `${fy}-09-30`)).every((h) => closed(render(h)) !== null), 'every such hospital');
  assert.equal(closed(render(pick((h) => h.est && !HUB.master.get(h.ccn).inactive, 'an estimated hospital still in Medicare'))), null, 'and no other');
});

test('a net one program makes alone shows that program\'s likely range: the HAC cut alone shows the HAC range the HACRP page shows', () => {
  const alone = pick((h) => h.est && h.est.hac < 0 && h.est.hrrp === 0 && h.est.hvbp === 0, 'an estimated hospital whose net is its HAC cut alone');
  const [lo, hi] = alone.netRange;
  assert.ok(lo < alone.est.net && alone.est.net < hi && hi < 0);
  assert.ok(mainOf(render(alone)).includes(`<span class="hh__rng-v">${moneyRange(lo, hi)}</span>`));
});

// ---------- the Medicaid work-requirement band (hospital/medicaid.js) ----------
const WR = HUB.medicaid;
const renderWr = (h) => hospitalPage({ h, hospitals: HOSPITALS, facts: FACTS, assets: ASSETS, robots: null, master: HUB.master.get(h.ccn), hrrp: HUB.hrrp, medicaid: WR });
// The page with the scenario file holding no row for h (medicaidBand's no-band case).
const renderNoRow = (h) => hospitalPage({ h, hospitals: HOSPITALS, facts: FACTS, assets: ASSETS, robots: null, master: HUB.master.get(h.ccn), hrrp: HUB.hrrp, medicaid: { ...WR, hospitals: new Map([...WR.hospitals].filter(([ccn]) => ccn !== h.ccn)) } });
const wrBand = (page) => /<section class="hh__wb"[\s\S]*?<\/section>\n/.exec(page)?.[0] ?? null;
const wrOf = (h) => hospitalScenario(WR, h.ccn);
const wrCol = Object.fromEntries(WR.columns.map((name, i) => [name, i]));
const IN_FILE = HOSPITALS.filter((h) => wrOf(h));
// Five estimated hospitals with a loss to draw, spread through the dollar file's order.
const DRAWN = HOSPITALS.filter((h) => h.est && wrOf(h)?.shares);
const FIVE = [0, 1, 2, 3, 4].map((i) => DRAWN[Math.floor((i * (DRAWN.length - 1)) / 4)]);

test('the Medicaid band sits after the what-if, apart from the net: taking it out leaves the page without it, byte for byte', () => {
  assert.equal(new Set(FIVE.map((h) => h.ccn)).size, 5, 'five different hospitals');
  for (const h of FIVE) {
    const page = renderWr(h);
    const band = wrBand(page);
    assert.ok(band, 'the band');
    assert.equal(page.replace(band, ''), renderNoRow(h), 'everything else, the net and its rows included, is the page without the band');
    assert.ok(page.indexOf(band) > page.indexOf('<section class="hh__progs" id="whatif"'), 'after the what-if');
    assert.ok(page.indexOf(band) > page.indexOf('</section>', page.indexOf('<section class="hh__progs"')), 'outside it');
    assert.ok(page.indexOf(band) < page.indexOf('data-peer-table'), 'before the peer table');
    assert.ok(band.includes('Medicaid scenario (not a payment)'), 'named a scenario, not a payment');
    assert.ok(band.includes(esc('never added to the Medicare net above')), 'and never added to the net');
    // Its dollars (Dalton's review 11-11) are the scenario's own, in its dollar line and its middle case alone: no
    // Medicare dollar is repeated in it, and nothing in it is summed with the net (the page without it is byte for byte).
    const dollarsIn = band.replace(/<p class="hh__wbd">[^<]*<\/p>/, '').replace(/<li class="hh__wbk--mid">[^<]*<\/li>/, '');
    assert.doesNotMatch(dollarsIn, /\$\d/, 'no dollar figure outside the scenario\'s dollar line and middle case');
    assert.doesNotMatch(band, /<script|<button|data-row|data-sum/, 'no script, control or hook the page\'s script reads');
  }
});

test('the band for a hospital with a loss to draw: the work-requirement page\'s shares at the default use rate (the file\'s own middle case), a range, the tag, the bar and the link', () => {
  for (const h of FIVE) {
    const band = wrBand(renderWr(h));
    const { shares } = wrOf(h);
    const row = WR.hospitals.get(h.ccn);
    assert.equal(shares[1], row[wrCol.middle_lost] / row[wrCol.net_patient_revenue], 'the middle case is the file\'s');
    assert.ok(shares[0] < shares[1] && shares[1] < shares[2], 'low < middle < high');
    const [lo, mid, hi] = caseShareTexts(shares);
    assert.deepEqual(shareRange(shares), { low: lo, high: hi }, 'these print as two numbers');
    assert.ok(band.includes(`<p class="hh__wbv">${lo} to ${hi}</p>`), 'the headline is the range, low to high');
    assert.ok(band.includes(`<p class="hh__wbscale">${esc('Square-root scale, the same on every hospital’s page')}</p>`), 'the scale named under its axis');
    assert.ok(band.includes(`<span class="scen-tag">SCENARIO · ${WR.fy} $</span>`), 'the scenario tag');
    // The dollars: the same cases' Medicaid revenue lost at the default use rate, each step 4's string without its minus.
    const lost = wrOf(h).lost.map((x) => money(x));
    assert.equal(wrOf(h).lost[1], row[wrCol.middle_lost], 'the middle case\'s dollars are the file\'s');
    assert.ok(band.includes(`<p class="hh__wbd">${lost[0]} to ${lost[2]} a year, in ${WR.fy} dollars</p>`), 'the dollar line under the range');
    assert.ok(band.indexOf('class="hh__wbd"') > band.indexOf('class="hh__wbv"') && band.indexOf('class="hh__wbd"') < band.indexOf('class="hh__wbbar"'), 'under the headline, over the bar');
    assert.ok(band.includes(`<li>Low case ${lo}</li><li class="hh__wbk--mid">Middle case ${mid} · ${lost[1]}</li><li>High case ${hi}</li>`), 'the three cases, the middle with its dollars');
    assert.match(band, /<svg class="hh__wbsvg" viewBox="0 0 1000 28" preserveAspectRatio="none" aria-hidden="true"/, 'the server\'s drawing');
    assert.match(band, /<rect class="hh__wb-band" x="[\d.]+" y="7" width="[\d.]+" height="14"\/><line class="hh__wb-mid" x1="[\d.]+"/, 'the range and the middle case\'s mark');
    assert.ok(band.includes(`<a class="hh__deep" href="/work-requirement/?h=${h.ccn}">`), 'the link to the hospital on the work-requirement page');
    assert.ok(!/NaN|undefined|Infinity/.test(band), 'no bad number');
  }
  // The scale every band shares: its top over the file's highest high case, its places square-root.
  const top = scaleTop(WR);
  const highest = Math.max(...[...WR.hospitals.keys()].map((ccn) => hospitalScenario(WR, ccn).shares?.[2] ?? 0));
  assert.ok(highest <= top && top - highest < 0.01, 'the top is the highest share, up to the next whole percent');
  assert.equal(placeOf(top / 4, top), 0.5, 'a quarter of the top sits halfway');
  assert.deepEqual(scaleTicks(0.14), [0, 0.005, 0.01, 0.02, 0.05, 0.1]);
});

test('Maryland\'s page: the band says "Not modeled" and why, with no number', () => {
  const band = wrBand(renderWr(MARYLAND));
  assert.equal(wrOf(MARYLAND).reason, 'all_payer');
  assert.ok(band.includes('<p class="stamp stamp--ink">Not modeled</p>'), 'the stamp');
  assert.ok(band.includes(esc(REASON_COPY.why_all_payer.text)), 'the work-requirement page\'s reason');
  assert.ok(band.includes(esc('The work-requirement pages model the Medicaid revenue a hospital could lose: not a payment.')), 'its note promises no scenario and names no net (the page has none)');
  assert.doesNotMatch(band, /A scenario of what/, 'no promise of a scenario');
  assert.doesNotMatch(band, /%|\$|<svg|hh__wbv|scen-tag/, 'no number, bar or tag');
  assert.ok(band.includes(`href="/work-requirement/?h=${MARYLAND.ccn}"`), 'the link');
  assert.ok(renderWr(MARYLAND).indexOf(band) > renderWr(MARYLAND).indexOf('class="hh__status"'), 'after its status');
});

test('a hospital with no scenario shows its reason line and never a number: no cost report, no expansion group, not an expansion state, a cost report with nothing to take', () => {
  const fy = String(WR.fy);
  for (const reason of ['no_cost_report', 'no_viii_group', 'not_expansion', 'no_medicaid']) {
    const h = pick((x) => x.est && wrOf(x)?.reason === reason, `an estimated hospital whose scenario reason is ${reason}`);
    const band = wrBand(renderWr(h));
    const want = REASON_COPY[`why_${reason}`].text.replace('{state}', wrOf(h).stateName).replace('{fy}', fy);
    assert.ok(textOf(band).includes(want), `${reason}: the reason line`);
    assert.match(band, /<p class="stamp stamp--ink">[^<]+<\/p>/, `${reason}: the stamp`);
    assert.doesNotMatch(band, /%|\$\d|<svg|hh__wbv|NaN|undefined/, `${reason}: no number or bar`);
    assert.ok(band.includes(esc('not a payment, and never added to the Medicare net above.')) && !band.includes('A scenario of what'), `${reason}: a note that promises no scenario`);
  }
  // A hospital with no estimate the file has a row for gets its band too; one the file has none for gets none.
  const noInputs = pick((x) => x.status === 'no-inputs' && wrOf(x), 'a hospital with no estimate in the scenario file');
  assert.ok(wrBand(renderWr(noInputs)), 'a no-inputs hospital in the file');
  for (const h of [pick((x) => x.est && !wrOf(x), 'an estimated hospital the scenario file has no row for'), pick((x) => !x.est && !wrOf(x), 'a hospital with no estimate the file has no row for')]) {
    assert.equal(renderWr(h), render(h), 'no band, and nothing else changed');
    assert.doesNotMatch(renderWr(h), /data-medicaid/);
  }
  assert.ok(IN_FILE.length > 0 && IN_FILE.length < HOSPITALS.length);
});

test('the band\'s stylesheet: every scenario mark from a theme token, the bar\'s strokes non-scaling', () => {
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  for (const cls of ['hh__wb-grid', 'hh__wb-base', 'hh__wb-band', 'hh__wb-mid']) {
    const rule = new RegExp(`\\.${cls} \\{([^}]*)\\}`).exec(css)?.[1] ?? '';
    assert.match(rule, /vector-effect: non-scaling-stroke/, `${cls}: non-scaling`);
    assert.match(rule, /var\(--[a-z-0-9]+\)/, `${cls}: a token`);
  }
});

// Ruling R32: the shares print with the fewest decimals (two, at most three) that keep the cases apart and off zero; one
// still zero at three prints "under" the smallest it can; a range too small for two numbers heads the band as its bound.
test('every drawn hospital\'s band: a range whose printed low and high differ, no share printed as zero, the work-requirement page\'s strings', () => {
  let under = 0;
  for (const ccn of WR.hospitals.keys()) {
    const one = hospitalScenario(WR, ccn);
    if (!one.shares) continue;
    const texts = caseShareTexts(one.shares);
    for (const t of texts) assert.doesNotMatch(t, /^0\.0+%$/, `${ccn}: no share printed as zero`);
    const range = shareRange(one.shares);
    if (range.under) {
      under += 1;
      assert.match(range.under, /^under 0\.00[1-9]%$/, `${ccn}: the bound`);
      const bound = Number(range.under.replace(/[^\d.]/g, ''));
      assert.ok(one.shares[2] < bound / 100, `${ccn}: the bound is above the high case`);
      // Ruling R33: no case label prints the headline's bound or more; each prints the bound itself.
      for (const t of texts) {
        assert.ok(t.startsWith('under ') || Number(t.replace(/[^\d.]/g, '')) < bound, `${ccn}: a case printed at or above the bound (${t})`);
        assert.equal(t, range.under, `${ccn}: the cases print the headline's bound`);
      }
    } else {
      assert.notEqual(texts[0], texts[2], `${ccn}: the printed low and high differ`);
      assert.deepEqual([range.low, range.high], [texts[0], texts[2]], `${ccn}: the headline is the printed low and high`);
      assert.ok(!texts.some((t) => t.startsWith('under ')), `${ccn}: numbers only`);
    }
  }
  assert.ok(under > 0, 'the file has a range too small for two numbers');
  // The pages: a tiny-share hospital's band prints the bound and draws a visible range around its middle mark.
  const tiny = pick((h) => h.est && wrOf(h)?.shares && shareRange(wrOf(h).shares).under, 'an estimated hospital whose range is too small for two numbers');
  const band = wrBand(renderWr(tiny));
  const want = caseShareTexts(wrOf(tiny).shares);
  assert.ok(band.includes(`<p class="hh__wbv">${shareRange(wrOf(tiny).shares).under}</p>`), 'the bound as the headline');
  assert.ok(band.includes(`<li>Low case ${want[0]}</li>`) && band.includes(`High case ${want[2]}</li>`), 'the cases as printed');
  assert.ok(want.every((t) => t === shareRange(wrOf(tiny).shares).under), 'each case the headline\'s bound');
  assert.doesNotMatch(band, /0\.00%|0\.000%/, 'no zero');
  // Its dollars agree with the bound: tiny amounts, whole dollars, never "$0".
  const tinyLost = wrOf(tiny).lost.map((x) => money(x));
  assert.ok(band.includes(`<p class="hh__wbd">${tinyLost[0]} to ${tinyLost[2]} a year, in ${WR.fy} dollars</p>`), 'the dollar line');
  assert.ok(tinyLost.every((t) => /^\$[1-9]\d{0,2}$/.test(t)), `tiny dollars (${tinyLost})`);
  assert.doesNotMatch(/<p class="hh__wbv">(.*?)<\/p>/.exec(band)[1], / to /, 'no "X to X"');
  const width = Number(/class="hh__wb-band" x="[\d.]+" y="7" width="([\d.]+)"/.exec(band)[1]);
  assert.ok(width >= 12, 'a visible range');
  assert.deepEqual(rangeBox(0, 0), { x: 0, width: 12 });
  assert.deepEqual(rangeBox(995, 1000), { x: 988, width: 12 });
  assert.deepEqual(rangeBox(100, 300), { x: 100, width: 200 });
});

// ---------- the TEAM section (hospital/team.js) ----------
const TEAM = HUB.team;
const renderTeam = (h, team = TEAM) => hospitalPage({ h, hospitals: HOSPITALS, facts: FACTS, assets: ASSETS, robots: null, master: HUB.master.get(h.ccn), hrrp: HUB.hrrp, medicaid: HUB.medicaid, team });
const renderOutside = (h, team) => outsidePage({ h, assets: ASSETS, robots: null, master: HUB.master.get(h.ccn), medicaid: HUB.medicaid, team, programYears: HUB.programYears });
const teamOf = (page) => /<section class="hh__wb hh__wb--team"[\s\S]*?<\/section>\n/.exec(page)?.[0] ?? null;
const inTeam = (h) => TEAM.participants.has(h.ccn);
const teamRow = (h) => TEAM.participants.get(h.ccn);
// Five estimated participants with public episodes, spread through the dollar file's order.
const TEAM_DRAWN = HOSPITALS.filter((h) => h.est && inTeam(h) && teamRow(h).active && teamRow(h).target > 0);
const TEAM_FIVE = [0, 1, 2, 3, 4].map((i) => TEAM_DRAWN[Math.floor((i * (TEAM_DRAWN.length - 1)) / 4)]);

test('TEAM never enters the net total: a participant\'s page is the page without the section plus the section, byte for byte; its net, stamp and rows unchanged', () => {
  assert.equal(new Set(TEAM_FIVE.map((h) => h.ccn)).size, 5, 'five different hospitals');
  for (const h of TEAM_FIVE) {
    const page = renderTeam(h);
    const section = teamOf(page);
    assert.ok(section, 'the section');
    const without = render(h);
    assert.equal(page.replace(section, ''), without, 'everything else, the net, its stamp and its rows included, is the page without the section');
    const net = (x) => /<section class="hh__net"[\s\S]*?<\/section>/.exec(x)[0];
    assert.equal(net(page), net(without), 'the net and its stamp');
    assert.ok(page.indexOf(section) > page.indexOf('data-medicaid'), 'after the Medicaid band');
    assert.ok(page.indexOf(section) < page.indexOf('data-peer-table'), 'before the peer table');
    assert.ok(section.includes(esc(COPY.tmNote)), 'its note: never added to the net above');
    assert.doesNotMatch(section, /<script|<button|data-row|data-sum/, 'no script, control or hook the page\'s script reads');
  }
});

test('band only on participants: a non-participant\'s page is byte for byte the page without TEAM, on every kind of page', () => {
  const est = HOSPITALS.filter((h) => h.est && !inTeam(h));
  for (const h of [0, 1, 2, 3].map((i) => est[Math.floor((i * (est.length - 1)) / 3)])) assert.equal(renderTeam(h), render(h), 'an estimated non-participant');
  const variant = pick((h) => !h.est && !inTeam(h), 'a hospital with no estimate, not in TEAM');
  assert.equal(renderTeam(variant), render(variant), 'a non-participant with no estimate');
  const out = OUTSIDE.find((h) => !inTeam(h));
  assert.equal(renderOutside(out, TEAM), renderOutside(out, null), 'a hospital outside the penalty programs, not in TEAM');
});

test('the section on a participant with no estimate and on one outside the penalty programs: after the Medicaid band, no net named', () => {
  const variant = pick((h) => !h.est && inTeam(h), 'a participant with no estimate');
  const vs = teamOf(renderTeam(variant));
  assert.ok(vs && vs.includes(esc(COPY.tmNoteAlone)) && !vs.includes('Medicare net'), 'a participant with no estimate: its section names no net');
  const out = OUTSIDE.find(inTeam);
  assert.ok(out, 'a participant outside the penalty programs');
  const page = renderOutside(out, TEAM);
  const os = teamOf(page);
  assert.ok(os && !os.includes('Medicare net'), 'outside the programs: its section names no net');
  assert.equal(page.replace(os, ''), renderOutside(out, null), 'and is the page without it, plus it');
  assert.ok(page.indexOf(os) < page.indexOf('class="hh__notes"'), 'before the source line');
  // The "Not in Medicare's penalty programs" stamp is the master's, not TEAM's: a participant's page shows it or not as
  // it would without the section (the byte-for-byte check above).
});

test('the hub hospital page within its 70 KB budget: every participant\'s built page (HTML, CSS and scripts, brotli)', { timeout: 120_000 }, () =>
  withTemp('pp-hub-team-', async (dir) => {
    await build({ outDir: join(dir, 'dist'), sites: [HUB_SITE] });
    const cache = new Map();
    let heaviest = { total: 0 };
    for (const ccn of TEAM.participants.keys()) {
      const w = pageWeight(join(dir, 'dist'), `${hospitalPathOf('hub', ccn).slice(1)}index.html`, cache);
      if (w.total > heaviest.total) heaviest = w;
    }
    // The size, never the hospital: the run's log carries the heaviest participant page against the budget.
    console.log(`heaviest TEAM participant's hub page: ${(heaviest.total / 1024).toFixed(1)} KB of ${BUDGETS.hubHospital / 1024} KB (HTML ${(heaviest.html / 1024).toFixed(1)} KB)`);
    assert.ok(heaviest.total <= BUDGETS.hubHospital, 'a participant\'s page over the hub hospital budget');
  }));
