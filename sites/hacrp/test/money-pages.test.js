// The money on the program page, the place pages and Methods (money-data.js, money-part.js, pages/*.js), on the
// pinned data: the aggregates add up to the emitted file's own headline; every figure's takeaway is the data's; no
// hospital is named outside a tooltip (DES-25); the national total always says how many of CMS's cut hospitals it
// covers; Methods holds the dollars section every estimate tag links to; and every in-site anchor on the built pages
// lands on an element of its page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { build } from '../../../pipeline/site/build.js';
import { withTemp } from '../../../pipeline/test/helpers.js';
import { count, decimal, dollars, money, pct } from '../../../web/render/format.js';
import { HUB } from '../../../hub/pages.js';
import { HACRP, generateHacrp } from '../web/generate.js';
import { ACROSS_WINDOW } from '../web/money-part.js';
import { moneyData, nearLine, placeMoney } from '../web/money-data.js';
import { DOLLARS_HREF } from '../web/links.js';
import { methodsPage } from '../web/pages/methods.js';
import { DATA, HD, MD, PLACES, renderPlace, renderProgram } from './pinned.js';
import { ASSETS } from './fixtures.js';

const PROGRAM = renderProgram();
const part = /<section class="part" id="money"[\s\S]*?<\/section>\n<section class="part" id="map"/.exec(PROGRAM)[0];
const strip = (s) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/\s+/g, ' ');
const captionOf = (html, id) => strip(/<figcaption class="fig__cap"[^>]*>([\s\S]*?)<\/figcaption>/.exec(new RegExp(`<section class="psec[^"]*" id="${id}"[\\s\\S]*?</section>`).exec(html)[0])[1]);

test('the money\'s aggregates add up to the emitted file\'s own headline: CMS\'s cut count, the hospitals estimated, the dollars', () => {
  const h = DATA.dollars.headline;
  assert.equal(MD.headline.yes, h.yes);
  assert.equal(MD.headline.cut, h.cut);
  assert.equal(MD.headline.yesUnestimated, h.yesUnestimated);
  assert.equal(MD.headline.money, -h.hac);
  assert.equal(MD.headline.hrrp, h.hrrp);
  assert.equal(MD.headline.hvbp, h.hvbp);
  assert.equal(MD.headline.hospitals, h.hospitals);
  // Each breakdown adds back to the whole.
  for (const k of MD.byKind) assert.ok(k.groups.reduce((s, g) => s + g.money, 0) <= MD.headline.money, k.kind);
  const teach = MD.byKind.find((k) => k.kind === 'teach');
  assert.ok(teach.groups.every((g) => g.n > 0));
  assert.equal([...MD.byState.values()].reduce((s, st) => s + st.money, 0), MD.headline.money, 'the states add to the nation');
  assert.equal([...MD.byState.values()].reduce((s, st) => s + st.cutHospitals, 0), MD.headline.cut);
  const sorted = MD.cutRows.map((r) => r.cut).sort((a, b) => b - a);
  assert.equal(MD.tenth.n, Math.ceil(sorted.length / 10));
  assert.equal(MD.tenth.money, sorted.slice(0, MD.tenth.n).reduce((a, b) => a + b, 0));
  // A slice of the hospitals sums over itself (the build's tests pass slices).
  const slice = moneyData({ hospitals: DATA.hospitals.slice(0, 50), master: DATA.master, dollars: DATA.dollars, model: DATA.model });
  assert.ok(slice.headline.cut <= slice.headline.yes);
  // A place's money: its share of the nation's, and per stay over its hospitals' stays.
  const state = PLACES.list.find((p) => p.kind === 'state' && p.counts.yes > 5);
  const pm = placeMoney(MD, state.ccns);
  assert.equal(pm.money, MD.byState.get(state.key.toUpperCase())?.money ?? pm.money);
  assert.equal(pm.share, pm.money / MD.headline.money);
});

test('the program page\'s summary and the Part on the money say how many of CMS\'s cut hospitals the national total covers', () => {
  const words = `${count(MD.headline.cut)} of the ${count(MD.headline.yes)} hospitals CMS cut`;
  const summary = /<div class="form prog__summary">[\s\S]*?<p class="stamp">/.exec(PROGRAM)[0];
  assert.ok(strip(summary).includes(money(MD.headline.money)));
  assert.ok(strip(summary).includes(words), 'the summary field');
  const intro = strip(/<header class="part__head">[\s\S]*?<\/header>/.exec(part)[0]);
  assert.ok(intro.includes(money(MD.headline.money)));
  assert.ok(intro.includes(`${count(MD.headline.cut)} of the ${count(MD.headline.yes)} hospitals CMS cut`));
  assert.ok(intro.includes(`no usable row for the other ${count(MD.headline.yesUnestimated)}`));
  // Every dollar figure says it is an estimate, and the summary's range is pending (a production build refuses it).
  assert.match(summary, /class="est-tag" href="\/hacrp\/methods\/#dollars"/);
  assert.match(summary, /money__range--pending/);
});

