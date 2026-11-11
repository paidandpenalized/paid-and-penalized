// Step 4, one hospital: the record card, Figure 4 (the nested bar and the four factor rows) and what the browser redraws
// for the page's hospital. A hospital with no loss to draw (any class but scenario, a scenario hospital whose cost report
// gives no loss, or a hub hospital the file leaves out) gets its record card and its reason, never a bar, "$0", NaN or an
// empty table; a hospital's page across the programs is linked only where it exists; the random pick stays outside
// DEFAULT_SKIP_STATE. Fixtures pick hospitals by property, never by name.
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REPO_ROOT, masterPath, readJson } from '../../../pipeline/files.js';
import { textOf } from '../../../pipeline/site/html.js';
import { testAssets } from '../../../pipeline/test/helpers.js';
import { money } from '../../../web/render/format.js';
import { escapeHtml } from '../../../web/render/html.js';
import { hospitalPathOf } from '../../../web/site.js';
import { hospitalScenario } from '../../../engine/js/medicaid/hospital.js';
import { caseShareTexts, shareRange } from '../../../web/medicaid/format.js';
import { pageHospital } from '../client/find.js';
import { DEFAULT_SKIP_STATE, SCENARIOS } from '../web/constants.js';
import { COPY as REASON_COPY } from '../../../web/medicaid/copy.js';
import { REASONS } from '../../../web/medicaid/reasons.js';
import { COPY, t as words4 } from '../web/copy.js';
import { loadAway, loadHubCcns, loadMedicaid } from '../web/data.js';
import { programPage } from '../web/pages/program.js';
import {
  HB_DRAWINGS, HB_FONTS, awayRows, barLayout, cardHtml, decodeChunk, defaultPool, figureParts, hospChunks, numbersOf, randomPick, reasonOf,
  sayOf, serverPick, subjectOf,
} from '../web/program/hospital.js';
import { hospitalRows } from '../web/program/strips.js';
import { figure } from '../../../web/charts/figure.js';
import { html } from '../../../web/render/html.js';
import { textWidth } from '../../../web/charts/text.js';

const data = loadMedicaid();
const rows = hospitalRows(data);
const hubCcns = loadHubCcns();
const chunks = hospChunks(data, rows, hubCcns);
// The browser's copy: each state's asset as the page fetches it (JSON), decoded.
const decoded = new Map([...chunks].map(([code, chunk]) => [code, decodeChunk(JSON.parse(JSON.stringify(chunk)))]));
const subject = (row) => subjectOf(row, row.away ? null : decoded.get(row.state));
const col = Object.fromEntries(data.columns.map((name, i) => [name, i]));
const fileRow = (ccn) => data.hospitals.get(ccn);
const words = (markup) => textOf(String(markup)).replace(/\s+/g, ' ').trim();
const MIDDLE = SCENARIOS.indexOf('middle');
const away = awayRows(loadAway(data, hubCcns));
const page = programPage({ data, robots: 'noindex', assets: testAssets(), stripsUrl: '/assets/wr-strips.test.json', hubCcns });
const section = /<section class="step wr-step wr-hosp" id="hospital"[\s\S]*?<\/section>/.exec(page)?.[0] ?? '';

// No number that isn't one: what a card or a figure must never print.
const BAD = /NaN|undefined|null|Infinity|(?<![\d.,])\$0(?![\d.,])/;
function assertClean(markup, what) {
  const text = words(markup);
  assert.doesNotMatch(text, BAD, `${what}: ${text.match(BAD)?.[0]} in "${text.slice(0, 200)}…"`);
}

// A hospital of each kind, by property.
const byClass = (cls) => rows.find((r) => r.cls === cls);
const undrawn = (reason) => rows.find((r) => r.cls === 'scenario' && !r.share && reasonOf(subject(r)) === reason);

test('the state assets: every hospital in the file once, in its state\'s asset, with its engine fields as the file has them', () => {
  let n = 0;
  for (const [code, chunk] of decoded) {
    for (const rec of chunk.recs.values()) {
      n += 1;
      const row = fileRow(rec.ccn);
      assert.equal(row[col.state], code);
      for (const name of ['medicaid_net_revenue', 'net_patient_revenue', 'share', 'cost_ratio', 'has_margin', 'scored', 'hrrp', 'hac', 'flags']) {
        assert.deepEqual(rec[name], row[col[name]], `${rec.ccn} ${name}`);
      }
      assert.equal(rec.hub, hubCcns.has(rec.ccn));
      assert.equal(rec.drawn, Boolean(rows.find((r) => r.ccn === rec.ccn).share));
    }
  }
  assert.equal(n, data.hospitals.size);
  assert.throws(() => decodeChunk({ cols: ['ccn'], rows: [], code: 'XX' }), /not what the build wrote/);
});

