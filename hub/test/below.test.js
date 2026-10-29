// What sits below the home page's story (hub/home/below.js, hub/client/story/worksheet.js): the program directory (a card
// per program with data, each with its national figure and a histogram, then the programs under consideration as dashed
// slips), the methods in brief with a worksheet that adds up one hospital's estimate, and the invitation. Built from the
// real data; no hospital is named here (the worksheet's is the example, read from the data by its CCN; synthetic rows use
// invented CCNs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pctOf, programDollars } from '../../engine/js/dollars/whatif.js';
import { tags, textOf } from '../../pipeline/site/html.js';
import { ASSETS, footerOf } from '../../pipeline/test/helpers.js';
import { HAC_TOP_SHARE, programDek } from '../../web/programs.js';
import { count, fractionWord, money, numberWord } from '../../web/render/format.js';
import { escapeHtml } from '../../web/render/html.js';
import { feedbackFor } from '../../web/render/layout.js';
import { SITE, hospitalPathOf } from '../../web/site.js';
import { factorText, paintWorksheet, worksheetModel } from '../client/story/worksheet.js';
import { loadHub } from '../data.js';
import { BIN_POINTS, directory, programBins } from '../home/below.js';
import { COPY } from '../home/copy.js';
import { simpleFraction } from '../home/claims.js';
import { homePage } from '../home/page.js';
import { EXAMPLE_CCN, hubHospitals, stateTotals, storyFacts } from '../model.js';
import { decodedHub, element, elements } from './helpers.js';

const hub = loadHub();
const hospitals = hubHospitals(hub);
const facts = storyFacts(hospitals);
const fy = hub.fy;
const assets = { ...ASSETS, shell: { ...ASSETS.shell, fy } };
const out = homePage({ hospitals, facts, states: stateTotals(hospitals), shapes: hub.shapes, assets, robots: 'noindex' });
const estimated = hospitals.filter((h) => h.est);
const example = hospitals.find((h) => h.ccn === EXAMPLE_CCN);

const words = (html) => textOf(html).trim();

const PROGRAMS = { hrrp: { key: 'hrrp', listed: 'hrrpListed' }, hacrp: { key: 'hac', listed: null }, hvbp: { key: 'hvbp', listed: 'vbpListed' } };
// The hospitals with an estimate that are in a program's file, and each one's dollars as a percent of its pay.
const inProgram = (id) => estimated.filter((h) => !PROGRAMS[id].listed || h.est[PROGRAMS[id].listed]);
const percentOf = (h, id) => (h.est[PROGRAMS[id].key] * 100) / h.est.total;

test('the directory: #programs with its kicker, a heading that counts the programs with data and those under consideration, and the gross figure in its lede', () => {
  const section = element(out, '<section class="bsec" id="programs"', 'section');
  assert.match(section, /^<section class="bsec" id="programs" aria-labelledby="programs-h">/);
  assert.ok(words(section).startsWith('The programs'), 'the kicker');
  const withData = SITE.programs.filter((p) => p.inData).length;
  const considered = SITE.programs.length - withData;
  assert.equal(words(element(section, '<h2 id="programs-h"', 'h2')), `${numberWord(withData).replace(/^./, (c) => c.toUpperCase())} programs live, ${numberWord(considered)} under consideration.`);
  const lede = words(element(section, '<p class="bsec__lede"', 'p'));
  assert.ok(lede.includes(money(facts.gross)), lede);
  assert.ok(lede.includes(`FY${fy}`) && lede.includes('estimated'), lede);
  // It sits below the story, in the page's main.
  assert.ok(out.indexOf('id="programs"') > out.indexOf('<div class="story" data-story>'));
  assert.ok(out.indexOf('id="programs"') < out.indexOf('</main>'));
});