test('the Part on the money: at least five figures, each beside its words, each takeaway the data\'s', () => {
  const figs = [...part.matchAll(/<figure class="fig" id="figure-(\d+)" data-figure>/g)];
  assert.ok(figs.length >= 5, `${figs.length} figures`);
  assert.equal(captionOf(part, 'bill').replace(/^Figure \d+\. /, ''), `The largest tenth of the cuts, ${count(MD.tenth.n)} hospitals, are ${pct(MD.tenth.money / MD.headline.money, 0)} of the ${money(MD.headline.money)} this site estimates the program took.`);
  const near = nearLine(MD, ACROSS_WINDOW);
  const over = near.filter((r) => r.yes);
  const under = near.filter((r) => !r.yes);
  const sum = (rows) => rows.reduce((s, r) => s + r.atStake, 0);
  assert.equal(captionOf(part, 'across').replace(/^Figure \d+\. /, ''), `Within ${decimal(ACROSS_WINDOW, 2)} of CMS’s line, CMS cut ${count(over.length)} hospitals, about ${money(sum(over))} by this site’s estimate; the ${count(under.length)} just under it kept about ${money(sum(under))}.`);
  // Shares: the group whose money most outruns its count, from the data.
  const all = MD.byKind.filter((k) => ['teach', 'beds', 'own', 'urban'].includes(k.kind)).flatMap((k) => k.groups);
  const top = all.reduce((a, b) => (b.shareMoney / b.shareHospitals > a.shareMoney / a.shareHospitals ? b : a));
  const shares = captionOf(part, 'shares');
  assert.ok(shares.includes(`are ${pct(top.shareHospitals, 0)} of the hospitals CMS cut and ${pct(top.shareMoney, 0)} of the money`), shares);
  // States: the range of the states' dollars.
  const states = [...MD.byState.values()].filter((s) => s.money > 0);
  const st = captionOf(part, 'states');
  assert.ok(st.includes(`from ${money(Math.min(...states.map((s) => s.money)))} to ${money(Math.max(...states.map((s) => s.money)))}`), st);
  // Three programs: each total.
  const three = captionOf(part, 'three');
  for (const x of [money(-MD.headline.hrrp), money(MD.headline.hvbp), money(MD.headline.money)]) assert.ok(three.includes(x), `${x} in "${three}"`);
  // Every figure's words sit beside it (or over it).
  for (const id of ['bill', 'across', 'shares', 'states', 'three']) assert.match(part, new RegExp(`<section class="psec[^"]*" id="${id}"[\\s\\S]*?<div class="psec__text">[\\s\\S]*?<div class="psec__fig">\\n<figure`), id);
});