test('a drawn hospital\'s dollars: the engine\'s, except the middle case at the default use rate, which prints the file\'s own results', () => {
  const FILE = { middle_lost: 'lost', middle_added_uncompensated: 'addedUncompensated', middle_operating_margin_after: 'operatingMarginAfter', middle_total_margin_after: 'totalMarginAfter' };
  let pinned = 0;
  for (const r of rows.filter((x) => x.share)) {
    const s = subject(r);
    const n = numbersOf(s, 1);
    const row = fileRow(r.ccn);
    // M1: the printed middle case at use 1 is the emitted numbers, exactly, wherever the file gives one.
    for (const [c, key] of Object.entries(FILE)) {
      if (row[col[c]] === null) continue;
      assert.equal(n.results[MIDDLE][key], row[col[c]], `${r.ccn} ${c}`);
      pinned += 1;
    }
    assert.equal(n.lost[MIDDLE], row[col.middle_lost]);
    const card = words(cardHtml(s, { k: MIDDLE, use: 1 }).text);
    assert.ok(card.includes(`${money(-row[col.middle_lost])} a year`), `${r.ccn}: the stamp prints the file's loss`);
    // The engine agrees with the file to its rounding: whole dollars, and the share column's 6 places.
    const engine = numbersOf(s, 1.05).lost[MIDDLE] / 1.05;
    assert.ok(Math.abs(engine - row[col.middle_lost]) <= 0.5 + n.m2 * 5e-7, `${r.ccn}: ${engine} against ${row[col.middle_lost]}`);
    assert.ok(n.lost[0] < n.lost[1] && n.lost[1] < n.lost[2], r.ccn);
    // The bar's arithmetic: patient revenue × Medicaid share × expansion share × decline = the loss (the engine's, low case).
    assert.ok(Math.abs(n.npr * n.ms * n.es * n.declines[0] - n.lost[0]) <= 1e-6 * n.lost[0], r.ccn);
  }
  assert.ok(pinned > 10000, `${pinned} values pinned`);
});

test('review focus 1: each class and each reason a scenario hospital has no loss renders its record card and reason line, never a bar, "$0" or NaN', () => {
  const cases = [
    ['scenario', byClass('scenario') && rows.find((r) => r.cls === 'scenario' && r.share)],
    ...['all_payer', 'not_expansion', 'no_viii_group', 'no_cost_report', 'territory'].map((cls) => [cls, byClass(cls)]),
    ...['negative', 'exceeds', 'no_medicaid', 'no_npr', 'tiny'].map((reason) => [reason, undrawn(reason)]),
    ['away_inactive', away.find((r) => r.away === 'inactive')],
  ];
  for (const [what, row] of cases) {
    assert.ok(row, `the file has a hospital for ${what}`);
    const s = subject(row);
    const reason = reasonOf(s);
    for (const k of SCENARIOS.keys()) {
      const card = cardHtml(s, { k, use: 1 }).text;
      const parts = figureParts(s, { k, use: 1 });
      assertClean(card, `${what} card`);
      assertClean(`${parts.cap} ${parts.alt} ${parts.note}`, `${what} figure words`);
      assert.ok(card.includes(`CCN ${s.ccn}`), `${what}: the record card`);
      if (what === 'scenario') {
        assert.equal(reason, null);
        assert.ok(parts.narrow && parts.wide, 'a drawn hospital has its bar');
        assert.match(card, /class="wr-rec__t"/, 'and its three cases');
        assert.equal(parts.table, true, 'and its figure\'s table');
        continue;
      }
      assert.equal(reason, what === 'scenario' ? null : what, what);
      assert.equal(parts.narrow, null, `${what}: no bar`);
      assert.equal(parts.wide, null, `${what}: no bar`);
      assert.equal(parts.facs, null, `${what}: no factor rows`);
      assert.doesNotMatch(card, /class="wr-rec__t"/, `${what}: no scenario table`);
      const why = REASON_COPY[`why_${what}`].text.replace('{state}', s.stateName).replace('{fy}', String(data.meta.fy));
      assert.ok(words(card).includes(why), `${what}: the reason line ("${why}")`);
      assert.ok(words(parts.none).includes(why), `${what}: the figure's reason panel`);
      assert.equal(parts.table, false, `${what}: the figure's table (and its CSV) hidden`);
      for (const [, , cell] of parts.cells) assert.equal(cell.value, null, `${what}: and no numbers in it`);
    }
  }
});