test('a card per program with data: name, abbreviation, dek, the national figure with its tag and year, and the way to its page', () => {
  const cards = elements(out, '<article class="pc"', 'article');
  const expected = [
    ['hrrp', money(facts.hrrpSum), `not paid to hospitals nationally, FY${fy}`],
    ['hacrp', money(facts.hacSum), `not paid to hospitals nationally, FY${fy}`],
    ['hvbp', `${money(facts.vbpBonus)} moved`, `net ${money(facts.vbpNet)} nationally, FY${fy}`],
  ];
  assert.equal(cards.length, expected.length);
  cards.forEach((card, i) => {
    const [id, figure, sub] = expected[i];
    const p = SITE.programs.find((x) => x.id === id);
    assert.match(card, new RegExp(`<h3><span>${p.name}</span> <abbr class="ab" title="${p.long}">${p.ab}</abbr></h3>`), id);
    assert.equal(words(element(card, '<p class="pc__dek"', 'p')), programDek(id), id);
    const big = element(card, '<p class="pc__big"', 'p');
    assert.ok(words(big).startsWith(figure), `${id}: ${words(big)}`);
    assert.match(big, /<a class="est-tag" href="\/methods\/#estimate" aria-label="[^"]+">Estimate<\/a>/, id);
    assert.equal(words(element(card, '<p class="pc__sub"', 'p')), sub, id);
    // The way to its page: the program's short name, the same on every card (so the three read evenly on one line), with
    // its name said to a screen reader after it.
    assert.match(card, new RegExp(`<a class="go" href="${p.path}" aria-label="Open ${p.ab}, ${p.name}">Open ${p.ab}<span class="ico ico--arrow" aria-hidden="true"></span></a>`), id);
  });
  assert.deepEqual(cards.map((c) => /<a class="go" href="([^"]+)"/.exec(c)[1]), ['/hrrp/', '/hacrp/', '/hvbp/']);
});

test('each card\'s takeaway is the data\'s: Readmissions\' share at $0, the HAC step, value-based purchasing\'s two sides', () => {
  const [hrrp, hac, vbp] = elements(out, '<article class="pc"', 'article').map((c) => words(element(c, '<figcaption', 'figcaption')));
  const zero = inProgram('hrrp').filter((h) => h.est.hrrp === 0).length / inProgram('hrrp').length;
  const near = simpleFraction(zero);
  assert.equal(hrrp, near?.part === 1 ? `Most cuts are small; about one hospital in ${numberWord(near.whole)} pays $0.` : hrrp);
  assert.match(hrrp, /^Most cuts are small; /);
  assert.equal(hac, `One flat step: ${fractionWord(HAC_TOP_SHARE, 'the')} with the highest scores take the 1% cut; the rest pay $0.`);
  assert.equal(vbp, 'One pool, two sides: the cuts on the left pay for the bonuses on the right.');
  // Value-based purchasing's dek already says budget-neutral; the takeaway does not say it again.
  assert.doesNotMatch(vbp, /budget-neutral/i);
});

test('programBins bins each hospital\'s percent of pay as its estimate carries it (est.pct, the engine\'s one rule)', () => {
  // Synthetic rows (invented CCNs) that carry only their percents: the bins follow est.pct, not arithmetic of their own.
  const row = (ccn, hrrp) => ({ ccn, est: { hrrpListed: true, vbpListed: true, pct: { hrrp, hac: 0, hvbp: 0, net: hrrp } } });
  assert.deepEqual(programBins([row('990001', -0.5), row('990002', -0.45), row('990003', 0), { ccn: '990004', est: null }], 'hrrp'), {
    n: 3, zero: 1, cut: 2, bonus: 0, bins: [{ lo: -3 * BIN_POINTS, n: 2 }],
  });
});

