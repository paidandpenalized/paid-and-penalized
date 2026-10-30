// The home page, server-rendered (hub/home/): the hero, the story's nine steps with every number from the data, the
// static scale bar (one dot per hospital with an estimate), the shaded states map, the readout and key, and the example
// card. Built from the real data (no hospital is named here: the example card's is read from the data by its CCN).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { median } from '../../engine/js/peers.js';
import { build } from '../../pipeline/site/build.js';
import { tags, textOf } from '../../pipeline/site/html.js';
import { ASSETS, withTemp } from '../../pipeline/test/helpers.js';
import { BUDGETS, pageWeight } from '../../tools/ci/size-budget.js';
import { STATE_NAMES } from '../../engine/js/states.js';
import { US_MAP_CODES } from '../../web/charts/geo.js';
import { count, money, pct } from '../../web/render/format.js';
import { hospitalPathOf } from '../../web/site.js';
import { HUB } from '../pages.js';
import { loadHub } from '../data.js';
import { barOrder } from '../client/story/bar-frame.js';
import { MAGNIFY } from '../home/bar.js';
import { simpleFraction } from '../home/claims.js';
import { homePage } from '../home/page.js';
import { cardModel } from '../client/story/find.js';
import { peersOf } from '../hospital/peers.js';
import { stateKey } from '../home/states.js';
import { EXAMPLE_CCN, hubHospitals, stateTotals, storyFacts } from '../model.js';
import { element } from './helpers.js';

const hub = loadHub();
const hospitals = hubHospitals(hub);
const facts = storyFacts(hospitals);
const states = stateTotals(hospitals);
const assets = { ...ASSETS, shell: { ...ASSETS.shell, fy: hub.fy } };
const out = homePage({ hospitals, facts, states, shapes: hub.shapes, assets, robots: 'noindex' });

const STEP_IDS = ['scale', 'start', 'readmissions', 'hac', 'vbp', 'net', 'map', 'states', 'find'];
const step = (i) => element(out, `<section class="step" id="step-${STEP_IDS[i]}"`, 'section');
const words = (i) => textOf(step(i));

test('the hero: the wordmark as the page\'s one h1 in two spans, the tagline and byline between rules, the heavy break rule', () => {
  assert.equal(out.match(/<h1[\s>]/g).length, 1);
  assert.match(out, /<h1 class="hero__mark"[^>]*><span class="hero__m1">Paid &amp;<\/span> <span class="hero__m2">Penalized<\/span><\/h1>/);
  const hero = element(out, '<section class="hero"', 'section');
  assert.match(hero, /<div class="hero__strip"><p class="hero__tag">Public Medicare data, made visible\.<\/p>/);
  assert.match(textOf(hero), /Built by Dalton Haslam, MD, MBA/);
  assert.match(hero, /<hr class="hero__rule">/);
});

test('nine steps, each a section with its id, data-step 0 to 8 and a heading; the rail links each by its label', () => {
  const sections = [...tags(out, { names: ['section'] })].filter(({ attrs }) => attrs.class === 'step');
  assert.deepEqual(sections.map(({ attrs }) => [attrs.id, attrs['data-step']]), STEP_IDS.map((id, i) => [`step-${id}`, String(i)]));
  for (let i = 0; i < 9; i++) assert.equal(step(i).match(/<h2[\s>]/g).length, 1, STEP_IDS[i]);
  const rail = element(out, '<ol class="rail"', 'ol');
  const links = [...rail.matchAll(/<a href="#([^"]+)"[^>]*>([^<]*)<\/a>/g)].map(([, href, label]) => [href, label]);
  assert.deepEqual(links, [['step-scale', 'Scale'], ['step-start', 'Start at $0'], ['step-readmissions', 'Readmissions'],
    ['step-hac', 'Hospital-acquired'], ['step-vbp', 'Value-based'], ['step-net', 'Net result'], ['step-map', 'On the map'],
    ['step-states', 'By state'], ['step-find', 'Find yours']]);
  assert.match(out, /<div class="story" data-story>/);
  assert.match(out, /<div class="stage" data-stage>/);
});