test('every hospital in the file, every case, the default and the extreme use rates: a figure exactly when step 1 draws it, and no bad number anywhere', () => {
  const seen = new Set();
  for (const r of [...rows, ...away]) {
    const s = subject(r);
    const reason = reasonOf(s);
    seen.add(reason);
    assert.equal(reason === null, Boolean(r.share), r.ccn);
    if (reason) assert.ok(REASONS.includes(reason), `${r.ccn}: ${reason}`);
    for (const use of reason ? [1] : [0.75, 1, 1.25]) {
      for (const k of SCENARIOS.keys()) {
        const parts = figureParts(s, { k, use });
        assertClean(cardHtml(s, { k, use }).text, `${r.ccn} card ${k} ${use}`);
        assertClean(`${parts.cap} ${parts.alt} ${parts.note} ${parts.facs ?? ''} ${parts.none ?? ''}`, `${r.ccn} figure ${k} ${use}`);
        assertClean(sayOf(s, { k, use }), `${r.ccn} live line`);
      }
    }
  }
  // away_kind, away_newer and no_share are guards: no hospital in today's file has any of them (away_newer has its own
  // test, on a synthetic newer master).
  const guards = new Set(['away_kind', 'away_newer', 'no_share']);
  for (const reason of [null, ...REASONS.filter((x) => !guards.has(x))]) assert.ok(seen.has(reason), `the file has a hospital with reason ${reason}`);
});

// The hub's hospital pages show each hospital through the engine's hospitalScenario (hub/hospital/medicaid.js), which reads
// the file's rows directly: it must give every hospital step 4's reason, and the shares step 4 prints at the default use
// rate (the file's own middle case), so a hospital reads the same on both.
test('the engine\'s one-hospital view (the hub\'s band) gives every hospital step 4\'s reason and default-rate shares', () => {
  let drawnSeen = 0;
  for (const r of rows) {
    const s = subject(r);
    const reason = reasonOf(s);
    const one = hospitalScenario(data, r.ccn);
    assert.equal(one.reason, reason, `${r.ccn}: the reason`);
    assert.equal(one.stateName, s.stateName, `${r.ccn}: the state's name`);
    if (reason) {
      assert.equal(one.shares, null, `${r.ccn}: no shares without a loss to draw`);
      continue;
    }
    drawnSeen += 1;
    const n = numbersOf(s, 1);
    assert.deepEqual(one.shares, n.share, `${r.ccn}: the shares step 4 prints`);
    // The strings: the record card's share row is the band's three cases, word for word (ruling R32).
    const printed = caseShareTexts(one.shares);
    assert.deepEqual(n.shareText, printed, `${r.ccn}: the shares as printed`);
    const shareRow = /<th scope="row">Share of patient revenue lost<\/th>(.*?)<\/tr>/.exec(cardHtml(s, { k: MIDDLE, use: 1 }).text)?.[1] ?? '';
    assert.deepEqual([...shareRow.matchAll(/<td[^>]*>(.*?)<\/td>/g)].map((m) => m[1]), printed, `${r.ccn}: the card's share row`);
    const range = shareRange(one.shares);
    if (range.under) assert.ok(printed.every((t) => t === range.under), `${r.ccn}: every case the headline's bound`);
    else assert.notEqual(printed[0], printed[2], `${r.ccn}: low and high print apart`);
    for (const t of printed) assert.doesNotMatch(t, /^0\.0+%$/, `${r.ccn}: no zero share`);
    assert.equal(one.shares[MIDDLE], fileRow(r.ccn)[col.middle_lost] / fileRow(r.ccn)[col.net_patient_revenue], `${r.ccn}: the middle case is the file's own`);
  }
  assert.equal(drawnSeen, rows.filter((r) => r.share).length);
  assert.equal(hospitalScenario(data, 'not-a-ccn'), null, 'a CCN the file has no row for');
});

// Task 12: the "under" decision reads the smallest share and the bound the largest, whatever their order, so a case that
// prints as zero never leaves a two-number range beside it.
test('printed shares: a case too small to print makes the range its bound, whichever case it is', () => {
  const under = (tiny) => REASON_COPY.shareUnder.text.replace('{tiny}', tiny);
  assert.deepEqual(shareRange([0.002, 0.0025, 0.003]), { low: '0.20%', high: '0.30%' }, 'ordered, printable: two numbers');
  // Out of order, the middle the smallest and too small to print: the range is the bound above the largest share.
  const out = [0.002, 0.0000001, 0.003];
  assert.deepEqual(shareRange(out), { under: under('0.301%') });
  assert.deepEqual(caseShareTexts(out), [under('0.301%'), under('0.301%'), under('0.301%')]);
  // The same shares in order read the same.
  assert.deepEqual(shareRange([0.0000001, 0.002, 0.003]), { under: under('0.301%') });
});

