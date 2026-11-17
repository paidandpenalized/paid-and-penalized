// The work-requirement site's skeleton: its data loader, its manifest and generator (two pages, unreleased), the
// program page's head and five anchored steps under the section menu (step 1's body: finding.test.js; step 2's:
// how.test.js), and the Methods
// page's shell.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { builtOn } from '../../../engine/js/dates.js';
import { REPO_ROOT, medicaidPath, newestYear, readJson } from '../../../pipeline/files.js';
import { KIT_STYLES } from '../../../pipeline/site/assets.js';
import { createContext } from '../../../pipeline/site/context.js';
import { headerOf, testAssets, withTemp } from '../../../pipeline/test/helpers.js';
import { textOf } from '../../../pipeline/site/html.js';
import { programDek } from '../../../web/programs.js';
import { escapeHtml } from '../../../web/render/html.js';
import { SITE } from '../../../web/site.js';
import { SECTIONS } from '../web/constants.js';
import { cmsDate, isCms, loadMedicaid, loadSourceGroups, newestCmsDate } from '../web/data.js';
import { WR, generateWr } from '../web/generate.js';
import { METHODS_PATH, PROGRAM_PATH } from '../web/links.js';
import { methodsPage } from '../web/pages/methods.js';
import { programPage } from '../web/pages/program.js';

const file = readJson(REPO_ROOT + medicaidPath(newestYear('data/emitted/medicaid')));
const data = loadMedicaid();
const assets = testAssets();
const words = (html) => textOf(html).replace(/\s+/g, ' ').trim();
const program = programPage({ data, robots: 'noindex', assets });
const methods = methodsPage({ data, robots: 'noindex', assets, sources: loadSourceGroups(data) });

test('loadMedicaid: the newest emitted file, its hospitals by CCN, and its states, national and group roll-ups as written', () => {
  assert.equal(data.meta.fy, file.fy);
  assert.equal(data.meta.builtAt, file.built_at);
  assert.equal(data.hospitals.size, file.hospitals.length);
  const ccn = file.columns.indexOf('ccn');
  for (const row of file.hospitals.slice(0, 50)) assert.deepEqual(data.hospitals.get(row[ccn]), row);
  assert.deepEqual(data.columns, file.columns);
  assert.deepEqual(data.states, file.states);
  assert.deepEqual(data.national, file.national);
  assert.deepEqual(data.groups, file.groups);
  // The scenarios' order: low, middle, high, each carrying more lost revenue than the last.
  assert.ok(data.national.low.lost < data.national.middle.lost && data.national.middle.lost < data.national.high.lost);
});

// Every chart on the site says whose money its numbers are: "all-payer" or "Medicare" in its caption (the takeaway, tag,
// note and source; the chart and its table aside). "Medicare cost report" names the source, not the payer, so it is
// taken out first.
test('every figure caption on both pages says "all-payer" or "Medicare", beyond "Medicare cost report"', () => {
  for (const [name, markup] of [['program', String(program)], ['methods', String(methods)]]) {
    const figures = markup.match(/<figure\b[\s\S]*?<\/figure>/g) ?? [];
    assert.ok(figures.length >= (name === 'program' ? 5 : 1), `${name}: figures found`);
    for (const f of figures) {
      const cap = words(f.replace(/<svg\b[\s\S]*?<\/svg>/g, '').replace(/<table\b[\s\S]*?<\/table>/g, '')).replace(/Medicare cost reports?/g, '');
      assert.match(cap, /all-payer|Medicare/, `${name}: ${cap.slice(0, 60)}`);
    }
  }
});

test('the manifest: id, the page script and the kit\'s styles then the site\'s own', () => {
  assert.equal(WR.id, 'work-requirement');
  assert.deepEqual(WR.entries, { 'wr-page': 'sites/work-requirement/client/page.js' });
  assert.deepEqual(WR.styles, [...KIT_STYLES, 'sites/work-requirement/web/styles.css']);
});

