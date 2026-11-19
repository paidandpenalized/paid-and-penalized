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
import { headerOf, testAssets, withTemp } from '../../../pipeline/test/helpers.js';
import { reconcile } from '../../../engine/js/team/reconcile.js';
import { CATEGORIES } from '../../../engine/js/team/params.js';
import { SITE, programById } from '../../../web/site.js';
import { CLAIM_PREFIX, EXAMPLE, SECTIONS, TRACKS } from '../web/constants.js';
import { COPY } from '../web/copy.js';
import { COPY as LOOKUP } from '../web/lookup-copy.js';
import { loadAtlas, loadMaster, loadSources, loadTeam } from '../web/data.js';
import { TEAM, generateTeam } from '../web/generate.js';
import { METHODS_PATH, PROGRAM_PATH } from '../web/links.js';
import { programPage } from '../web/pages/program.js';
import { methodsPage } from '../web/pages/methods.js';
import { mapCounts } from '../web/program/who.js';

const team = loadTeam();
const master = loadMaster();
const atlas = loadAtlas();
const assets = testAssets();
const program = programPage({ team, master, atlas, robots: 'noindex', assets });
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

test('the manifest: id, the kit\'s styles then the site\'s own, no script of its own yet', () => {
  assert.equal(TEAM.id, 'team');
  assert.deepEqual(TEAM.styles, [...KIT_STYLES, 'sites/team/web/styles.css']);
  assert.deepEqual(TEAM.entries, {});
});

test('the site is registered unreleased: a live program, noindex and out of the sitemap even in production', () =>
  withTemp('pp-team-', async (dir) => {
    assert.equal(SITE.sites.team.released, false);
    assert.equal(SITE.sites.team.path, PROGRAM_PATH);
    assert.equal(programById('team').stage, 'live');
    const ctx = createContext({ outDir: dir, env: 'production', assets });
    const result = generateTeam(ctx, { team, master, atlas, log: () => {} });
    assert.equal(ctx.pages, 2);
    assert.deepEqual([...ctx.indexable], [], 'nothing in the sitemap');
    for (const path of [PROGRAM_PATH, METHODS_PATH]) {
      assert.ok(readFileSync(join(dir, path, 'index.html'), 'utf8').includes('<meta name="robots" content="noindex">'), path);
    }
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

// The family's layout: each Part's words beside its figure. Part 4's figure is drawn by a later task (its slot is
// there, empty); Part 5's is the calculator.
test('Parts 1, 2, 3, 6 and 7 each set a figure beside their words', () => {
  for (const id of ['who', 'change', 'money', 'do', 'find']) {
    const p = part(id);
    assert.match(p, /<div class="tm-part__text[^"]*">/, `${id}: words`);
    const fig = /<div class="tm-part__fig[^"]*">([\s\S]*)/.exec(p);
    assert.ok(fig, `${id}: a figure column`);
    assert.match(fig[1], /<figure\b|<table\b/, `${id}: a figure or table in it`);
  }
  assert.match(part('bar'), /<div class="tm-part__fig" data-slot="bar"><\/div>/);
  assert.match(part('yours'), /<section id="calc" class="tm-calc">/);
  // The figures shorter than their words (the map, the clock) stay beside them on a wide screen: sticky in a figure
  // column that runs the Part's height (styles.css, from 62em only).
  for (const id of ['who', 'do']) assert.match(part(id), /<div class="tm-part__fig"><div class="tm-sticky">/, `${id}: sticky`);
  const css = readFileSync(REPO_ROOT + 'sites/team/web/styles.css', 'utf8');
  const wide = css.slice(css.indexOf('@media (min-width: 62em) {'), css.indexOf('\n}\n', css.indexOf('@media (min-width: 62em) {')));
  assert.match(wide, /\.tm-part__fig \{ align-self: stretch; \}/);
  assert.match(wide, /\.tm-sticky \{ position: sticky;/);
  assert.doesNotMatch(css.replace(wide, ''), /position: sticky/, 'sticky only from 62em');
  // The hero's button goes to the calculator.
  assert.match(part('who'), /<a class="tm-go" href="#calc">/);
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

// Every dollar figure says it is in standardized dollars: each block that shows one (a figure, the ledger, a
// paragraph or list item) says "standardized" in the same block.
test('standardized dollars are stated beside every dollar figure', () => {
  let rest = main(program);
  const blocks = [];
  for (const re of [/<figure\b[\s\S]*?<\/figure>/g, /<section class="tm-ledger"[\s\S]*?<\/section>/g]) {
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