// R35 pinned: in the record card's scenario table, a value in words (a space: "under 0.001%") gets wr-rec__words and may
// break between them; a dollar amount or a percent never does. The CSS lets the words wrap, and at 374 px and below tightens
// the cells and sets the values a step smaller.
test('R35: a card cell in words wraps (wr-rec__words), a money or percent cell never; the narrow-phone block is in the CSS', () => {
  const cellsOf = (card, head) => [...(new RegExp(`<th scope="row">${head}</th>(.*?)</tr>`).exec(card)?.[1] ?? '').matchAll(/<td class="([^"]*)">(.*?)<\/td>/g)].map((m) => ({ cls: m[1].split(' ').filter(Boolean), text: m[2] }));
  const drawn = rows.filter((r) => r.share).map(subject);
  const tiny = drawn.find((s) => numbersOf(s, 1).shareText.some((x) => x.includes(' ')));
  const plain = drawn.find((s) => numbersOf(s, 1).shareText.every((x) => !x.includes(' ')));
  assert.ok(tiny && plain, 'the file has a hospital with a share in words and one without');
  for (const [s, what] of [[tiny, 'in words'], [plain, 'numbers']]) {
    const card = cardHtml(s, { k: MIDDLE, use: 1 }).text;
    const share = cellsOf(card, escapeHtml(words4('hRowShare')));
    const lost = cellsOf(card, escapeHtml(words4('hRowLost')));
    assert.equal(share.length, 3, `${what}: three share cells`);
    assert.equal(lost.length, 3, `${what}: three money cells`);
    for (const c of share) assert.equal(c.cls.includes('wr-rec__words'), c.text.includes(' '), `${what}: "${c.text}"`);
    for (const c of lost) assert.ok(!c.cls.includes('wr-rec__words') && /^[−-]?\$[\d,.]+[KMB]?$/.test(c.text), `${what}: a money cell "${c.text}"`);
    if (what === 'numbers') for (const c of share) assert.match(c.text, /^[\d.]+%$/, 'a percent cell, no words class');
  }
  assert.ok(cellsOf(cardHtml(tiny, { k: MIDDLE, use: 1 }).text, escapeHtml(words4('hRowShare'))).some((c) => c.cls.includes('wr-rec__words')), 'a cell in words is marked');
  const css = readFileSync(REPO_ROOT + 'sites/work-requirement/web/styles.css', 'utf8');
  assert.match(css, /\.wr-rec__t td\.wr-rec__words \{ white-space: normal; \}/, 'words wrap');
  assert.match(css, /\.wr-rec__t td \{ white-space: nowrap; \}/, 'numbers never');
  const narrow = /@media \(max-width: 374px\) \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
  assert.match(narrow, /\.wr-rec__t :is\(th, td\) \{ padding-inline: 2px; \}/, 'tighter cells at 374 px and below');
  assert.match(narrow, /\.wr-rec__t td \{ font-size: var\(--fs-xs\); \}/, 'the values a step smaller');
});

test('the stamp gives the scenario\'s loss alone: the Medicare penalties sit beside it, never added', () => {
  const r = rows.find((x) => x.share && fileRow(x.ccn)[col.hrrp] < 0 && fileRow(x.ccn)[col.hac] < 0);
  assert.ok(r, 'a drawn hospital with both penalties');
  const s = subject(r);
  const n = numbersOf(s, 1);
  const card = cardHtml(s, { k: MIDDLE, use: 1 }).text;
  const stampText = words(/<p class="stamp[^"]*">[\s\S]*?<\/p>/.exec(card)[0]);
  assert.ok(stampText.startsWith(`${money(-n.lost[MIDDLE])} a year`), stampText);
  const row = fileRow(r.ccn);
  assert.ok(words(card).includes(money(row[col.hrrp])) && words(card).includes(money(row[col.hac])), 'both penalties shown');
  assert.ok(!words(card).includes(money(-n.lost[MIDDLE] + row[col.hrrp] + row[col.hac])), 'never summed with the loss');
  assert.ok(card.includes(COPY.hPenNote.text), 'and said so');
});