test('DES-25: no hospital is named on the money\'s Part outside a tooltip, and no figure table lists hospitals', () => {
  const words = part.replace(/<svg[\s\S]*?<\/svg>/g, '');
  const names = new Set(MD.cutRows.map((r) => r.name).filter((n) => n.length > 14));
  const named = [...names].filter((n) => words.includes(n) || words.includes(n.replace(/&/g, '&amp;').replace(/'/g, '&#39;')));
  assert.deepEqual(named, [], 'names only in the drawings\' tooltips');
  // Inside the drawings, a name appears only in a <title>.
  const drawings = [...part.matchAll(/<svg[\s\S]*?<\/svg>/g)].map((m) => m[0].replace(/<title>[^<]*<\/title>/g, '')).join('');
  assert.deepEqual([...names].filter((n) => drawings.includes(n)), []);
  // The figures' tables are aggregates: each row is a group, a side of the line, a state or a program.
  const rows = [...part.matchAll(/<details class="fig__table">[\s\S]*?<\/details>/g)].flatMap((m) => [...m[0].matchAll(/<tr><th scope="row"[^>]*>([^<]*)</g)].map((r) => r[1]));
  assert.ok(rows.length > 0);
  assert.ok(rows.length < 120, `${rows.length} rows: no list of hospitals`);
});

test('the score rule\'s dollars view: drawn beside the hospitals\' view, its caption\'s share the data\'s', () => {
  const fig = /<figure class="rulefig rulefig--views"[\s\S]*?<\/figure>/.exec(PROGRAM)[0];
  assert.match(fig, /data-rule-view="hospitals"/);
  assert.match(fig, /data-rule-view="money" hidden/);
  assert.match(fig, /class="chart chart--money-rule"/);
  const atStake = new Map(MD.rows.map((r) => [r.ccn, r.atStake]));
  const total = MD.rows.reduce((s, r) => s + r.atStake, 0);
  const cut = MD.cutRows.reduce((s, r) => s + r.atStake, 0);
  assert.ok(atStake.size > 0);
  assert.ok(strip(fig).includes(`the cut side is ${pct(cut / total, 0)} of the money at stake`));
});

test('a place page: its estimate against the nation\'s, its children\'s dollars, its hospitals across the line', () => {
  const state = PLACES.list.find((p) => p.kind === 'state' && p.children.length > 1 && nearLine(MD, ACROSS_WINDOW).some((r) => p.ccns.includes(r.ccn)));
  const page = renderPlace(state);
  const pm = placeMoney(MD, state.ccns);
  const card = strip(/<div class="place__card">[\s\S]*?<\/div>\n<p class="stamp/.exec(page)[0]);
  assert.ok(card.includes(money(pm.money)));
  assert.ok(card.includes(`${pct(pm.share, 1)} of the nation’s ${money(MD.headline.money)}`));
  assert.ok(card.includes(dollars(Math.round(pm.perStay))) && card.includes(`The nation: ${dollars(Math.round(MD.perStay))}`));
  assert.match(page, /<th scope="col" class="num">Est\. cut \(\$, modeled\)<\/th>/);
  assert.match(page, /<section class="psec psec--wide" id="across"/);
  assert.match(page, /chart-across__dot--faint/, 'the nation\'s other hospitals faint');
});

test('Methods: how this site estimates the dollars, at the anchor every estimate tag links to', () => {
  const page = methodsPage({
    fy: DATA.fy, checks: HD.checks.map((c) => ({ fy: c.fy, rule: 'rule', check: c.check })), years: HD.years.map((y) => ({ fy: y.fy, periods: y.periods })),
    newest: { rows: DATA.sourceRows, source: DATA.source, pin: DATA.manifest.find((e) => e.id === DATA.source.id), measures: 6, pages: 1, sourceLine: 'Source.' },
    pins: [], changes: [], estimate: { tolerance: 0.001, tagged: null, maxError: null }, boundaryText: DATA.boundaryText, eqFy: 2020, zFy: 2018,
    robots: null, assets: ASSETS, searchUrl: null, dollars: DATA.dollars,
  });
  const id = DOLLARS_HREF.split('#')[1];
  const sec = new RegExp(`<section class="msec" id="${id}"[\\s\\S]*?</section>`).exec(page)[0];
  const h = DATA.dollars.headline;
  const pipe = /<ol class="pipe pipe--dollars"[\s\S]*?<\/ol>/.exec(sec)[0];
  for (const x of [money(h.base), money(h.hrrp), money(h.hvbp), money(h.after), money(h.hac)]) assert.ok(strip(pipe).includes(x), x);
  assert.ok(strip(pipe).includes(`for ${count(h.cut)} of the ${count(h.yes)} hospitals CMS cut`));
  // The tape: one line per check, its result.
  const tape = /<div class="receipt receipt--dollars">[\s\S]*?<\/div>/.exec(sec)[0];
  assert.equal([...tape.matchAll(/<tr><th scope="row">/g)].length, DATA.dollars.checks.length);
  assert.equal([...tape.matchAll(/class="receipt__ok">pass</g)].length, DATA.dollars.checks.filter((c) => c.pass).length);
  // The assumptions: two columns, NTAP among them; the back-test's place, pending.
  assert.match(sec, /<th scope="col">Assumption<\/th><th scope="col">Effect on the estimate<\/th>/);
  assert.match(strip(sec), /New-technology add-on payments are left out/);
  assert.match(sec, /class="backtest-pending"/);
  assert.match(strip(sec), new RegExp(`add the ${count(h.cut)} of CMS’s ${count(h.yes)} cut hospitals`));
});

// Every in-site link with a fragment that names an element (#id), on every page the build writes, lands on an element
// with that id in its page. Fragments that carry state (#state=XX, a what-if's #whatif&…) are not ids and are skipped.
test('every in-site anchor on the built pages lands on an element of its page', () =>
  withTemp('pp-anchors-', async (dir) => {
    const slice = { ...DATA, hospitals: DATA.hospitals.filter((h, i) => i % 97 === 0 || (h.total === null && h.paymentReduction === 'Yes')) };
    const hacrp = { ...HACRP, generate: (ctx) => generateHacrp(ctx, { data: slice, log: () => {} }) };
    const out = join(dir, 'dist');
    await build({ outDir: out, sites: [hacrp, HUB] });
    const pages = [];
    const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (f === 'index.html') pages.push(p); } };
    walk(out);
    const ids = new Map();
    const idsOf = (file) => {
      if (!ids.has(file)) ids.set(file, new Set([...readFileSync(file, 'utf8').matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
      return ids.get(file);
    };
    let checked = 0;
    for (const file of pages) {
      const text = readFileSync(file, 'utf8');
      for (const [, path, frag] of text.matchAll(/href="(\/[^"#]*)?#([^"]+)"/g)) {
        if (/[=&]/.test(frag)) continue;
        const target = path ? join(out, path, 'index.html') : file;
        assert.ok(existsSync(target), `${file}: ${path} is not a page`);
        assert.ok(idsOf(target).has(frag), `${file.slice(out.length)}: #${frag} is not on ${path ?? 'its page'}`);
        checked++;
      }
    }
    assert.ok(checked > 100, `${checked} anchors checked`);
    assert.ok(idsOf(join(out, 'hacrp', 'methods', 'index.html')).has(DOLLARS_HREF.split('#')[1]), 'Methods holds #dollars');
  }));