test('the generator writes the program page and Methods, noindex while the site is unreleased (even in production), and returns the newest date CMS gives an input and the day the numbers changed', () =>
  withTemp('pp-wr-', async (dir) => {
    assert.equal(SITE.sites['work-requirement'].released, false);
    const ctx = createContext({ outDir: dir, env: 'production', assets: testAssets() });
    const result = generateWr(ctx, { data, log: () => {} });
    assert.equal(ctx.pages, 2);
    assert.deepEqual(ctx.indexable, [], 'no page indexable: none in the sitemap');
    for (const path of [PROGRAM_PATH, METHODS_PATH]) {
      const text = readFileSync(join(dir, path, 'index.html'), 'utf8');
      assert.ok(text.includes('<meta name="robots" content="noindex">'), path);
    }
    assert.deepEqual(result, { updated: { cmsReleased: data.meta.cmsReleased, changed: builtOn(file.built_at) } });
  }));

test('the program page: its title and dek, the Work requirement tab current, the section menu (five steps, then Methods)', () => {
  assert.equal(program.match(/<h1[ >]/g).length, 1, 'one h1');
  assert.ok(words(/<h1[\s\S]*?<\/h1>/.exec(program)[0]) === 'The Medicaid work requirement, hospital by hospital');
  assert.ok(program.includes(`<title>The Medicaid work requirement, hospital by hospital · ${escapeHtml(SITE.name)}</title>`));
  assert.ok(words(program).includes(programDek('work-requirement')), 'the family\'s dek for the scenario');
  const header = headerOf(program);
  assert.ok(header.includes('<a class="tab" href="/work-requirement/" aria-current="page"><span>Work requirement</span> <span class="tab__ab">Medicaid</span></a>'));
  const menu = [...header.matchAll(/<a href="([^"]+)" data-nav="([^"]+)"[^>]*><span class="nav__num">(\d)<\/span>([^<]+)<\/a>/g)].map((m) => [m[1], m[2], m[3], m[4]]);
  assert.deepEqual(menu.map(([href, id]) => [href, id]), [
    ['/work-requirement/#finding', 'finding'], ['/work-requirement/#how', 'how'], ['/work-requirement/#states', 'states'],
    ['/work-requirement/#hospital', 'hospital'], ['/work-requirement/#both', 'both'], ['/work-requirement/methods/', 'methods'],
  ]);
  assert.deepEqual(menu.map(([, , n]) => n), ['1', '2', '3', '4', '5', '6']);
  assert.doesNotMatch(header, /aria-current="true"/, 'no section current on the program page');
  assert.deepEqual(SECTIONS, ['finding', 'how', 'states', 'hospital', 'both']);
});

test('the program page: each of the five steps is an anchored section with its heading, none of them empty', () => {
  for (const id of SECTIONS) {
    const section = new RegExp(`<section class="step[^"]*" id="${id}" aria-labelledby="${id}-h">[\\s\\S]*?<h2[^>]* id="${id}-h">([^<]+)<`).exec(program);
    assert.ok(section, id);
    assert.ok(section[1].length > 0, `${id}: a heading`);
  }
  assert.doesNotMatch(program, /<section class="step" id="[a-z]+" aria-labelledby="[a-z]+-h">\s*<h2 id="[a-z]+-h">[^<]+<\/h2>\s*<\/section>/);
  for (const [n, id] of SECTIONS.entries()) assert.ok(new RegExp(`id="${id}"[\\s\\S]*?id="figure-${n + 1}"`).test(program), `${id}: its figure`);
  // The steps in order.
  const at = SECTIONS.map((id) => program.indexOf(`id="${id}"`));
  assert.deepEqual([...at].sort((a, b) => a - b), at);
  // No byline in the page's body (the family footer keeps its own).
  const main = /<main[\s\S]*?<\/main>/.exec(program)[0];
  assert.doesNotMatch(main, /Built by|Dalton/);
});

test('the Methods page: its heading under the section menu with Methods current, noindex', () => {
  assert.equal(methods.match(/<h1[ >]/g).length, 1, 'one h1');
  assert.ok(words(/<h1[\s\S]*?<\/h1>/.exec(methods)[0]).length > 0);
  assert.ok(methods.includes('<meta name="robots" content="noindex">'));
  const header = headerOf(methods);
  assert.ok(header.includes('<a href="/work-requirement/methods/" data-nav="methods" aria-current="true">'));
  assert.ok(header.includes('aria-current="page"><span>Work requirement</span>'));
  assert.ok(methods.includes(`<link rel="canonical" href="${SITE.origin}${METHODS_PATH}">`));
});