test('each card\'s histogram: bins of 0.2 points whose counts add to the program\'s hospitals, $0 apart, one path per ink, two labels', () => {
  assert.equal(BIN_POINTS, 0.2);
  const cards = elements(out, '<article class="pc"', 'article');
  for (const [i, id] of ['hrrp', 'hacrp', 'hvbp'].entries()) {
    const members = inProgram(id);
    const { zero, bins, n } = programBins(hospitals, id);
    assert.equal(n, members.length, `${id}: the program's hospitals`);
    assert.equal(zero + bins.reduce((sum, b) => sum + b.n, 0), members.length, `${id}: the bars add to the program's hospitals`);
    assert.equal(zero, members.filter((h) => h.est[PROGRAMS[id].key] === 0).length, `${id}: $0 in its own gutter`);
    // Every hospital away from $0 is in the bin that holds its percent; no bin straddles $0.
    for (const b of bins) {
      assert.ok(b.n > 0);
      assert.ok(b.lo >= 0 || b.lo + BIN_POINTS <= 1e-9, `${id}: a bin straddles $0`);
      const inside = members.filter((h) => { const v = percentOf(h, id); return v !== 0 && v >= b.lo - 1e-9 && v < b.lo + BIN_POINTS - 1e-9; }).length;
      assert.equal(inside, b.n, `${id}: the bin from ${b.lo}`);
    }
    // The drawing: an image with its takeaway, a path per ink whose bars are the bins (cuts in pen, bonuses in rew, $0
    // neutral), and two labels.
    const svg = element(cards[i], '<svg class="st pc__hist"', 'svg');
    assert.match(svg, /role="img" aria-label="[^"]+"/);
    const label = /aria-label="([^"]+)"/.exec(svg)[1];
    assert.ok(label.includes(count(members.length)), label);
    // Natural words: the program's full name (no abbreviation to spell out), and only the groups it has (no "0 with a
    // bonus" for a program that pays none, no "0 at $0").
    const p = SITE.programs.find((x) => x.id === id);
    assert.ok(label.startsWith(`${count(members.length)} hospitals in the ${p.long}, `), label);
    assert.ok(!label.includes(p.ab), `${id}: the label spells out its abbreviation`);
    assert.doesNotMatch(label, /(?:^|\D)0 (?:cut|at|with)/, `${id}: a group of none`);
    const cutCount = members.filter((h) => h.est[PROGRAMS[id].key] < 0).length;
    const bonusCount = members.filter((h) => h.est[PROGRAMS[id].key] > 0).length;
    const parts = [cutCount && `${count(cutCount)} cut`, zero && `${count(zero)} at $0`, bonusCount && `${count(bonusCount)} with a bonus`].filter(Boolean);
    assert.ok(label.endsWith(`: ${parts.join(', ')}.`), label);
    const bars = (ink) => [...tags(svg, { names: ['path'] })].filter(({ attrs }) => attrs.class === `st__d st__d--${ink}`);
    const subpaths = (ink) => bars(ink).reduce((total, { attrs }) => total + attrs.d.split('M').length - 1, 0);
    assert.ok(bars('pen').length <= 1 && bars('rew').length <= 1 && bars('neu').length <= 1, `${id}: one path per ink`);
    assert.equal(subpaths('pen'), bins.filter((b) => b.lo < 0).length, `${id}: a bar per cut bin`);
    assert.equal(subpaths('rew'), bins.filter((b) => b.lo >= 0).length, `${id}: a bar per bonus bin`);
    assert.equal(subpaths('neu'), zero ? 1 : 0, `${id}: the $0 bar`);
    for (const { attrs } of [...bars('pen'), ...bars('rew'), ...bars('neu')]) assert.doesNotMatch(attrs.d, /\.\d\d/, 'coordinates rounded to a tenth');
    const labels = [...svg.matchAll(/<text class="st__out"[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
    const cutN = members.filter((h) => h.est[PROGRAMS[id].key] < 0).length;
    const bonusN = members.filter((h) => h.est[PROGRAMS[id].key] > 0).length;
    assert.deepEqual(labels, [`${count(cutN)} cut`, bonusN ? `${count(bonusN)} bonus` : `${count(zero)} at $0`], id);
  }
});

test('the programs under consideration: six dashed slips in three named groups, each with its abbreviation, name, dek and "under consideration"', () => {
  const section = element(out, '<section class="bsec" id="programs"', 'section');
  const groups = elements(section, '<div class="sg"', 'div');
  const want = [['price', 'Price adjustments'], ['reporting', 'Reporting rules'], ['episode', 'Episode payment']];
  assert.deepEqual(groups.map((g) => element(g, '<p class="grp cap"', 'p')), want.map(([, name]) => `<p class="grp cap"><span>${name}</span></p>`));
  const slips = [];
  groups.forEach((g, i) => {
    const members = SITE.programs.filter((p) => p.group === want[i][0] && !p.inData);
    assert.match(g, new RegExp(`^<div class="sg" style="--n:${members.length}">`));
    const found = elements(g, '<a class="slip"', 'a');
    assert.deepEqual(found.map((s) => /href="([^"]+)"/.exec(s)[1]), members.map((p) => p.path));
    found.forEach((s, j) => {
      const p = members[j];
      assert.ok(s.includes(`<abbr class="ab" title="${escapeHtml(p.long)}">${escapeHtml(p.ab)}</abbr><b>${escapeHtml(p.name)}</b>`), p.id);
      assert.ok(words(s).includes(programDek(p.id)), p.id);
      assert.match(s, /<span class="hh__nextbox slip__none"><span>under consideration<\/span><\/span><\/a>$/, p.id);
    });
    slips.push(...found);
  });
  assert.equal(slips.length, 6);
});

test('methods in brief: its kicker, heading, a paragraph, three numbered points and the way to the methods', () => {
  const section = element(out, '<section class="bsec ests" id="estimate"', 'section');
  assert.ok(words(section).startsWith('Methods, in brief'));
  assert.equal(words(element(section, '<h2 id="estimate-h"', 'h2')), 'Every dollar here is an estimate, and is labeled one.');
  const steps = element(section, '<ol class="nsteps"', 'ol');
  const items = elements(steps, '<li', 'li');
  assert.equal(items.length, 3);
  items.forEach((li, i) => assert.ok(li.startsWith(`<li><span class="field__no">${i + 1}</span>`), li));
  assert.ok(words(items[0]).includes(`estimated Medicare inpatient pay for FY${fy}`));
  assert.match(section, /<a class="more" href="\/methods\/">Read the methods<span class="ico ico--arrow" aria-hidden="true"><\/span><\/a>/);
});

// The worksheet says its table roles outright: on the narrowest phones its rows are laid out as a grid, and a browser
// can drop a table's own semantics when its parts change display (WebKit does), so the roles keep it a table of six
// rows, each a number, a row header and an amount.
test('the worksheet keeps its table roles whatever its layout', () => {
  const ws = element(out, '<div class="form wsx" data-worksheet', 'div');
  assert.match(ws, /<table class="wst" role="table"><caption class="vh">[^<]+<\/caption><tbody role="rowgroup">/);
  const rows = [...ws.matchAll(/<tr\b([^>]*)>(.*?)<\/tr>/gs)];
  assert.equal(rows.length, 6);
  for (const [, attrs, inside] of rows) {
    assert.match(attrs, /role="row"/);
    const cells = [...inside.matchAll(/<(td|th)\b([^>]*)>/g)].map((m) => `${m[1]} ${/role="([a-z]+)"/.exec(m[2])?.[1]}`);
    assert.deepEqual(cells, ['td cell', 'th rowheader', 'td cell']);
  }
});

// A worksheet amount as a number: "−$69,238" is -69238. "Not in this program" is null.
const amount = (text) => (/^[−+]?\$[\d,]+$/.test(text) ? Number(text.replace('−', '-').replace(/[$,+]/g, '')) : null);
const LINE_KEYS = ['total', 'base', 'hrrp', 'hac', 'hvbp', 'net'];

test('the worksheet adds up the example\'s estimate: line 6 = 3 + 4 + 5 = its net, every line the emitted dollars', () => {
  const ws = element(out, '<div class="form wsx" data-worksheet', 'div');
  assert.match(ws, new RegExp(`^<div class="form wsx" data-worksheet data-src="${assets.shell.hubUrl}" data-ccn="${EXAMPLE_CCN}">`));
  // Lines 1 to 6, numbered in order, each amount in its own cell.
  assert.deepEqual([...ws.matchAll(/<td role="cell"><span class="field__no">(\d)<\/span><\/td>/g)].map((m) => m[1]), ['1', '2', '3', '4', '5', '6']);
  const cells = Object.fromEntries([...ws.matchAll(/<td role="cell" data-ws="([a-z]+)"( data-na)?>([^<]*)<\/td>/g)].map((m) => [m[1], m[3]]));
  assert.deepEqual(Object.keys(cells), LINE_KEYS);
  const d = programDollars(example.est);
  const v = Object.fromEntries(LINE_KEYS.map((k) => [k, amount(cells[k])]));
  assert.equal(v.total, example.est.total);
  assert.equal(v.base, example.est.base);
  for (const k of ['hrrp', 'hac', 'hvbp', 'net']) assert.equal(v[k], d[k], k);
  assert.equal(v.hrrp + v.hac + v.hvbp, v.net, 'line 6 = 3 + 4 + 5');
  assert.equal(v.net, example.est.net);
  // Its words: the year and "estimated", the hospital, the estimate tag on the net, the stamp, the find line, its page.
  const said = words(ws);
  assert.ok(said.startsWith(`Worksheet · FY${fy} · An example CCN ${EXAMPLE_CCN}`), said);
  assert.ok(ws.includes(`<b data-ws="name">${escapeHtml(example.name)}</b>, <span data-ws="place">${escapeHtml(`${example.city}, ${example.state}`)}</span>: estimated Medicare inpatient pay`), 'line 1 names the hospital');
  assert.match(element(ws, '<tr role="row" class="wst__net"', 'tr'), /<a class="est-tag" href="\/methods\/#estimate"/);
  const sign = example.est.net < 0 ? 'cut' : example.est.net > 0 ? 'bonus' : 'zero';
  const stamps = [...ws.matchAll(/<p class="stamp[^"]*" data-sign="([a-z]+)"( hidden)?>([^<]*)<\/p>/g)].map((m) => [m[1], Boolean(m[2]), m[3]]);
  assert.deepEqual(stamps, [['cut', sign !== 'cut', 'Net cut'], ['bonus', sign !== 'bonus', 'Net bonus'], ['zero', sign !== 'zero', 'No net change']]);
  assert.ok(said.includes('Find your hospital above and this worksheet fills in for it.'));
  assert.ok(ws.includes(`<a data-ws="go" href="${hospitalPathOf('hub', EXAMPLE_CCN)}">Its hospital page</a>`));
});

test('the worksheet claims no more than its rounding allows: each line rounded on its own, so the arithmetic can be off by a dollar', () => {
  const ws = words(element(out, '<div class="form wsx" data-worksheet', 'div'));
  // Line 3 is the factor times the unrounded base, so worked from the printed line 2 it can be a dollar away.
  assert.ok(ws.includes('each line rounded on its own, so the arithmetic can be off by a dollar'), ws);
  assert.ok(!ws.includes('to the dollar'), 'no claim that the lines agree to the dollar');
});

test('worksheetModel: every hospital\'s lines add to its net; outside a program reads "Not in this program", never $0', () => {
  for (const h of estimated) {
    const m = worksheetModel(h);
    const d = programDollars(h.est);
    for (const [k, id] of [['hrrp', 'hrrpListed'], ['hvbp', 'vbpListed']]) {
      if (h.est[id]) assert.equal(amount(m.text[k]), d[k], `${h.ccn} ${k}`);
      else assert.equal(m.text[k], 'Not in this program', `${h.ccn} ${k}`);
    }
    assert.equal(amount(m.text.hac), d.hac);
    assert.equal((amount(m.text.hrrp) ?? 0) + amount(m.text.hac) + (amount(m.text.hvbp) ?? 0), amount(m.text.net), h.ccn);
    assert.equal(amount(m.text.net), h.est.net, h.ccn);
    assert.equal(m.sign, h.est.net < 0 ? 'cut' : h.est.net > 0 ? 'bonus' : 'zero');
    assert.deepEqual(m.show, { hrrp: h.est.hrrpListed, vbp: h.est.vbpListed, cut: h.est.cut, nocut: !h.est.cut });
  }
  // An invented hospital outside both factor programs, in the HAC cut: 1% of its pay after lines 3 and 5.
  const est = { base: 1000000, total: 1200000, hrrp: 0, hvbp: 0, hac: -12000, net: -12000, after: 1200000, atStake: 12000,
    hrrpFactor: 1, vbpFactor: 1, cut: true, hrrpListed: false, vbpListed: false };
  const m = worksheetModel({ ccn: '990001', name: 'Invented General', city: 'Nowhere', state: 'ZZ', est });
  assert.deepEqual(m.text, { ccn: '990001', name: 'Invented General', place: 'Nowhere, ZZ', total: '$1,200,000', base: '$1,000,000',
    hrrp: 'Not in this program', hrrpF: '1.0000', hac: '−$12,000', hvbp: 'Not in this program', vbpF: '1.0000', net: '−$12,000' });
  assert.equal(m.href, hospitalPathOf('hub', '990001'));
  assert.equal(worksheetModel({ ccn: '990002', name: 'B', city: null, state: 'ZZ', est }).text.place, 'ZZ');
  // A factor as precise as the dollar file prints it, at least CMS's four places, so line 2 times it gives the line.
  assert.equal(factorText(0.995), '0.9950');
  assert.equal(factorText(1), '1.0000');
  assert.equal(factorText(1.0014638299), '1.0014638299');
  assert.equal(factorText(0.99876), '0.99876');
});

test('the browser\'s worksheet for a hospital is the server\'s, word for word', () => {
  const { byCcn } = decodedHub(hub);
  for (const h of [example, estimated.find((x) => !x.est.vbpListed), estimated.find((x) => x.est.cut), estimated.find((x) => x.est.net > 0)]) {
    assert.ok(h, 'a hospital of each kind');
    const { text, show, sign, href } = worksheetModel(h);
    const browser = worksheetModel(byCcn.get(h.ccn));
    assert.deepEqual({ text: browser.text, show: browser.show, sign: browser.sign, href: browser.href }, { text, show, sign, href });
  }
});

test('paintWorksheet writes a found hospital into the worksheet\'s own elements (text only) and shows its notes and stamp', () => {
  const ws = element(out, '<div class="form wsx" data-worksheet', 'div');
  // A stand-in for the page's elements: each element the script touches, with its data attributes and hidden state.
  const els = [...tags(ws, { names: null })].filter(({ attrs }) => Object.keys(attrs).some((a) => /^data-(ws|ws-if|ws-ex|sign)$/.test(a)))
    .map(({ attrs }) => ({
      attrs, hidden: 'hidden' in attrs, textContent: null, href: attrs.href ?? null,
      dataset: { ws: attrs['data-ws'], wsIf: attrs['data-ws-if'], sign: attrs['data-sign'] },
      setAttribute(name, value) { assert.equal(name, 'href'); this.href = value; },
      toggleAttribute(name, on) { assert.equal(name, 'data-na'); if (on) this.attrs[name] = ''; else delete this.attrs[name]; },
    }));
  const root = { dataset: { ccn: EXAMPLE_CCN }, querySelectorAll: (sel) => els.filter((el) => `data-${/\[data-([a-z-]+)\]/.exec(sel)[1]}` in el.attrs) };
  const found = estimated.find((h) => h.ccn !== EXAMPLE_CCN && h.est.cut && !h.est.vbpListed);
  const m = worksheetModel(found);
  paintWorksheet(root, m);
  assert.equal(root.dataset.ccn, found.ccn);
  for (const el of els.filter((x) => x.dataset.ws && x.dataset.ws !== 'go')) assert.equal(el.textContent, m.text[el.dataset.ws], el.dataset.ws);
  assert.equal(els.find((x) => x.dataset.ws === 'go').href, hospitalPathOf('hub', found.ccn));
  for (const el of els.filter((x) => x.dataset.wsIf)) assert.equal(el.hidden, !m.show[el.dataset.wsIf], el.dataset.wsIf);
  for (const el of els.filter((x) => x.dataset.sign)) assert.equal(el.hidden, el.dataset.sign !== m.sign, el.dataset.sign);
  assert.equal(els.find((x) => 'data-ws-ex' in x.attrs).hidden, true, 'no longer "An example"');
  // A program it is not in: the amount's words, marked so they may wrap; one it is in: a figure.
  assert.ok('data-na' in els.find((x) => x.dataset.ws === 'hvbp').attrs, 'outside value-based purchasing');
  assert.ok(!('data-na' in els.find((x) => x.dataset.ws === 'hrrp').attrs) || !found.est.hrrpListed);
  // Every key the markup names is one the model fills.
  for (const el of els.filter((x) => x.dataset.ws && x.dataset.ws !== 'go')) assert.ok(el.dataset.ws in m.text, el.dataset.ws);
});

test('your turn: the dashed box, its words, the prefilled form in a new tab, "Opens a Google Form.", no email address', () => {
  const box = element(out, '<section class="ask"', 'section');
  const said = words(box);
  assert.ok(said.startsWith('Your turn'));
  assert.equal(words(element(box, '<h2 id="ask-h"', 'h2')), 'What should I build next?');
  assert.ok(said.includes('Which Medicare program, question or dataset would you want to see explained next? Spotted a number that looks wrong? Say so on the same form.'));
  const href = feedbackFor({ path: '/' });
  assert.ok(box.includes(`<a href="${escapeHtml(href)}" target="_blank" rel="noopener">Suggest an idea<span class="ico ico--arrow" aria-hidden="true"></span><span class="vh"> (opens in a new tab)</span></a>`), box);
  const prefill = new URL(href);
  assert.equal(prefill.searchParams.get(SITE.feedback.siteEntry), SITE.name);
  assert.equal(prefill.searchParams.get(SITE.feedback.pageEntry), `${SITE.origin}/`);
  assert.ok(said.includes('Opens a Google Form.'));
  assert.doesNotMatch(box, /@|mailto:/);
  // The footer keeps exactly one feedback link of its own.
  assert.equal(footerOf(out).split(`<a href="${SITE.feedback.url}`).length - 1, 1);
});

test('the claims the directory\'s words make stop the build when the data no longer bear them out', () => {
  // A changed estimate carries the percents of its changed dollars, as the model's do.
  const changed = (change, est) => {
    const e = change({ ...est });
    return { ...e, pct: pctOf(e) };
  };
  const render = (change) => directory({ programs: SITE.programs, facts, fy, hospitals: hospitals.map((h) => (h.est ? { ...h, est: changed(change, h.est) } : h)) });
  // Most Readmissions cuts are small; the HAC program is one step (a cut or $0); value-based purchasing has both sides.
  assert.throws(() => render((e) => ({ ...e, hrrp: e.hrrp * 20 })), /no longer bear out/);
  assert.throws(() => render((e) => ({ ...e, hac: e.hac === 0 ? 1 : e.hac })), /no longer bear out/);
  // "The quarter with the highest scores": the share the program cuts stays near the rule's quarter.
  assert.throws(() => render((e) => ({ ...e, hac: e.hac === 0 ? -1 : e.hac })), /no longer bear out/);
  assert.throws(() => render((e) => ({ ...e, hvbp: -Math.abs(e.hvbp) })), /no longer bear out/);
  assert.doesNotThrow(() => render((e) => e));
});

test('the words below the story carry no digit: every number arrives through a placeholder', () => {
  for (const [key, text] of Object.entries(COPY)) assert.doesNotMatch(text, /\d/, key);
});
