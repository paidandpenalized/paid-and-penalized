// A hospital's page across the programs (hub/hospital/page.js) on the pinned data, rows picked by property, never by name
// or CCN. Failure messages say what was checked and print no hospital's name, CCN or figure.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { median, peerKey } from '../../engine/js/peers.js';
import { STATE_NAMES } from '../../engine/js/states.js';
import { createContext } from '../../pipeline/site/context.js';
import { textOf } from '../../pipeline/site/html.js';
import { ASSETS, chipOf, headerOf, withTemp } from '../../pipeline/test/helpers.js';
import { HAC_CUT_PCT } from '../../web/programs.js';
import { decimal, dollars, money, moneyRange, pct } from '../../web/render/format.js';
import { escapeHtml } from '../../web/render/html.js';
import { LISTED_PROGRAMS, SITE, hospitalPathOf } from '../../web/site.js';
import { loadHub } from '../data.js';
import { COPY } from '../hospital/copy.js';
import { hospitalPage } from '../hospital/page.js';
import { peerFigures, peersOf } from '../hospital/peers.js';
import { shareText, signedShareText } from '../hospital/text.js';
import { hubHospitals, storyFacts } from '../model.js';
import { generateHub } from '../pages.js';
import { mainOf } from './helpers.js';

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
const render = (h, robots = null) => hospitalPage({ h, hospitals: HOSPITALS, facts: FACTS, assets: ASSETS, robots, master: HUB.master.get(h.ccn), hrrp: HUB.hrrp });
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
  assert.ok(hrrp.includes(`Peer median, among those in the program: ${signedShareText(fig.hrrp.median)} of pay.`), 'Readmissions: the peers\' median');
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

test('the hub writes a page for every hospital in the dollar file, each at its address, none with NaN, undefined or Infinity', () =>
  withTemp('pp-hub-hosp-', async (dir) => {
    const base = createContext({ outDir: join(dir, 'a'), env: 'production', assets: ASSETS });
    await generateHub(base, { hospitals: [], master: new Map() });
    const ctx = createContext({ outDir: join(dir, 'b'), env: 'production', assets: ASSETS });
    await generateHub(ctx, { released: true });
    assert.equal(ctx.pages - base.pages, HUB.dollars.hospitals.length, 'one page per hospital in the dollar file');
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
    // The hub released: a page with an estimate is indexed (one without has no figures: Maryland's, or no inputs).
    const indexed = ctx.indexable.filter((p) => p.startsWith('/hospital/')).length;
    assert.equal(indexed, HOSPITALS.filter((h) => h.est).length, 'hospital pages with an estimate indexable');
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