test('every page links the shared stylesheet, then the site\'s own', () => {
  for (const text of [program, methods]) assert.ok(text.includes(`<link rel="stylesheet" href="${assets.sheets['work-requirement']}">`));
});

// /corrections/ lists one date of CMS's per site. The scenario is built from many files, so it gives the newest date CMS
// put on any of them: a CMS-served input's release or modified date, else the Last-Modified of the CMS file it was cut
// from; never the day this site downloaded it.
test('the corrections date: the newest date CMS gives any of the scenario file\'s CMS inputs, by a stated rule', () => {
  const manifest = new Map(readJson(REPO_ROOT + 'data/pinned/manifest.json').map((e) => [e.id, e]));
  const entries = file.sources.map((id) => manifest.get(id));
  const dated = entries.filter((e) => isCms(e) && cmsDate(e));
  assert.ok(dated.length >= 5, `${dated.length} dated CMS inputs`);
  assert.equal(data.meta.cmsReleased, dated.map(cmsDate).sort().at(-1));
  assert.ok(dated.every((e) => cmsDate(e) <= data.meta.cmsReleased));
  // It is CMS's date, not a download date: some input was downloaded after it.
  assert.ok(entries.some((e) => e.retrieved > data.meta.cmsReleased));
  // The rule on its own: the order of the dates, the hosts, and no date from a download day or another publisher.
  const cms = 'https://data.cms.gov/x.csv';
  assert.equal(cmsDate({ pdcReleased: '2026-08-13', pdcModified: '2026-01-26' }), '2026-08-13');
  assert.equal(cmsDate({ pdcModified: '2026-01-26', datasetModified: '2026-02-17' }), '2026-01-26');
  assert.equal(cmsDate({ datasetModified: '2026-02-17', derivedFrom: { lastModified: '2026-10-05' } }), '2026-02-17');
  assert.equal(cmsDate({ derivedFrom: { lastModified: '2026-10-05' }, retrieved: '2026-11-04' }), '2026-10-05');
  assert.equal(cmsDate({ retrieved: '2026-11-04' }), null);
  assert.ok(isCms({ downloadUrl: 'https://download.medicaid.gov/data/x.csv' }));
  assert.ok(isCms({ derivedFrom: { downloadUrl: 'https://downloads.cms.gov/FILES/x.zip' } }));
  assert.ok(isCms({ memberOf: { downloadUrl: cms } }));
  assert.ok(!isCms({ downloadUrl: 'https://www.rwjf.org/x' }));
  assert.ok(!isCms({ downloadUrl: 'https://notcms.gov.example.com/x' }));
  assert.equal(newestCmsDate([{ downloadUrl: cms, pdcReleased: '2026-08-13' }, { downloadUrl: 'https://www.rwjf.org/x', pdcReleased: '2026-12-01' }, { downloadUrl: cms, retrieved: '2026-12-02' }]), '2026-08-13');
  assert.throws(() => newestCmsDate([{ downloadUrl: cms, retrieved: '2026-11-04' }]), RangeError);
});

// One scenario tag to a block: each figure's caption carries the figure's one tag (not its source line, nor its drawing);
// the state card, the step-5 dollars box and each worksheet carry one each (how.test.js holds the worksheets).
test('one scenario tag to a block: every figure\'s in its caption, none in its source or drawing; one in the state card', () => {
  const tag = /class="scen-tag"/g;
  const figures = [...program.matchAll(/<figure class="fig" id="figure-(\d)"[\s\S]*?<\/figure>/g)];
  assert.equal(figures.length, 5);
  for (const [fig, n] of figures) {
    const cap = /<figcaption[\s\S]*?<\/figcaption>/.exec(fig)[0];
    assert.equal((cap.match(tag) ?? []).length, 1, `Figure ${n}: its caption carries the tag`);
    assert.equal((fig.match(tag) ?? []).length, 1, `Figure ${n}: and nothing else in it does`);
    for (const svg of fig.match(/<svg[\s\S]*?<\/svg>/g) ?? []) assert.doesNotMatch(svg, /SCENARIO/, `Figure ${n}: no tag in a drawing`);
  }
  const card = /<div class="wr-stcard__body" data-st-card>[\s\S]*?<!-- \/wr-stcard__body -->/.exec(program)[0];
  assert.equal(card.match(tag).length, 1, 'the state card');
  const read = /<div class="wr-both__read" data-b-read>[\s\S]*?<\/div>/.exec(program)[0];
  assert.equal(read.match(tag).length, 1, 'the step-5 dollars box');
});

