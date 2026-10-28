// The coming-soon pages (hub/coming.js): one at the folder of each program still to come, from the registry. Built from the
// real dollar file for HVBP's figure; no hospital is named here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createContext } from '../../pipeline/site/context.js';
import { ASSETS, headerOf, footerOf, withTemp } from '../../pipeline/test/helpers.js';
import { textOf } from '../../pipeline/site/html.js';
import { programDek } from '../../web/programs.js';
import { money } from '../../web/render/format.js';
import { escapeHtml } from '../../web/render/html.js';
import { feedbackFor } from '../../web/render/layout.js';
import { PLACEHOLDER_PROGRAMS } from '../../web/site.js';
import { COPY } from '../coming-copy.js';
import { comingPage } from '../coming.js';
import { COPY as HOME } from '../home/copy.js';
import { loadHub } from '../data.js';
import { hubHospitals, storyFacts } from '../model.js';
import { generateHub } from '../pages.js';

const HUB = loadHub();
const FACTS = storyFacts(hubHospitals(HUB));
const FY = String(ASSETS.shell.fy);
const NOINDEX = '<meta name="robots" content="noindex">';
const esc = (text) => escapeHtml(text);
const mainOf = (page) => page.slice(page.indexOf('<main'), page.indexOf('</main>'));
// The markup of the first element that opens with `open`, to its matching close.
function element(html, open, name) {
  const start = html.indexOf(open);
  assert.ok(start >= 0, `no element ${open}`);
  const re = new RegExp(`<(/?)${name}[\\s>]`, 'g');
  re.lastIndex = start;
  let depth = 0;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    depth += m[1] ? -1 : 1;
    if (!depth) return html.slice(start, html.indexOf('>', m.index) + 1);
  }
  assert.fail(`element ${open} is not closed`);
}
const cardOf = (page) => element(mainOf(page), '<div class="form rd__sum cm__card">', 'div');
const render = (program, facts = FACTS) => comingPage({ program, facts, assets: ASSETS, robots: 'noindex' });
const GROUP_NAMES = { quality: 'Quality programs', price: HOME.soonPrice, reporting: HOME.soonReporting, episode: HOME.soonEpisode };
const HVBP = PLACEHOLDER_PROGRAMS.find((p) => p.id === 'hvbp');
const OTHERS = PLACEHOLDER_PROGRAMS.filter((p) => !p.inData);

test('the registry holds HVBP, in the data, and six programs that are not; each has a coming page', () => {
  assert.deepEqual(PLACEHOLDER_PROGRAMS.map((p) => p.id), ['hvbp', 'wage-index', 'dsh', 'ime', 'iqr', 'pi', 'team']);
  assert.deepEqual(PLACEHOLDER_PROGRAMS.filter((p) => p.inData).map((p) => p.id), ['hvbp']);
});