test('the labels: the scenario\'s numbers carry SCENARIO · year $, the cost report MEASURED with its status', () => {
  for (const status of ['settled', 'as filed']) {
    const r = rows.find((x) => x.share && fileRow(x.ccn)[col.status] === status);
    const card = words(cardHtml(subject(r), { k: MIDDLE, use: 1 }).text);
    assert.ok(card.includes(`${COPY.hScenHead.text} SCENARIO · ${data.meta.fy} $`), card.slice(0, 300));
    assert.ok(card.includes(`Measured · ${status}`), status);
  }
});

test('review focus 2: a hospital\'s page across the programs is linked only where the hub has it; a critical access hospital without one gets no link', () => {
  const cah = rows.find((r) => fileRow(r.ccn)[col.kind] === 'critical_access' && !hubCcns.has(r.ccn));
  assert.ok(cah, 'a critical access hospital with no hub page');
  const linkOf = (r) => hospitalPathOf('hub', r.ccn);
  const card = cardHtml(subject(cah), { k: MIDDLE, use: 1 }).text;
  assert.ok(!card.includes(linkOf(cah)), 'no link to a page that does not exist');
  assert.doesNotMatch(card, /href="\/hospital\//);
  for (const r of rows) {
    const has = cardHtml(subject(r), { k: MIDDLE, use: 1 }).text.includes(`href="${linkOf(r)}"`);
    assert.equal(has, hubCcns.has(r.ccn), r.ccn);
  }
  // A hub hospital the file leaves out has its hub page by definition.
  for (const r of away) assert.ok(cardHtml(subject(r), { k: MIDDLE, use: 1 }).text.includes(`href="${linkOf(r)}"`), r.ccn);
});

test('a ?h= naming a hub hospital the file leaves out keeps it as the page\'s hospital, with its reason', () => {
  assert.ok(away.length > 0, 'the hub has hospitals the file leaves out');
  for (const r of away) {
    assert.ok(hubCcns.has(r.ccn) && !data.hospitals.has(r.ccn), r.ccn);
    assert.ok(['inactive', 'kind', 'newer'].includes(r.away));
  }
  const byCcn = new Map([...rows, ...away].map((r) => [r.ccn, r]));
  const one = away[0];
  assert.equal(pageHospital(`?h=${one.ccn}`, byCcn), one);
  const s = subject(one);
  assert.ok(words(cardHtml(s, { k: MIDDLE, use: 1 }).text).includes(REASON_COPY.stamp_away.text));
});

// CR2: the file holds every active acute-care and critical access hospital in the master it was built from
// (meta.hcris.master_fy), so a left-out hub hospital's reason is read from that master, not the newest. Here a newer master
// lists an active acute hospital the file's own master doesn't: it is 'newer', with its own words, never 'kind'.
test('a hub hospital only a newer master lists is away as "newer", with its reason line; one the file\'s own master lists as active acute must be in the file', () => {
  const built = readJson(REPO_ROOT + masterPath(data.meta.hcris.master_fy));
  const acute = built.hospitals.find((h) => h.kind === 'acute' && !h.inactive && data.hospitals.has(h.ccn));
  const NEW = '999999';
  assert.ok(!built.hospitals.some((h) => h.ccn === NEW) && !data.hospitals.has(NEW), 'the synthetic CCN is free');
  const newest = { ...built, hospitals: [...built.hospitals, { ...acute, ccn: NEW, name: 'Synthetic Newer Hospital' }] };
  const realAway = loadAway(data, hubCcns);
  const got = loadAway(data, new Set([...hubCcns, NEW]), { built, newest });
  assert.deepEqual(got.find(([ccn]) => ccn === NEW), [NEW, 'Synthetic Newer Hospital', acute.city ?? '', acute.state, 'newer']);
  assert.deepEqual(got.filter(([ccn]) => ccn !== NEW), realAway, 'the other left-out hospitals keep their reasons');
  // Through step 4: the away stamp and the newer sentence, no number.
  const [row] = awayRows(got.filter(([ccn]) => ccn === NEW));
  const s = subject(row);
  assert.equal(reasonOf(s), 'away_newer');
  const card = cardHtml(s, { k: MIDDLE, use: 1 }).text;
  assertClean(card, 'newer card');
  assert.ok(words(card).includes(REASON_COPY.stamp_away.text));
  assert.ok(words(card).includes(REASON_COPY.why_away_newer.text));
  // An active acute hospital in the file's own master with no row in the file is a broken file, not a reason.
  const without = { ...data, hospitals: new Map([...data.hospitals].filter(([ccn]) => ccn !== acute.ccn)) };
  assert.throws(() => loadAway(without, new Set([acute.ccn]), { built, newest: built }), /active acute hospital in the FY\d{4} master/);
});

// A seeded random source (mulberry32), so a draw repeats.
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = Math.imul(a ^ (a >>> 15), a | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

test('show another at random: 1,000 seeded draws, never a hospital in the skipped state, always one step 1 draws in a scenario state, never the one shown', () => {
  const pool = defaultPool(rows);
  assert.ok(rows.some((r) => r.share && r.state === DEFAULT_SKIP_STATE), 'the skipped state has drawn hospitals to leave out');
  const rng = seeded(20261110);
  let shown = pool[0].ccn;
  const states = new Set();
  for (let i = 0; i < 1000; i += 1) {
    const pick = randomPick(pool, rng, shown);
    assert.notEqual(pick.state, DEFAULT_SKIP_STATE);
    assert.ok(pick.share && pick.cls === 'scenario', pick.ccn);
    assert.notEqual(pick.ccn, shown);
    states.add(pick.state);
    shown = pick.ccn;
  }
  assert.ok(states.size > 20, 'draws spread across states');
  assert.equal(randomPick([], rng), null);
  assert.equal(randomPick([pool[0]], rng, pool[0].ccn), pool[0], 'a pool of one gives that one');
});

test('the server draws the hospital with the median middle-case loss, outside the skipped state', () => {
  const pick = serverPick(rows);
  const pool = defaultPool(rows);
  assert.notEqual(pick.state, DEFAULT_SKIP_STATE);
  assert.ok(pick.share);
  const below = pool.filter((r) => r.share[MIDDLE] < pick.share[MIDDLE]).length;
  const above = pool.filter((r) => r.share[MIDDLE] > pick.share[MIDDLE]).length;
  assert.ok(Math.abs(below - above) <= 1, `${below} below, ${above} above`);
  assert.ok(section.includes(`data-h-default="${pick.ccn}"`));
});

test('the page: step 4 drawn whole without a script, its controls hidden, and the server\'s markup the browser\'s own at the default', () => {
  assert.ok(section, 'step 4 is on the page');
  const s = subject(serverPick(rows));
  const view = { k: MIDDLE, use: 1 };
  assert.ok(section.includes(cardHtml(s, view).text), 'the card is the browser\'s');
  const parts = figureParts(s, view);
  for (const drawing of ['narrow', 'wide']) {
    const svg = new RegExp(`<svg[^>]*data-fit="${drawing}"[^>]*>([\\s\\S]*?)</svg>`).exec(section)?.[1];
    assert.equal(svg, parts[drawing].text, `${drawing}: the server's drawing is the browser's`);
  }
  assert.ok(section.includes(`Figure 4.</span> <span data-h-said>${escapeHtml(parts.cap)}</span>`), 'the caption, its takeaway in the span the browser rewrites');
  assert.ok(section.includes(parts.facs.text));
  assert.match(section, /data-h-pick hidden/, 'the random button waits for the script');
  assert.match(section, /<figure class="fig" id="figure-4"/);
  assert.match(section, /<details class="fig__table">/, 'a drawn hospital\'s table shows');
  for (const [row, j, cell] of parts.cells) assert.ok(section.includes(`data-value="${cell.value}" data-h="${row} ${j}"`), `${row} ${j}`);
  assertClean(section, 'the step');
});

test('reasonOf: an unforeseen case throws at the build, and gives the generic reason where the browser says it may', () => {
  const s = subject(rows.find((r) => r.cls === 'scenario' && r.share));
  const odd = { ...s, rec: { ...s.rec, drawn: false, scored: true, medicaid_net_revenue: 1e9, net_patient_revenue: 1e9, share: 1 } };
  assert.throws(() => reasonOf(odd), RangeError);
  const lenient = { ...odd, lenient: true };
  assert.equal(reasonOf(lenient), 'unforeseen');
  assert.equal(figureParts(lenient, { k: MIDDLE, use: 1 }).table, false);
  assert.ok(cardHtml(lenient, { k: MIDDLE, use: 1 }).text.includes('No scenario figure for this hospital.'));
  assert.ok(!REASONS.includes('unforeseen'));
});

test('the figure kit hides a table fold only when asked (step 4 asks for a hospital with no figure)', () => {
  const args = { n: 4, takeaway: 'x', chart: html`<p>x</p>`, source: 's', table: { columns: [{ name: 'a' }], rows: [['b']] } };
  assert.match(figure(args).text, /<details class="fig__table"><summary>/);
  assert.match(figure({ ...args, tableHidden: true }).text, /<details class="fig__table" hidden><summary>/);
});

// Each label's extent as drawn: x, anchor and its font (HB_FONTS), with the kit's width estimate.
function extent(label) {
  const f = HB_FONTS[label.cls];
  const w = textWidth(label.text, f.size, { mono: f.mono });
  const left = label.anchor === 'end' ? label.x - w : label.anchor === 'middle' ? label.x - w / 2 : label.x;
  return [left, left + w, label.y - f.size, label.y + f.size * 0.25];
}

test('every label in Figure 4 stays inside its drawing, whole, for every drawn hospital, case and use rate, phone and wide', () => {
  let n = 0;
  for (const r of rows.filter((x) => x.share)) {
    const s = subject(r);
    for (const use of [0.75, 1, 1.25]) {
      const nums = numbersOf(s, use);
      for (const k of SCENARIOS.keys()) {
        for (const drawing of ['narrow', 'wide']) {
          const g = HB_DRAWINGS[drawing];
          const layout = barLayout(nums, { k, use, drawing, status: s.rec.status });
          for (const label of layout.labels) {
            const [x0, x1, y0, y1] = extent(label);
            assert.ok(x0 >= 0 && x1 <= g.width && y0 >= 0 && y1 <= g.height, `${r.ccn} ${drawing} k${k} ${use}: "${label.text}" spans ${x0.toFixed(1)}–${x1.toFixed(1)} of ${g.width}`);
            assert.ok(!label.text.includes('…'), `${r.ccn}: "${label.text}" cut`);
            n += 1;
          }
          // The loss's label: the share of the expansion part its block is, the decline times the use rate.
          const loss = layout.labels.find((l) => l.cls === 'wr-hb__loss').text;
          const part = /([\d.]+)% (of the expansion part|\w+ decline)/.exec(loss);
          assert.ok(part, loss);
          assert.ok(Math.abs(Number(part[1]) / 100 - nums.declines[k] * use) < 0.0005 + 1e-12, `${r.ccn} ${drawing} k${k} ${use}: "${loss}"`);
          // The dashed ticks are the other two cases, and the range label names exactly those.
          const ticks = layout.lines.filter((l) => l.cls === 'wr-hb__tick').map((l) => l.k);
          assert.deepEqual(ticks, SCENARIOS.map((_, j) => j).filter((j) => j !== k));
          const range = layout.labels.map((l) => l.text).find((tx) => tx.includes('dashed:'));
          const named = [...range.slice(range.indexOf('dashed:')).matchAll(/\b(low|middle|high)\b/g)].map((m) => SCENARIOS.indexOf(m[1]));
          assert.deepEqual(named, ticks, `${r.ccn} k${k}: "${range}"`);
          for (const rect of layout.rects) assert.ok(rect.x >= 0 && rect.x + rect.w <= g.width + 1e-9 && rect.y + rect.h <= g.height, `${r.ccn} ${drawing}: ${rect.cls} outside`);
          // Labels on one row never overlap.
          const byRow = new Map();
          for (const label of layout.labels) byRow.set(label.y, [...(byRow.get(label.y) ?? []), extent(label)]);
          for (const boxes of byRow.values()) {
            for (let i = 0; i < boxes.length; i += 1) for (let j = i + 1; j < boxes.length; j += 1) {
              assert.ok(boxes[i][1] <= boxes[j][0] || boxes[j][1] <= boxes[i][0], `${r.ccn} ${drawing}: two labels overlap`);
            }
          }
        }
      }
    }
  }
  assert.ok(n > 300000, `${n} labels checked`);
});

test('the factor rows: each beside the state\'s other drawn hospitals, ranked among them; the decline the same for all', () => {
  const r = rows.find((x) => x.share && rows.filter((y) => y.share && y.state === x.state).length > 10);
  const s = subject(r);
  const parts = figureParts(s, { k: MIDDLE, use: 1 });
  const others = rows.filter((y) => y.share && y.state === r.state && y.ccn !== r.ccn).length;
  assert.ok(words(parts.note).includes(`other ${others.toLocaleString('en-US')} hospitals`), parts.note);
  assert.equal((parts.facs.text.match(/class="wr-rug"/g) ?? []).length, 3, 'three rugs; the decline has none');
  assert.equal((parts.facs.text.match(/class="wr-fac"/g) ?? []).length, 4);
  for (const m of words(parts.facs).matchAll(/than ([\d,]+) of the ([\d,]+)/g)) assert.equal(Number(m[2].replace(/,/g, '')), others);
});

// ---------- step 4 in the browser: the caption after a failed fetch ----------

// Step 4's parts as mountHospital looks them up, on stand-ins: the caption is the figure's number, its takeaway span and
// the scenario tag, so a test can see that only the span's text changes.
function stepFour() {
  const node = (extra = {}) => ({
    hidden: false, innerHTML: '', textContent: '', dataset: {}, attrs: {},
    setAttribute(k, v) { this.attrs[k] = String(v); },
    removeAttribute(k) { delete this.attrs[k]; },
    replaceChildren(...xs) { this.children = xs; },
    addEventListener(type, fn) { this.on = fn; },
    ...extra,
  });
  const said = node();
  const capN = node({ textContent: 'Figure 4.' });
  const tag = node({ textContent: 'scenario' });
  const cap = node({ children: [capN, ' ', said, ' ', tag] });
  const notePara = node();
  const note = node({ parentElement: notePara });
  const parts = { '[data-h-said]': said, '[data-h-fig]': node(), '[data-h-facs]': node(), '[data-h-none]': node(), '[data-h-note]': note, '.fig__table': node(), '.fig__cap': cap };
  const svgs = ['narrow', 'wide'].map((fit) => node({ dataset: { fit } }));
  const fig = { querySelector: (s) => parts[s] ?? null, querySelectorAll: (s) => (s === 'svg[data-fit]' ? svgs : []) };
  const card = node();
  const button = node();
  const pick = node({ querySelector: () => button });
  const own = { '[data-h-card]': card, '#figure-4': fig, '[data-h-pick]': pick, '[data-h-noscript]': node() };
  const section = { querySelector: (s) => own[s] ?? null };
  return { section, said, cap, capN, tag, card };
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

async function mountWithFetches(t, outcomes) {
  const { mountHospital } = await import('../client/hospital.js');
  const { createStore } = await import('../client/state.js');
  // Two drawn hospitals in one state, so a second pick fetches the same state's asset again.
  const drawnRows = rows.filter((r) => r.share);
  const first = drawnRows[0];
  const second = drawnRows.find((r) => r.state === first.state && r.ccn !== first.ccn);
  const calls = [];
  const saved = { fetch: globalThis.fetch, document: globalThis.document };
  globalThis.fetch = async (url) => {
    calls.push(url);
    const ok = outcomes[calls.length - 1];
    return ok ? { ok: true, json: async () => JSON.parse(JSON.stringify(chunks.get(first.state))) } : { ok: false, status: 503 };
  };
  globalThis.document = { createElement: () => ({}) };
  t.after(() => Object.assign(globalThis, saved));
  const store = createStore({ scenario: 'middle', use: 1, hospital: first, totals: null, stateCode: null });
  const dom = stepFour();
  mountHospital(dom.section, { store, rows, urls: { [first.state]: `/assets/wr-hosp-${first.state}.json` } });
  await settle();
  return { ...dom, store, first, second, calls };
}
const capWords = (row) => figureParts({ ...subject(row), lenient: true }, { k: MIDDLE, use: 1 }).cap;

test('step 4 in the browser: a failed fetch says so in the takeaway\'s span; a later success puts the takeaway back, the tag kept', async (t) => {
  const r = await mountWithFetches(t, [false, true]);
  assert.equal(r.said.textContent, words4('hFailed'));
  assert.deepEqual(r.cap.children, [r.capN, ' ', r.said, ' ', r.tag], 'the caption\'s parts are where they were');
  r.store.set({ hospital: r.second });
  await settle();
  assert.equal(r.calls.length, 2, 'the failed asset is fetched again');
  assert.equal(r.said.textContent, capWords(r.second), 'no stale failure text');
  assert.deepEqual(r.cap.children, [r.capN, ' ', r.said, ' ', r.tag]);
});

test('step 4 in the browser: two failures in a row leave one failure line and the scenario tag', async (t) => {
  const r = await mountWithFetches(t, [false, false]);
  r.store.set({ hospital: r.second });
  await settle();
  assert.equal(r.calls.length, 2);
  assert.equal(r.said.textContent, words4('hFailed'));
  assert.deepEqual(r.cap.children, [r.capN, ' ', r.said, ' ', r.tag], 'the tag is still there');
});

test('step 4\'s takeaway is written in its own span inside the caption, before the scenario tag', () => {
  assert.match(section, /<figcaption class="fig__cap" id="figure-4-cap"><span class="fig__n">[^<]*<\/span> <span data-h-said>[^<]+<\/span> <span class="[^"]*"/);
});