// R29: the program page's followed-hospital chip names the hospital only (no Medicare net beside the Medicaid scenario);
// the Methods page's, like every other page's, is the family's.
test('the program page\'s chip is marked plain; the Methods page\'s is not', () => {
  assert.match(program, /<p class="chip" data-chip data-chip-plain hidden><\/p>/);
  assert.match(methods, /<p class="chip" data-chip hidden><\/p>/);
});

// The measured tag keeps to one line on a phone: its shorter words there (the same facts), the full words from 480px.
// One exception (R34): in step 3's state card the label column is narrower than the tag's words at 320px, so there the
// tag may take two lines, breaking only at the " · " between its halves, each half kept whole; nowhere else.
test('the cost reports\' measured tag carries its phone words, shows one at a time, and wraps only in the state card, at its separator', () => {
  const plain = /<span class="wr-tag"><span class="wr-tag__long">[^<]*<\/span><span class="wr-tag__short">[^<]*<\/span><\/span>/g;
  const part = '<span class="wr-tag__part">[^<]+ ·</span> <span class="wr-tag__part">[^<]+</span>';
  const wrapping = new RegExp(`<span class="wr-tag wr-tag--wrap"><span class="wr-tag__long">${part}</span><span class="wr-tag__short">${part}</span></span>`, 'g');
  const card = /<table class="wr-ws__lines wr-stcard__lines">[\s\S]*?<\/table>/.exec(program)[0];
  const outside = program.replace(card, '');
  assert.ok((outside.match(plain) ?? []).length >= 1, 'the worksheet\'s line 1: the one-line tag');
  assert.doesNotMatch(outside, /wr-tag--wrap|wr-tag__part/, 'no tag outside the state card may wrap');
  const inCard = card.match(/class="wr-tag[ "]/g) ?? [];
  assert.ok(inCard.length >= 2, 'the state card\'s lines 1 and 6 carry the tag');
  assert.equal((card.match(wrapping) ?? []).length, inCard.length, 'each of the card\'s tags is the one that breaks at its separator only');
  const css = readFileSync(join(REPO_ROOT, 'sites/work-requirement/web/styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(css, /^\.wr-tag \{[^}]*white-space: nowrap;/m);
  assert.match(css, /^\.wr-tag__short \{ display: none; \}/m);
  assert.match(css, /@media \(max-width: 479px\) \{\s*\.wr-tag__long \{ display: none; \}\s*\.wr-tag__short \{ display: inline; \}/);
  // The halves never break inside; the only tag rule that lets a tag wrap is the card's.
  assert.match(css, /^\.wr-tag__part \{ white-space: nowrap; \}/m);
  const wraps = [...css.matchAll(/([^{}]*wr-tag[^{}]*)\{([^}]*)\}/g)].filter(([, , body]) => /white-space:\s*normal/.test(body)).map(([, sel]) => sel.trim());
  assert.deepEqual(wraps, ['.wr-stcard__lines .wr-tag--wrap']);
});

// The 11-10 build report's launch fix-up: "Table A.2" never breaks between its words, in the as-of block or Methods.
test('"Table A.2" is joined by a no-break space on both pages', () => {
  const at = program.indexOf('Enrollment declines');
  assert.ok(at >= 0, 'the as-of block has its declines cell');
  const cell = program.slice(at, program.indexOf('</dd>', at));
  // Methods' cases paragraph (its source list also names the table, in the pin's own title, which is data).
  const cases = methods.slice(methods.indexOf('state by state ('), methods.indexOf('Nationally that is'));
  for (const [page, text] of [['the as-of cell', cell], ['Methods\' cases', cases]]) {
    assert.match(text, /Table\u00a0A\.2/, page);
    assert.doesNotMatch(text, /Table A\.2/, page);
  }
});