test('the build writes a coming page at each program\'s folder: noindex, one h1, the program\'s tab current', () =>
  withTemp('pp-coming-', async (dir) => {
    const ctx = createContext({ outDir: dir, env: 'production', assets: ASSETS });
    await generateHub(ctx, { hospitals: [] });
    for (const p of PLACEHOLDER_PROGRAMS) {
      const text = readFileSync(join(dir, p.path, 'index.html'), 'utf8');
      assert.equal(text.match(/<h1[\s>]/g)?.length, 1, `${p.id}: one h1`);
      assert.ok(text.includes(NOINDEX), `${p.id}: never indexed`);
      assert.ok(!ctx.indexable.includes(p.path), `${p.id}: not in the sitemap's list`);
      assert.ok(text.includes(`<title>${esc(p.name)} · Paid &amp; Penalized</title>`), `${p.id}: title`);
      assert.match(headerOf(text), new RegExp(`<a class="tab[^"]*" href="${p.path}"[^>]* aria-current="page">`), `${p.id}: its tab is current`);
      assert.equal(headerOf(text).match(/aria-current="page"/g)?.length, 1, `${p.id}: the only current tab`);
      assert.ok(text.includes(`href="${esc(feedbackFor({ path: p.path }))}"`), `${p.id}: the prefilled feedback link`);
      assert.doesNotMatch(text, /NaN|undefined|Infinity|\[object/, `${p.id}: no stray value`);
    }
  }));

test('the page: kicker with the abbreviation, the group and "Coming"; the name as the display-face h1; the dek', () => {
  for (const p of PLACEHOLDER_PROGRAMS) {
    const main = mainOf(render(p));
    assert.ok(main.includes(`<p class="cap kicker rd__kicker">${esc(p.ab)} · ${esc(GROUP_NAMES[p.group])} · Coming</p>`), `${p.id}: kicker`);
    assert.ok(main.includes(`<h1 class="rd__title">${esc(p.name)}</h1>`), `${p.id}: h1`);
    assert.ok(main.includes(`<p class="dek">${esc(programDek(p.id))}</p>`), `${p.id}: dek`);
    assert.ok(main.indexOf('class="cap kicker"') < main.indexOf('<h1'), `${p.id}: the kicker over the h1`);
  }
});

test('two buttons: back to all programs, and to the live programs on the front page', () => {
  for (const p of PLACEHOLDER_PROGRAMS) {
    const main = mainOf(render(p));
    assert.ok(main.includes('<p class="rd__go cm__acts"><a href="/"><span class="ico ico--arrow cm__back" aria-hidden="true"></span> All programs</a><a href="/#programs">The live programs</a></p>'), `${p.id}: the buttons`);
  }
});

test('the status card: a hatched band, the CMS name, the figures, the stamp', () => {
  for (const p of PLACEHOLDER_PROGRAMS) {
    const main = mainOf(render(p));
    assert.ok(main.includes(`<p class="form__title"><span>${esc(p.ab)} · Page status</span><span>FY${FY}</span></p>`), `${p.id}: title bar`);
    assert.ok(main.includes('<div class="cm__wait"><p>This program’s page is coming.</p></div>'), `${p.id}: the hatched band`);
    assert.ok(main.includes(`<p class="field__label"><span class="field__no">1</span>Program</p>`), `${p.id}: field 1`);
    assert.ok(main.includes(`<p class="field__value field__value--text">${esc(p.long)}</p>`), `${p.id}: CMS's name`);
    assert.ok(main.includes(`<p class="field__label"><span class="field__no">2</span>Figures</p>`), `${p.id}: field 2`);
    // The stamp is decoration (the band and the kicker say it), so a screen reader skips it.
    assert.ok(main.includes('<div class="cm__stamp" aria-hidden="true"><p class="stamp stamp--ink">Coming</p></div>'), `${p.id}: the stamp`);
  }
});

test('HVBP\'s figure is what the data moves between hospitals, estimated, with the estimate tag; the others have none', () => {
  assert.ok(FACTS.vbpBonus > 0, 'the data moves some money');
  const card = cardOf(render(HVBP));
  assert.ok(textOf(card).includes(`${money(FACTS.vbpBonus)} moved between hospitals, estimated FY${FY}`), 'the figure, in words');
  assert.ok(card.includes(`<b>${esc(money(FACTS.vbpBonus))}</b>`), 'the amount stands out');
  assert.ok(card.includes('<a class="est-tag" href="/methods/#estimate"'), 'carries the estimate tag, linked to how it is estimated');
  assert.ok(!textOf(card).includes('None until computed from CMS files'), 'HVBP has a figure');
  // The figure follows the data it is given.
  assert.ok(textOf(cardOf(render(HVBP, { ...FACTS, vbpBonus: 5e6 }))).includes(`${money(5e6)} moved between hospitals, estimated FY${FY}`));
  for (const p of OTHERS) {
    const card = cardOf(render(p));
    assert.ok(textOf(card).includes('None until computed from CMS files'), `${p.id}: none`);
    assert.ok(!card.includes('est-tag') && !card.includes('moved between hospitals') && !card.includes('$'), `${p.id}: no figure, no tag`);
  }
});

test('"Want this one sooner?" links to the feedback form prefilled with this page: one in the main, one in the footer', () => {
  for (const p of PLACEHOLDER_PROGRAMS) {
    const page = render(p);
    const main = mainOf(page);
    const href = feedbackFor({ path: p.path });
    assert.ok(textOf(main).includes('Want this one sooner? Say so on the feedback form'), `${p.id}: the sentence`);
    assert.equal(main.split(`href="${esc(href)}"`).length - 1, 1, `${p.id}: one feedback link in the main`);
    assert.match(main, new RegExp(`Want this one sooner\\? Say so on the <a href="${esc(href).replace(/[?.]/g, '\\$&')}" target="_blank" rel="noopener">feedback form`), `${p.id}: opens in a new tab`);
    assert.equal(footerOf(page).match(/href="https:\/\/docs\.google\.com\/forms\//g)?.length, 1, `${p.id}: the footer keeps its own single feedback link`);
  }
});

test('a program in the data with no figure to show, or with a group the page has no words for, is an error', () => {
  assert.throws(() => render({ ...OTHERS[0], inData: true }), /no figure/);
  assert.throws(() => render({ ...OTHERS[0], group: 'other' }), /group/);
  assert.throws(() => render(HVBP, { ...FACTS, vbpBonus: Number.NaN }), RangeError);
});

test('the copy holds no digit, and nothing that judges, ranks or promises', () => {
  const source = readFileSync(new URL('../coming-copy.js', import.meta.url), 'utf8');
  assert.ok(!/\d/.test(source.replace(/^\s*\/\/.*$/gm, '')), 'a digit in the copy file (numbers arrive through placeholders)');
  for (const text of Object.values(COPY)) {
    assert.doesNotMatch(text, /\b(caught|cheat(s|ed|ing)?|dodg(e|es|ed|ing)|worst|best|rank(s|ed|ing)?|should|failed|within|promptly|soon as|business days?)\b/i, text);
  }
  // The page promises no date and no turnaround: "sooner" is a request, and the page says nothing of when.
  for (const p of PLACEHOLDER_PROGRAMS) assert.doesNotMatch(textOf(mainOf(render(p))), /\b(will launch|by (next|the end)|in (a|the next) (week|month|few))\b/i, p.id);
});
