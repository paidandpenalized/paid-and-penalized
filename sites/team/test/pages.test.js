// The TEAM program page (7a: the scaffold, the registration and the static Parts): its generator (two pages, unreleased:
// noindex and out of the sitemap), the section menu, each Part's figure beside its words, the copy's rules (no digits,
// claims that resolve, never a penalty), "standardized dollars" beside every dollar figure, and the counts it states,
// each from the emitted file. Rows are picked by property; failures print counts, never a hospital.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from '../../../pipeline/files.js';
import { KIT_STYLES } from '../../../pipeline/site/assets.js';
import { createContext } from '../../../pipeline/site/context.js';
import { textOf } from '../../../pipeline/site/html.js';
import { headerOf, readerWords, testAssets, withTemp } from '../../../pipeline/test/helpers.js';
import { reconcile } from '../../../engine/js/team/reconcile.js';
import { CATEGORIES } from '../../../engine/js/team/params.js';
import { SITE, programById } from '../../../web/site.js';
import { CLAIM_PREFIX, EXAMPLE, SECTIONS, TRACKS } from '../web/constants.js';
import { COPY } from '../web/copy.js';
import { COPY as LOOKUP, lookupFile } from '../web/lookup-copy.js';
import { COPY as SEARCH } from '../../../hub/search/copy.js';
import { escapeHtml } from '../../../web/render/html.js';
import { loadAtlas, loadMaster, loadSources, loadTeam } from '../web/data.js';
import { TEAM, generateTeam, lookupMissing } from '../web/generate.js';
import { METHODS_PATH, PROGRAM_PATH } from '../web/links.js';
import { programPage } from '../web/pages/program.js';
import { methodsPage } from '../web/pages/methods.js';
import { mapCounts } from '../web/program/who.js';

const team = loadTeam();
const master = loadMaster();
const atlas = loadAtlas();
const assets = testAssets();
const LOOKUP_URL = '/assets/team-lookup.test.json';
const CALC_URL = '/assets/team-calc.test.json';
const program = programPage({ team, master, atlas, robots: 'noindex', assets, lookupUrl: LOOKUP_URL, calcUrl: CALC_URL, search: { cols: ['ccn', 'name', 'city', 'state', 'kind'], rows: [[team.defaultCcn, 'Example Hospital', null, 'KY', 'acute']], states: {} } });
const methods = methodsPage({ team, sources: loadSources(team), robots: 'noindex', assets });
const words = (html) => textOf(html).replace(/\s+/g, ' ').trim();
const main = (page) => /<main[\s\S]*?<\/main>/.exec(page)[0];
// A Part by its id: the markup from its section's start to the next Part's (or the article's end).
const part = (id) => {
  const at = program.indexOf(`<section class="tm-part" id="${id}"`);
  assert.ok(at >= 0, `Part ${id}`);
  const next = program.indexOf('<section class="tm-part"', at + 1);
  return program.slice(at, next < 0 ? program.indexOf('</article>', at) : next);
};

test('the manifest: id, the kit\'s styles then the site\'s own, the program page\'s script', () => {
  assert.equal(TEAM.id, 'team');
  assert.deepEqual(TEAM.styles, [...KIT_STYLES, 'sites/team/web/styles.css']);
  assert.deepEqual(TEAM.entries, { 'team-page': 'sites/team/client/page.js' });
  assert.ok(program.includes(`<script type="module" src="${assets.js['team-page']}"></script>`), 'the program page loads it');
});