test('every number in the steps\' words is the data\'s, as the page formats it', () => {
  const expect = (i, ...values) => { for (const v of values) assert.ok(words(i).includes(v), `step ${STEP_IDS[i]} lacks ${v}: ${words(i)}`); };
  expect(0, count(facts.n), money(facts.pay), money(facts.gross), pct(facts.share, 2), money(facts.notPaid), money(facts.vbpBonus), `FY${hub.fy}`);
  expect(2, count(facts.hrrpCut), count(facts.hrrpZero), count(facts.hrrpOut), '3%');
  // At $0 counts only the hospitals in the program (as the program's card below does); the rest are said apart.
  assert.match(words(2), new RegExp(`${count(facts.hrrpZero)} pass through at \\$0, and ${count(facts.hrrpOut)} are not in the program\\.`));
  const cuts = hospitals.filter((h) => h.est && h.est.hrrp < 0).map((h) => -h.est.hrrp / h.est.total);
  expect(2, pct(median(cuts), 2));
  expect(3, count(facts.hacCut), count(facts.hacOnly), '1%');
  expect(4, count(facts.vbpBonusN), count(facts.vbpCutN), money(facts.vbpBonus), '2%');
  expect(5, count(facts.netCut), count(facts.netBonus), count(facts.netZero), money(facts.notPaid));
  // By state: the lowest and highest state by share, and the states whose hospitals come out ahead.
  const ranked = [...states.values()].filter((s) => !s.notInPrograms).sort((a, b) => a.share - b.share);
  const [low, high] = [ranked[0], ranked[ranked.length - 1]];
  expect(7, STATE_NAMES[low.state], pct(-low.share, 2), STATE_NAMES[high.state], pct(Math.abs(high.share), 2));
  for (const s of ranked.filter((x) => x.share > 0)) expect(7, STATE_NAMES[s.state]);
  assert.doesNotMatch(out, /NaN|undefined|Infinity/);
  // Every step that names dollars (other than $0) says they are estimated and gives the fiscal year.
  for (let i = 0; i < STEP_IDS.length; i++) {
    if (!/\$[1-9]/.test(words(i))) continue;
    assert.match(words(i), /\bestimated\b/i, `step ${STEP_IDS[i]} says estimated`);
    assert.ok(words(i).includes(`FY${hub.fy}`), `step ${STEP_IDS[i]} gives the fiscal year`);
  }
});

test('the scale bar: one SVG image with a takeaway label, its 2,971 dots one path of zero-length segments, the sliver and its magnified split', () => {
  const bar = element(out, '<figure class="sbar"', 'figure');
  const svgs = [...tags(bar, { names: ['svg'] })];
  assert.equal(svgs.length, 1);
  assert.equal(svgs[0].attrs.role, 'img');
  const label = svgs[0].attrs['aria-label'];
  for (const v of [money(facts.pay), money(facts.gross), pct(facts.share, 2), money(facts.notPaid), money(facts.vbpBonus)]) assert.ok(label.includes(v), v);
  const dots = [...tags(bar, { names: ['path'] })].filter(({ attrs }) => attrs.class.split(' ').includes('chart-dots'));
  assert.equal(dots.length, 1);
  assert.equal(dots[0].attrs.d.match(/h0/g).length, facts.n);
  assert.equal(facts.n, hospitals.filter((h) => h.est).length);
  // Coordinates to a tenth at most.
  assert.doesNotMatch(dots[0].attrs.d, /\d\.\d\d/);
  for (const cls of ['sbar__frame', 'sbar__sliver', 'sbar__mag', 'sbar__np', 'sbar__bo']) assert.match(bar, new RegExp(`class="${cls}"`), cls);
  const said = textOf(bar);
  for (const v of [money(facts.pay), money(facts.notPaid), money(facts.vbpBonus), '×100', `FY${hub.fy}`, count(facts.n)]) assert.ok(said.includes(v), v);
  // The red figure beside the sliver has its words with it: color never says it alone.
  assert.ok(said.includes(`${money(facts.gross)}, ${pct(facts.share, 2)} moved by the programs`));
});

