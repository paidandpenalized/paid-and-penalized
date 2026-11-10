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
import { cmsDate, isCms, loadMedicaid, newestCmsDate } from '../web/data.js';
import { WR, generateWr } from '../web/generate.js';
import { METHODS_PATH, PROGRAM_PATH } from '../web/links.js';
import { methodsPage } from '../web/pages/methods.js';
import { programPage } from '../web/pages/program.js';

const file = readJson(REPO_ROOT + medicaidPath(newestYear('data/emitted/medicaid')));
const data = loadMedicaid();
const assets = testAssets();
const words = (html) => textOf(html).replace(/\s+/g, ' ').trim();
const program = programPage({ data, robots: 'noindex', assets });
const methods = methodsPage({ data, robots: 'noindex', assets });

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

test('the program page: each of the five steps is an anchored section with its heading; those after the fourth empty until drawn', () => {
  for (const id of SECTIONS) {
    const section = new RegExp(`<section class="step[^"]*" id="${id}" aria-labelledby="${id}-h">[\\s\\S]*?<h2[^>]* id="${id}-h">([^<]+)<`).exec(program);
    assert.ok(section, id);
    assert.ok(section[1].length > 0, `${id}: a heading`);
  }
  for (const id of SECTIONS.slice(4)) assert.match(program, new RegExp(`<section class="step" id="${id}" aria-labelledby="${id}-h">\\s*<h2 id="${id}-h">[^<]+</h2>\\s*</section>`), id);
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