test('the site is registered unreleased: a live program, noindex and out of the sitemap even in production', () =>
  withTemp('pp-team-', async (dir) => {
    assert.equal(SITE.sites.team.released, false);
    assert.equal(SITE.sites.team.path, PROGRAM_PATH);
    assert.equal(programById('team').stage, 'live');
    const ctx = createContext({ outDir: dir, env: 'production', assets });
    const lines = [];
    const result = generateTeam(ctx, { team, master, atlas, search: searchOf(lookupFile(team).rows), log: (l) => lines.push(l) });
    assert.ok(lines.some((l) => /every one of [\d,]+ hospitals the lookup places can be found/.test(l)), 'the coverage line');
    assert.equal(ctx.pages, 2);
    assert.deepEqual([...ctx.indexable], [], 'nothing in the sitemap');
    for (const path of [PROGRAM_PATH, METHODS_PATH]) {
      assert.ok(readFileSync(join(dir, path, 'index.html'), 'utf8').includes('<meta name="robots" content="noindex">'), path);
    }
    // The lookup's codes: one hashed file, named on the program page, holding lookupFile's object.
    const named = /data-codes="(\/assets\/team-lookup\.[0-9a-f]{8}\.json)"/.exec(readFileSync(join(dir, PROGRAM_PATH, 'index.html'), 'utf8'));
    assert.ok(named, 'the program page names the lookup\'s file');
    assert.deepEqual(JSON.parse(readFileSync(join(dir, named[1]), 'utf8')), JSON.parse(JSON.stringify(lookupFile(team))));
    // The newest date of CMS's among the inputs the page shows, and the day the file was built.
    const dates = [team.meta.listAsOf, team.meta.cjrxAsOf, team.meta.pricesDated, team.meta.qualityReleased].sort();
    assert.deepEqual(result, { updated: { cmsReleased: dates.at(-1), changed: team.built_at.slice(0, 10) } });
  }));

test('the program page: one h1, the TEAM tab current, the section menu (seven Parts, then Methods)', () => {
  assert.equal(program.match(/<h1[ >]/g).length, 1);
  assert.equal(words(/<h1[\s\S]*?<\/h1>/.exec(program)[0]), 'TEAM, hospital by hospital');
  const header = headerOf(program);
  assert.match(header, /<a class="tab" href="\/team\/" aria-current="page">/);
  const menu = [...header.matchAll(/<a href="([^"]+)" data-nav="([^"]+)"/g)].map((m) => m[2]);
  assert.deepEqual(menu, [...SECTIONS, 'methods']);
  assert.deepEqual(SECTIONS, ['who', 'change', 'money', 'bar', 'yours', 'do', 'find']);
});

test('every Part is an anchored section, in order, numbered, with its heading', () => {
  const at = SECTIONS.map((id) => program.indexOf(`<section class="tm-part" id="${id}"`));
  assert.ok(at.every((i) => i >= 0));
  assert.deepEqual([...at].sort((a, b) => a - b), at);
  SECTIONS.forEach((id, i) => {
    const p = part(id);
    assert.match(words(p), new RegExp(`^Part ${i + 1} · `), `${id}: its tag`);
    assert.match(p, /<h[12][^>]*>[^<]+/, `${id}: a heading`);
  });
});