test('the scale bar\'s geometry is the data\'s: the sliver is the programs\' share of the bar, the split is not paid to bonuses, the dots run by pay', () => {
  const bar = element(out, '<figure class="sbar"', 'figure');
  const width = Number(/viewBox="0 0 (\d+) /.exec(bar)[1]);
  const rect = (cls) => {
    const found = [...tags(bar, { names: ['rect'] })].find(({ attrs }) => attrs.class === cls);
    return { x: Number(found.attrs.x), width: Number(found.attrs.width) };
  };
  // Coordinates are to a tenth of a unit, and the split's two parts sit a unit either side of the line between them.
  const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b}`);
  const sliver = rect('sbar__sliver');
  near(sliver.width / width, facts.gross / facts.pay, 0.05 / width, 'the sliver');
  near(sliver.x + sliver.width, width, 0.1, 'the sliver ends at the bar\'s end');
  const [np, bo] = [rect('sbar__np'), rect('sbar__bo')];
  const split = np.width + bo.width + 2;
  near(split / width, (facts.gross / facts.pay) * MAGNIFY, 0.2 / width, 'the split is the sliver magnified');
  near((np.width + 1) / split, facts.notPaid / facts.gross, 0.1 / split, 'not paid, of the split');
  near(np.x + split, width, 0.2, 'the split ends at the bar\'s end');
  // The dots' order: every hospital with an estimate once, by pay, each at the middle of its own slice of the total.
  const order = barOrder(hospitals);
  assert.equal(order.length, facts.n);
  assert.equal(new Set(order.map((o) => o.i)).size, facts.n);
  const pays = order.map((o) => hospitals[o.i].est.total);
  for (let k = 1; k < order.length; k++) {
    assert.ok(pays[k] >= pays[k - 1], `ascending pay at ${k}`);
    assert.ok(order[k].mid > order[k - 1].mid, `ascending middle at ${k}`);
  }
  near(order[0].mid, pays[0] / 2 / facts.pay, 1e-12, 'the first dot');
  near(order[order.length - 1].mid, 1 - pays[pays.length - 1] / 2 / facts.pay, 1e-9, 'the last dot');
});

test('the states map: a path per state and DC with its title line, shaded by its share in two inks, Maryland hatched', () => {
  const map = element(out, '<svg class="smap"', 'svg');
  const paths = [...map.matchAll(/<path class="(st[^"]*)" data-st="([A-Z]{2})"(?: style="--t:([0-9.]+)")? d="[^"]+"><title id="smap-name-\2">([^<]+)<\/title><\/path>/g)]
    .map(([, cls, code, t, title]) => ({ cls, code, t: t === undefined ? null : Number(t), title }));
  assert.equal(paths.length, US_MAP_CODES.length);
  assert.equal(paths.length, 51);
  assert.deepEqual(paths.map((p) => p.code).sort(), [...US_MAP_CODES].sort());
  for (const p of paths) {
    const s = states.get(p.code);
    if (p.code === 'MD') {
      assert.equal(p.cls, 'st st--md');
      assert.equal(p.t, null);
      assert.match(p.title, /^Maryland: not in these programs/);
      continue;
    }
    assert.equal(p.cls, `st st--${s.share < 0 ? 'pen' : 'rew'}`, p.code);
    assert.ok(p.t > 0 && p.t <= 1, `${p.code} --t ${p.t}`);
    const name = STATE_NAMES[p.code];
    assert.equal(p.title, `${name}: ${count(s.n)} hospital${s.n === 1 ? '' : 's'}, net ${pct(s.share, 2, { sign: true })} of pay, ${pct(s.cutN / s.n, 0)} take a net cut`);
    // A bonus state's share carries its sign.
    if (s.share > 0) assert.ok(p.title.includes(`net +${pct(s.share, 2)}`), p.code);
  }
  // A deeper share is never a lighter step; the state furthest from zero takes the full ink.
  const est = paths.filter((p) => p.t !== null);
  const share = (p) => Math.abs(states.get(p.code).share);
  for (const a of est) for (const b of est) if (share(a) > share(b)) assert.ok(a.t >= b.t, `${a.code} ${b.code}`);
  assert.equal(Math.max(...est.map((p) => p.t)), 1);
  // The hatch is a pattern in the page's ink, by class; no color is written into the map.
  assert.match(map, /<pattern id="smap-hatch"/);
  assert.doesNotMatch(map, /fill="(?!url)|stroke="/);
  // The key: its signed ends with the words cut and bonus, the scale's end the share it names, and Maryland's hatch.
  const key = element(out, '<div class="dkey"', 'div');
  const { end } = stateKey(states);
  assert.ok(end >= Math.max(...[...states.values()].filter((s) => !s.notInPrograms).map((s) => Math.abs(s.share))));
  assert.ok(textOf(key).includes(`${pct(-end, 1)} cut`));
  assert.ok(textOf(key).includes(`${pct(end, 1, { sign: true })} bonus`));
  assert.ok(textOf(key).includes('Maryland: not in these programs'));
  // Its title in full, and a short one the narrowest phones show instead (one line at 320 px), each with the year.
  assert.match(key, new RegExp(`<p class="dkey__t"><span class="dkey__long">State net change, est\\. FY${hub.fy}, % of Medicare inpatient pay</span><span class="dkey__short">Net change, est\\. FY${hub.fy}, % of pay</span></p>`));
  // The readout's prompt waits, hidden, for the script that makes the states answer to pointing, tapping and tabbing. It
  // is for the eye; a screen reader hears a state's line from the quiet region beside it, which the script fills when a
  // state is focused or picked (never when the pointer only passes over one).
  assert.match(out, /<p class="readout" hidden>Point at, tap or tab to a state for its numbers\.<\/p>\n<p class="vh" aria-live="polite" data-said><\/p>/);
});

test('what only a script uses is hidden: the small states\' buttons, the peer toggle, the canvas, the hero search, the readout', () => {
  const smalls = element(out, '<div class="smalls"', 'div');
  assert.match(smalls, /^<div class="smalls" hidden>/);
  assert.deepEqual([...smalls.matchAll(/data-st="([A-Z]{2})"/g)].map((m) => m[1]), ['VT', 'NH', 'MA', 'RI', 'CT', 'NJ', 'DE', 'MD', 'DC']);
  assert.match(element(out, '<div class="peers"', 'div'), /^<div class="peers" hidden>/);
  assert.match(out, /<canvas class="stage__cv" aria-hidden="true" hidden><\/canvas>/);
  const form = [...tags(out, { names: ['form'] })].find(({ attrs }) => attrs.class === 'omni omni--hero');
  assert.ok(form, 'the hero search');
  assert.equal(form.attrs['data-src'], assets.shell.hubUrl);
  assert.ok('hidden' in form.attrs);
  // A family search box (hub/client/search.js mounts it) that lists hospitals only.
  assert.ok('data-hub' in form.attrs);
  assert.equal(form.attrs['data-only'], 'hospital');
  assert.ok(step(8).includes('class="omni omni--hero"'), 'the search is in the last step');
  // The peer toggle's notes for a hospital with no group in a mode: the hospital page's words, hidden.
  const peers = element(out, '<div class="peers"', 'div');
  assert.ok(peers.includes('<p class="peers__why" id="peers-no-size" data-why="size" hidden>Same size: no bed count on record for this hospital.</p>'));
  assert.ok(peers.includes('<p class="peers__why" id="peers-no-teach" data-why="teach" hidden>Same teaching: no teaching status on record for this hospital.</p>'));
});

test('the live story\'s parts are in the markup, so its script adds no words: the step names "n/9", the progress line, the script', () => {
  // Each step's name with its place, hidden (the script shows the current one where the rail is hidden), in rail order.
  const now = element(out, '<ol class="nowstep"', 'ol');
  assert.match(now, /^<ol class="nowstep" aria-hidden="true" hidden>/);
  const rail = element(out, '<ol class="rail"', 'ol');
  const railWords = [...rail.matchAll(/<a href="#[^"]+">([^<]*)<\/a>/g)].map((m) => m[1]);
  const items = [...now.matchAll(/<li data-now="(\d)"><span class="nowstep__n">(\d)\/(\d)<\/span> <b>([^<]*)<\/b><\/li>/g)];
  assert.deepEqual(items.map((m) => [m[1], m[2], m[3], m[4]]), railWords.map((w, i) => [String(i), String(i + 1), '9', w]));
  // The progress line (no words) and the stage's canvas, inside the story; the scripts: the shell's and the header's
  // (every page's), the family search's (every hub page's: the bar's box and the last step's), then the story's.
  assert.match(out, /<div class="story__progress" aria-hidden="true"><\/div>/);
  assert.ok(out.indexOf('class="nowstep"') > out.indexOf('<div class="stage" data-stage>'), 'the step names are on the stage');
  const scripts = [...out.matchAll(/<script type="module" src="([^"]+)">/g)].map((m) => m[1]);
  assert.deepEqual(scripts, [assets.js.shell, assets.js.topbar, assets.js['hub-search'], assets.js['hub-home']]);
  // The example card names its hospital by CCN for the script.
  assert.match(element(out, '<div class="card"', 'div'), new RegExp(`^<div class="card" data-card data-ccn="${EXAMPLE_CCN}"`));
});

test('the example card: the example hospital, its place, beds, teaching, net, three programs, its state\'s peers and its page', () => {
  const h = hospitals.find((x) => x.ccn === EXAMPLE_CCN);
  const card = element(out, '<div class="card"', 'div');
  const said = textOf(card);
  assert.ok(said.includes(h.name));
  assert.ok(said.includes(`${h.city}, ${h.state}`));
  assert.ok(said.includes(`${count(h.beds)} beds, non-teaching`), 'its bed count and teaching status');
  assert.ok(said.includes(pct(h.est.share, 2)));
  assert.ok(said.includes(money(h.est.net, { sign: true })), 'its net as its page prints it');
  for (const label of ['Readmissions', 'Hospital-acquired conditions', 'Value-based purchasing']) assert.ok(said.includes(label), label);
  const peers = hospitals.filter((x) => x.est && x.state === h.state);
  assert.ok(said.includes(`Of ${count(peers.length)} ${STATE_NAMES[h.state]} hospitals, ${count(peers.filter((x) => x.est.net < 0).length)} take a net cut`));
  assert.ok(said.includes(pct(median(peers.map((x) => x.est.share)), 2)));
  assert.ok(said.includes(`FY${hub.fy}`));
  // Its page: the one place that sets it (a page the build emits: the link check holds it to one).
  assert.ok(card.includes(`<a class="card__go" href="${hospitalPathOf('hub', EXAMPLE_CCN)}">Open its hospital page`));
  // Its words are the ones the story's script writes for a found hospital (cardModel), each in its element.
  const m = cardModel(h, peersOf(hospitals, h, 'state'), 'state', hub.fy);
  for (const [cls, text] of [['card__nm', m.name], ['card__loc', m.place], ['card__pct', m.pct], ['card__usd', m.usd], ['card__netl', m.netWords], ['card__peer', m.peer]]) {
    assert.equal(textOf(element(card, `<[a-z]+ class="${cls}[" ]`, cls === 'card__pct' || cls === 'card__usd' ? 'span' : 'p')).trim(), text, cls);
  }
  assert.deepEqual([...card.matchAll(/<dt>([^<]*)<\/dt><dd class="([^"]*)">([^<]*)<\/dd>/g)].map((x) => [x[1], x[2], x[3]]),
    m.rows.map((r) => [r.label, r.kind ? `v v--${r.kind}` : 'v', r.text]));
});

test('a claim the words make that the data no longer bear out stops the build; the net heading says a share in words only near a simple fraction', () => {
  const render = (over) => homePage({ hospitals, facts: { ...facts, ...over }, states, shapes: hub.shapes, assets, robots: 'noindex' });
  // "most hospitals take a small cut" and "some move right".
  assert.throws(() => render({ hrrpCut: Math.floor(facts.n / 2) }), /no longer bear out/);
  assert.throws(() => render({ vbpBonusN: 0 }), /no longer bear out/);
  const near = simpleFraction(facts.netCut / facts.n);
  assert.ok(near === null || Math.abs(near.part / near.whole - facts.netCut / facts.n) <= 0.02);
  assert.deepEqual(simpleFraction(0.665), { part: 2, whole: 3 });
  assert.deepEqual(simpleFraction(0.5), { part: 1, whole: 2 });
  assert.deepEqual(simpleFraction(0.79), { part: 4, whole: 5 });
  assert.equal(simpleFraction(0.71), null);
  assert.match(textOf(step(5)), /^\s*((One|Two|Three|Four) of every (two|three|four|five) hospitals|\d+% of hospitals) take a net cut\./);
});

test('the built home page stays within the hub page budget (HTML, CSS and scripts, brotli)', { timeout: 120_000 }, () =>
  withTemp('pp-home-', async (dir) => {
    // The hub alone: the front page links the shared stylesheet and the hub's, never a program site's.
    await build({ outDir: join(dir, 'dist'), sites: [HUB] });
    const { total } = pageWeight(join(dir, 'dist'), 'index.html');
    assert.ok(total <= BUDGETS.hub, `${total} bytes > ${BUDGETS.hub}`);
  }));