// The family's layout: each Part's words beside its figure; Part 5's is the calculator.
test('Parts 1, 2, 3, 4, 6 and 7 each set a figure beside their words', () => {
  for (const id of ['who', 'change', 'money', 'bar', 'do', 'find']) {
    const p = part(id);
    assert.match(p, /<div class="tm-part__text[^"]*">/, `${id}: words`);
    const fig = /<div class="tm-part__fig[^"]*">([\s\S]*)/.exec(p);
    assert.ok(fig, `${id}: a figure column`);
    assert.match(fig[1], /<figure\b|<table\b/, `${id}: a figure or table in it`);
  }
  assert.match(part('yours'), /<section id="calc" class="tc" data-src="\/assets\/team-calc\.test\.json"/);
  // The figures shorter than their words (the map, the clock) stay beside them on a wide screen: sticky in a figure
  // column that runs the Part's height (styles.css, from 62em only).
  for (const id of ['who', 'do']) assert.match(part(id), /<div class="tm-part__fig"><div class="tm-sticky">/, `${id}: sticky`);
  const css = readFileSync(REPO_ROOT + 'sites/team/web/styles.css', 'utf8');
  const wide = css.slice(css.indexOf('@media (min-width: 62em) {'), css.indexOf('\n}\n', css.indexOf('@media (min-width: 62em) {')));
  assert.match(wide, /\.tm-part__fig \{ align-self: stretch; \}/);
  assert.match(wide, /\.tm-sticky \{ position: sticky;/);
  assert.doesNotMatch(css.replace(wide, ''), /\.tm-(sticky|part__fig)[^{]*\{[^}]*position: sticky/, 'a figure is sticky only from 62em');
  // The hero's button goes to the calculator.
  assert.match(part('who'), /<a class="tm-go" href="#calc">/);
});

// A family search file holding these CCNs (the coverage check reads only the CCNs and names).
const searchOf = (rows) => ({ cols: ['ccn', 'name', 'city', 'state', 'kind'], rows: rows.map(([ccn]) => [ccn, 'Example Hospital', null, 'AL', 'acute']), states: {} });

// The coverage check: every CCN the lookup's codes place is in the family search's file (only those can be listed), or
// the build stops, saying how many are missing, never which.
test('the build stops when a hospital the lookup places is missing from the family search', async () => {
  const { rows } = lookupFile(team);
  assert.deepEqual(lookupMissing(rows, searchOf(rows)), []);
  const short = searchOf(rows.slice(2));
  assert.equal(lookupMissing(rows, short).length, 2);
  await withTemp('pp-team-', async (dir) => {
    const ctx = createContext({ outDir: dir, env: 'production', assets });
    assert.throws(() => generateTeam(ctx, { team, master, atlas, search: short, log: () => {} }), (e) => e instanceof RangeError && /^TEAM lookup: 2 hospitals/.test(e.message) && !rows.slice(0, 2).some(([ccn]) => e.message.includes(ccn)));
  });
  // A row without a name can't be found by one.
  const nameless = searchOf(rows);
  nameless.rows[0][1] = '';
  assert.equal(lookupMissing(rows, nameless).length, 1);
});

// Part 1's lookup box (client/lookup.js runs it): its heading is the visible label of its box; the box, hidden until the
// script shows it, and the polite region the answers go in; the two files the script fetches on the box's first focus
// (the family search's and the lookup's codes), named, never loaded by the page; the no-JS sentence; the list's date.
test('Part 1\'s lookup box: a labeled search box, both files named for the script, a polite region, the no-JS sentence', () => {
  const box = /<section class="tm-look"[\s\S]*?<\/section>/.exec(part('who'))[0];
  assert.ok(box.includes(`<h2 class="tm-look__h" id="look-h"><label for="look">${COPY.lookupHeading.text}</label></h2>`), 'the heading labels the box');
  const mount = /<search [^>]*data-team-lookup[^>]*>/.exec(box)?.[0];
  assert.ok(mount, 'a search landmark holds the box');
  assert.ok(mount.includes(`data-src="${assets.shell.searchUrl}"`), 'the family search\'s file');
  assert.ok(mount.includes(`data-codes="${LOOKUP_URL}"`), 'the lookup\'s codes');
  assert.ok(mount.includes(`data-failed="${escapeHtml(SEARCH.searchFailed)}"`), 'the words for a failed load');
  const input = /<input [^>]*>/.exec(box)[0];
  for (const attr of ['id="look"', 'type="search"', 'autocomplete="off"', 'spellcheck="false"', ' hidden']) assert.ok(input.includes(attr), attr);
  assert.ok(input.includes(`placeholder="${COPY.lookupPlaceholder.text}"`));
  // Only the sentence over the rows is live; the rows' list is plain content after it.
  assert.match(box, /<div class="tm-look__out"><p class="tm-look__count" aria-live="polite"><\/p><ul class="tm-look__list"><\/ul><\/div>/);
  assert.equal(box.match(/aria-live/g).length, 1);
  assert.ok(box.includes(`<p class="tm-look__nojs">${COPY.lookupNoScript.text}</p>`));
  assert.doesNotMatch(program, /<link[^>]*(team-lookup|hub-search)/, 'neither file is preloaded');
});

test('the copy holds no digit; every claim id is the site\'s and resolves to a checked row', () => {
  const register = readFileSync(REPO_ROOT + 'sites/team/CLAIMS.md', 'utf8');
  const rows = new Map(register.split('\n').filter((l) => l.startsWith(`| ${CLAIM_PREFIX}-`)).map((l) => {
    const cells = l.split('|').slice(1, -1).map((c) => c.trim());
    return [cells[0], cells];
  }));
  for (const [key, { text, claim }] of Object.entries({ ...COPY, ...LOOKUP })) {
    assert.doesNotMatch(text, /\d/, `${key}: a digit`);
    for (const id of claim === null ? [] : [claim].flat()) {
      assert.ok(rows.has(id), `${key}: ${id} has no row`);
      assert.match(rows.get(id)[4], /^\d{4}-\d{2}-\d{2}$/, `${key}: ${id} checked`);
    }
  }
});

test('no "penalty" anywhere in TEAM\'s copy or on its pages\' own content', () => {
  for (const [key, { text }] of Object.entries({ ...COPY, ...LOOKUP })) assert.doesNotMatch(text, /penalt/i, key);
  assert.doesNotMatch(words(main(program)), /penalt/i);
  assert.doesNotMatch(words(main(methods)), /penalt/i);
});

// Every dollar figure says it is in standardized dollars: each block that shows one (a figure, the ledger, Part 4's table
// of every price, a paragraph or list item) says "standardized" in the same block.
test('standardized dollars are stated beside every dollar figure', () => {
  let rest = main(program);
  const blocks = [];
  // The calculator: each column is one block (its result box, figure and ledger each say it; its table's and "What
  // would it take?"'s amounts sit under them), and the three places say it themselves.
  const left = rest.slice(rest.indexOf('<div class="tc-left">'), rest.indexOf('<div class="tc-right">'));
  const right = rest.slice(rest.indexOf('<div class="tc-right">'), rest.indexOf('<script type="application/json" id="tc-data">'));
  for (const [what, re] of [['the result box', /<div class="tc-out">[\s\S]*?<\/div>\n<\/div>/], ['the payoff', /<figure class="tc-fig">[\s\S]*?<\/figure>/], ['the ledger', /<ol class="tc-lines"[\s\S]*?<p class="tc-foot">[^<]*<\/p>/]]) {
    assert.match(words((re.exec(left + right) ?? [''])[0]), /[Ss]tandardized dollars/, what);
  }
  blocks.push(left, right);
  rest = rest.replace(left, '').replace(right, '');
  for (const re of [/<figure\b[\s\S]*?<\/figure>/g, /<section class="tm-ledger"[\s\S]*?<\/section>/g, /<details class="tm-all"[\s\S]*?<\/details>/g]) {
    rest = rest.replace(re, (m) => {
      blocks.push(m);
      return '';
    });
  }
  for (const m of rest.matchAll(/<(p|li|td|dd)\b[\s\S]*?<\/\1>/g)) blocks.push(m[0]);
  const withDollars = blocks.filter((b) => /\$\s?\d/.test(words(b)));
  assert.ok(withDollars.length >= 2, `${withDollars.length} blocks with a dollar figure`);
  for (const b of withDollars) assert.match(words(b), /[Ss]tandardized/, words(b).slice(0, 80));
});

test('the counts come from the emitted file: the record card\'s four fields, the map\'s key and the CJR-X line', () => {
  const who = part('who');
  const n = (x) => x.toLocaleString('en-US');
  // The card's fields, label to value, exactly.
  const card = /<div class="form tm-card">[\s\S]*?<\/div>\n<section/.exec(who)[0];
  const fields = Object.fromEntries([...card.matchAll(/<p class="field__label"><span class="field__no">\d<\/span>([^<]+)<\/p>\s*<p class="field__value[^"]*">([^<]+)<\/p>/g)].map((m) => [words(m[1]), m[2]]));
  assert.deepEqual(fields, {
    'On CMS\u2019s list': n(team.counts.listed),
    'Mandatory areas': n(team.counts.selectedAreas),
    'Kinds of surgery': n(CATEGORIES.length),
    'Track 3 limit': `±${TRACKS[3].gain * 100}%`,
  });
  assert.equal(team.counts.listed, team.participants.length + team.a4.teamMissing.length);
  const counts = mapCounts(team, master);
  assert.equal(counts.listed, team.counts.listed);
  assert.equal(counts.other, team.otherIpps.length);
  assert.equal(counts.in + counts.ended + counts.missing, team.counts.listed);
  // The table counts every hospital the master places in a state, the map's unplaced ones (Puerto Rico's) included.
  assert.equal(counts.byState.reduce((k, r) => k + r.in, 0), counts.in);
  assert.equal(counts.byState.reduce((k, r) => k + r.other, 0), counts.other);
  const key = words(/<ul class="tm-key"[\s\S]*?<\/ul>/.exec(who)[0]);
  assert.equal(key, `In TEAM (${n(counts.in)}) Other inpatient-system hospitals, not in TEAM (${n(counts.other)})`);
  const cjrx = words(/<p class="tm-next">[\s\S]*?<\/p>/.exec(program)[0]);
  assert.match(cjrx, new RegExp(`CMS\u2019s list names ${n(team.counts.cjrxListed)}\\.`), 'the CJR-X list\'s size');
});

test('the worked example: every ledger line is the engine\'s, from the example\'s constants', () => {
  const r = reconcile({ cats: [{ key: 'ALL', target: EXAMPLE.target, spend: EXAMPLE.spend, lowVolume: false }], cqs: EXAMPLE.cqs, track: EXAMPLE.track });
  const ledger = words(/<section class="tm-ledger"[\s\S]*?<\/section>/.exec(program)[0]);
  assert.match(ledger, /\$10\.0M/);
  assert.match(ledger, /\$9\.5M/);
  assert.match(ledger, /\+\$500K/);
  assert.match(ledger, /−\$30K/);
  assert.match(ledger, /±\$2\.0M/);
  assert.match(ledger, /\+\$470K/);
  assert.equal(r.result, 470000);
  assert.match(ledger, /A worked example with round numbers, not a hospital/);
});

test('Part 2 qualifies Track 2 for Medicare-dependent hospitals, and says Track 3 is the default from the second year', () => {
  const text = words(part('change'));
  assert.match(text, /Medicare-dependent hospitals while that program hasn\u2019t expired when selections are due/);
  assert.match(text, /±20% · default from Jan 1, 2027/);
  assert.match(words(part('who')), /either way; the default track from Jan 1, 2027/);
});

test('the patient note cites the notice rule and says it comes before the patient goes home after surgery', () => {
  const note = /<aside class="tm-patient"[\s\S]*?<\/aside>/.exec(program)[0];
  assert.match(words(note), /Before you go home after your surgery, the hospital must give you a written notice that explains TEAM/);
  assert.match(words(note), /512\.582\(b\)\(1\)/);
});

test('the Methods page: one h1, Methods current, noindex, canonical', () => {
  assert.equal(methods.match(/<h1[ >]/g).length, 1);
  assert.ok(methods.includes('<meta name="robots" content="noindex">'));
  assert.ok(headerOf(methods).includes('data-nav="methods" aria-current="true"'));
  assert.ok(methods.includes(`<link rel="canonical" href="${SITE.origin}${METHODS_PATH}">`));
});

// Every TEAM sentence as the pages render it (the copy filled with its numbers, words and parts) has no word twice in a
// row ("about about half"): the program page's text and its attributes a reader hears, and Methods'.
export const repeatedWords = (text) => [...text.matchAll(/\b([A-Za-z]+)\s+\1\b/gi)].map((m) => m[0]);
test('no word repeats back to back anywhere in the rendered TEAM copy', () => {
  assert.deepEqual(repeatedWords('about about half, and And so; that that'), ['about about', 'and And', 'that that']);
  for (const [name, page] of [['program', program], ['methods', methods]]) {
    assert.deepEqual(repeatedWords(readerWords(main(page)).replace(/\s+/g, ' ')), [], name);
  }
  // The calculator's "why?" and Methods' #band say "about half" once.
  assert.ok(words(program).includes("In this site\u2019s count from CMS\u2019s CJR reconciliation file, about half of hospitals"), 'the why');
  assert.ok(words(methods).includes('In those years, about half of hospitals ended a year within 5% of their target.'), 'Methods #band');
});
