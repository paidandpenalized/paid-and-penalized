// The page of a hospital outside Medicare's penalty programs (hub/hospital/outside.js, through page.js outsidePage), on
// the pinned data. Rows are picked by property, never by name or CCN; failure messages print no hospital's name, CCN or
// figure.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hospitalScenario } from '../../engine/js/medicaid/hospital.js';
import { ASSETS } from '../../pipeline/test/helpers.js';
import { endedBy } from '../../web/render/closed.js';
import { escapeHtml } from '../../web/render/html.js';
import { SITE, hospitalPathOf } from '../../web/site.js';
import { hubModel } from '../data.js';
import { COPY } from '../hospital/copy.js';
import { fillOutside } from '../hospital/outside-copy.js';
import { outsideDescription } from '../hospital/outside.js';
import { outsidePage } from '../hospital/page.js';
import { LIKE_GROUPS } from '../outside.js';
import { mainOf } from './helpers.js';
import { chipOf, headerOf } from '../../pipeline/test/helpers.js';
import { cmsNamed } from '../../pipeline/master.js';

const { hub: HUB, hospitals: HOSPITALS, facts: FACTS, outside: OUTSIDE } = hubModel();
const FY = String(ASSETS.shell.fy);
const YEARS = { hacrpFy: String(HUB.programYears.hacrp), hrrpFy: String(HUB.programYears.hrrp) };
const esc = (text) => String(escapeHtml(text));

const render = (h, medicaid = HUB.medicaid) => outsidePage({ h, hospitals: HOSPITALS, facts: FACTS, assets: ASSETS, robots: null, master: HUB.master.get(h.ccn), hrrp: HUB.hrrp, medicaid, programYears: HUB.programYears });
const pick = (pred, what) => {
  const h = OUTSIDE.find(pred);
  assert.ok(h, `the data has ${what}`);
  return h;
};
// The page's <main> with its line breaks taken out, as a reader of the words sees it.
const words = (page) => mainOf(page).replace(/<br[^>]*>/g, '');
const occurrences = (text, part) => text.split(part).length - 1;
const STAMP = esc(fillOutside('stamp'));
// A phrase that counts the programs ("three programs", "both of the programs").
const COUNTS_PROGRAMS = /\b(?:two|three|four|both|these three)\s+(?:of\s+(?:the|these)\s+)?(?:penalty\s+)?programs\b/i;
const wrRow = (h) => (HUB.medicaid.hospitals.has(h.ccn) ? hospitalScenario(HUB.medicaid, h.ccn) : null);
const wrHref = (h) => `${SITE.sites['work-requirement'].path}?h=${h.ccn}`;

// The reason lines a hospital's page shows, from its master reason codes, written out again from the rule.
function reasonTexts(h) {
  const { hacrp, hrrp } = h.reasons;
  if (hacrp === 'not_listed' && hrrp === 'not_listed') return h.state === 'PR' ? [fillOutside('notListedHacrp', { hacrpFy: YEARS.hacrpFy }), fillOutside('notInHrrpPuertoRico')] : [fillOutside('notListedBoth', YEARS)];
  if (hacrp === 'not_listed' && hrrp === null) return [fillOutside('notListedHacrp', { hacrpFy: YEARS.hacrpFy })];
  if (hacrp === 'inactive') return [];
  return [`reason.${h.group}`, `reasonInstead.${h.group}`].filter(fillable).map((key) => fillOutside(key));
}
function fillable(key) {
  try {
    fillOutside(key);
    return true;
  } catch {
    return false;
  }
}

test('outside page: one per like group has the stamp, its reason and claim-backed copy', () => {
  for (const group of LIKE_GROUPS) {
    const h = pick((x) => x.group === group && !x.listed, `an unlisted outside hospital in group ${group}`);
    const page = render(h);
    const main = words(page);
    assert.ok(occurrences(main, STAMP) === 1, `${group}: the stamp once`);
    assert.ok(/Not in Medicare’s <br class="hh__br-wide">penalty programs/.test(mainOf(page)), `${group}: the stamp breaks before "penalty" on desktop`);
    const reasons = reasonTexts(h);
    if (group !== 'inactive') assert.ok(reasons.length > 0, `${group}: a reason to show`);
    for (const text of reasons) assert.ok(main.includes(esc(text)), `${group}: its reason line`);
    assert.ok(!COUNTS_PROGRAMS.test(main), `${group}: no count of the programs`);
    assert.ok(main.includes('class="form hh__card"'), `${group}: the record card`);
    assert.ok(main.indexOf('class="form hh__card"') < main.indexOf(STAMP), `${group}: the card, then the stamp`);
    assert.ok(main.includes(esc(COPY['typeKind.' + h.kind] ?? '')) || h.kind === 'acute', `${group}: the Type field names its kind`);
  }
});

test('outside page: the Type field names the kind of a non-acute hospital and not of an acute one', () => {
  for (const kind of ['critical_access', 'psychiatric', 'va']) {
    const h = pick((x) => x.kind === kind, `an outside hospital of kind ${kind}`);
    const type = /<p class="field__label"><span class="field__no">3<\/span>Type<\/p>\s*<p class="field__value[^"]*">([^<]*)<\/p>/.exec(mainOf(render(h)))?.[1];
    assert.ok(type?.startsWith(esc(COPY[`typeKind.${kind}`])), `${kind}: the kind leads the Type field`);
  }
  const acute = pick((x) => x.kind === 'acute', 'an acute outside hospital');
  assert.ok(!Object.keys(COPY).some((k) => k.startsWith('typeKind.') && mainOf(render(acute)).includes(`>${esc(COPY[k])} `)), 'no kind word for an acute hospital');
});

test('outside page: a listed hospital has no stamp, links its Readmissions page and says HACRP\'s file doesn\'t list it', () => {
  const h = pick((x) => x.listed, 'an outside hospital a program file lists');
  assert.ok(h.inHrrp, 'it has a Readmissions page');
  const page = render(h);
  const main = words(page);
  assert.ok(occurrences(main, STAMP) === 0, 'no stamp');
  assert.ok(main.includes(`href="${hospitalPathOf('hrrp', h.ccn, { inHrrp: true })}"`), 'its Readmissions page');
  assert.ok(main.includes(esc(fillOutside('notListedHacrp', { hacrpFy: YEARS.hacrpFy }))), 'HACRP\'s file doesn\'t list it');
  assert.ok(main.includes(`FY${YEARS.hacrpFy}`), 'naming the HACRP file\'s year');
  assert.ok(!main.includes(esc(fillOutside('notListedBoth', YEARS))), 'not the both-files line');
  assert.ok(main.includes(esc(COPY.pagesHeading)), 'under "This hospital\'s program pages"');
});

test('outside page: no outside page links a HACRP hospital page, and only those with a Readmissions page link one', () => {
  for (const h of OUTSIDE) {
    const main = mainOf(render(h));
    assert.ok(!main.includes(`href="${SITE.sites.hacrp.path}hospital/`), 'no HACRP hospital link');
    assert.ok(main.includes(`href="${hospitalPathOf('hrrp', h.ccn, { inHrrp: true })}"`) === h.inHrrp, 'a Readmissions link exactly when it has a page');
    assert.ok(occurrences(words(render(h)), STAMP) === (h.listed ? 0 : 1), 'the stamp exactly when no program lists it');
  }
});

test('outside page: the Medicaid band shows with the outside dek where the scenario file has a row, and not otherwise', () => {
  const drawn = pick((x) => x.group === 'critical_access' && wrRow(x)?.shares, 'a critical access hospital with a loss to draw');
  const page = mainOf(render(drawn));
  assert.ok(page.includes('data-medicaid'), 'the band');
  assert.ok(page.includes(esc(fillOutside('wbNoteOutside'))), 'with the outside dek');
  assert.ok(!page.includes(esc(COPY.wbNoteAlone)), 'not the default dek');
  assert.ok(page.includes(`href="${wrHref(drawn)}"`), 'and the work-requirement link');
  assert.equal(occurrences(page, `href="${wrHref(drawn)}"`), 1, 'the link once, in the band: not again in the program pages');
  const hero = page.indexOf('class="wrap hh__hero"');
  assert.ok(hero < page.indexOf('data-medicaid') && page.indexOf('data-medicaid') < page.indexOf('class="hh__notes"'), 'after the hero, before the notes');

  // A row with no loss to draw keeps the reason's dek: "could" would not hold where the requirement can't reach it.
  const reason = pick((x) => x.group === 'critical_access' && wrRow(x)?.reason, 'a critical access hospital whose row gives a reason');
  const rpage = mainOf(render(reason));
  assert.ok(rpage.includes('data-medicaid') && rpage.includes(esc(COPY.wbNoteReasonAlone)), 'the reason\'s dek');
  assert.ok(!rpage.includes(esc(fillOutside('wbNoteOutside'))), 'not the outside dek');

  const psych = pick((x) => x.group === 'psychiatric' && !wrRow(x), 'a psychiatric hospital with no scenario row');
  const ppage = mainOf(render(psych));
  assert.ok(!ppage.includes('data-medicaid'), 'no band');
  assert.ok(!ppage.includes(`href="${wrHref(psych)}"`), 'no work-requirement link');
  assert.ok(!ppage.includes('class="hh__pages"'), 'no program pages to list');
});

test('outside page: an inactive hospital shows the closed note', () => {
  const inactive = OUTSIDE.filter((h) => h.inactive);
  assert.ok(inactive.some((h) => h.group === 'inactive') && inactive.some((h) => h.group !== 'inactive'), 'the data has inactive hospitals in and out of the inactive group');
  for (const h of inactive) {
    assert.ok(endedBy(h.inactive, Number(FY)), 'its agreement ended by the year\'s end');
    const main = mainOf(render(h));
    assert.ok(main.includes(`<p class="hh__closed">CMS lists this hospital’s Medicare agreement under CCN ${h.ccn} as ended`), `${h.group}: the closed note`);
    assert.ok(!main.includes('keeps it in its totals'), 'not in any total of this site, so the note doesn\'t say it is');
  }
  for (const h of OUTSIDE.filter((x) => !x.inactive).slice(0, 50)) assert.ok(!mainOf(render(h)).includes('hh__closed'), 'no note on an active hospital');
});

test('outside page: not_listed in Puerto Rico gets the Readmissions Puerto Rico clause and the HACRP file line', () => {
  const h = pick((x) => x.state === 'PR' && x.reasons.hacrp === 'not_listed' && x.reasons.hrrp === 'not_listed', 'a Puerto Rico hospital neither file lists');
  const main = words(render(h));
  assert.ok(main.includes(esc(fillOutside('notInHrrpPuertoRico'))), 'the Puerto Rico clause');
  assert.ok(main.includes(esc(fillOutside('notListedHacrp', { hacrpFy: YEARS.hacrpFy }))), 'the HACRP file line');
  assert.ok(!main.includes(esc(fillOutside('notListedBoth', YEARS))), 'not the both-files line');
  const elsewhere = pick((x) => x.state !== 'PR' && x.reasons.hacrp === 'not_listed' && x.reasons.hrrp === 'not_listed', 'a hospital in a state neither file lists');
  const other = words(render(elsewhere));
  assert.ok(other.includes(esc(fillOutside('notListedBoth', YEARS))), 'elsewhere: one line naming both files');
  assert.ok(other.includes(`FY${YEARS.hacrpFy}`) && other.includes(`FY${YEARS.hrrpFy}`), 'and each file\'s year');
});

test('outside page: its title, description, chip and scripts', () => {
  const byGroup = (group) => render(pick((x) => x.group === group && !x.listed && !x.inactive, `an active hospital in group ${group}`));
  const description = (page) => /<meta name="description" content="([^"]*)">/.exec(page)[1];
  assert.ok(/how Medicare pays it instead/.test(description(byGroup('critical_access'))), 'a group Medicare pays another way');
  assert.ok(/don’t adjust its pay\.$/.test(description(byGroup('va'))), 'a federal hospital');
  assert.ok(/penalty program files list it/.test(description(byGroup('not_listed'))), 'a hospital a file doesn\'t list');
  assert.ok(/as ended/.test(description(render(pick((x) => x.group === 'inactive', 'an inactive-group hospital')))), 'a closed hospital');
  const page = byGroup('psychiatric');
  assert.ok(new RegExp(`<title>[^<]*FY${FY}`).test(page), 'the title names the fiscal year');
  assert.ok(!page.includes(`src="${ASSETS.js['hub-hospital']}"`), 'no hospital script yet');
  assert.ok(page.includes('<article class="hh hh--none hh--out"'), 'the outside article');
});

test('outside page: the source line names the hospital list and each program file\'s year, not the dollar model or HVBP', () => {
  const notesOf = (page) => /<div class="hh__notes">[\s\S]*?<\/div><\/div>/.exec(mainOf(page))?.[0] ?? '';
  for (const group of LIKE_GROUPS) {
    const h = pick((x) => x.group === group, `an outside hospital in group ${group}`);
    const notes = notesOf(render(h));
    assert.ok(notes.includes(esc(fillOutside('sourceOutside', YEARS))), `${group}: the outside source line`);
    assert.ok(notes.includes(`FY${YEARS.hacrpFy}`) && notes.includes(`FY${YEARS.hrrpFy}`), `${group}: each file's year`);
    assert.ok(!/dollar model|HVBP|value-based/i.test(notes), `${group}: no dollar model or HVBP`);
  }
  // With the nearest hospitals' figure (near), the dollar model joins it.
  const h = OUTSIDE[0];
  const page = outsidePage({ h, assets: ASSETS, robots: null, master: HUB.master.get(h.ccn), medicaid: HUB.medicaid, programYears: HUB.programYears, near: '<section></section>' });
  assert.ok(notesOf(page).includes(esc(fillOutside('sourceOutsideDollars'))), 'the dollar model beside the nearest hospitals');
});

test('outside page: an inactive-group hospital whose agreement ends after the year would have no explanation, so the build stops', () => {
  const h = pick((x) => x.group === 'inactive', 'an inactive-group hospital');
  const record = HUB.master.get(h.ccn);
  const later = { ...record, inactive: { ...record.inactive, date: `${Number(FY)}-10-01` } };
  let message = null;
  try {
    outsidePage({ h: { ...h, inactive: later.inactive }, assets: ASSETS, robots: null, master: later, medicaid: HUB.medicaid, programYears: HUB.programYears });
  } catch (e) {
    message = e instanceof RangeError ? e.message : null;
  }
  assert.ok(message !== null, 'a RangeError');
  assert.ok(/no closed note/.test(message) && !message.includes(h.name), 'saying why, naming no hospital beyond its CCN');
});

test('outside page: a listed hospital with a Medicaid row keeps the band\'s default dek, which doesn\'t say the programs leave it alone', () => {
  const h = pick((x) => x.listed && wrRow(x), 'an outside hospital a program file lists, with a Medicaid scenario row');
  const main = mainOf(render(h));
  assert.ok(main.includes('data-medicaid'), 'the band');
  assert.ok(!main.includes(esc(fillOutside('wbNoteOutside'))), 'not the outside dek');
  assert.ok(main.includes(esc(wrRow(h).reason ? COPY.wbNoteReasonAlone : COPY.wbNoteAlone)), 'the default dek');
  // Today's listed hospitals' rows give reasons, which keep the reason's dek anyway; the same hospital with a loss to draw,
  // marked listed, shows the guard itself.
  const drawn = pick((x) => !x.listed && wrRow(x)?.shares, 'an unlisted outside hospital with a loss to draw');
  const asListed = mainOf(render({ ...drawn, listed: true }));
  assert.ok(asListed.includes(esc(COPY.wbNoteAlone)) && !asListed.includes(esc(fillOutside('wbNoteOutside'))), 'a listed hospital with a loss to draw: the default dek');
  for (const x of OUTSIDE.filter((y) => wrRow(y))) {
    const shows = mainOf(render(x)).includes(esc(fillOutside('wbNoteOutside')));
    assert.ok(shows === (!x.listed && !wrRow(x).reason), 'the outside dek exactly on an unlisted hospital with a loss to draw');
  }
});

test('outside page: the description says closed exactly when the page shows the closed note', () => {
  for (const h of OUTSIDE) {
    const page = render(h);
    const said = /<meta name="description" content="[^"]*as ended\.">/.test(page);
    assert.ok(said === mainOf(page).includes('<p class="hh__closed">'), 'the description and the note agree');
  }
  // A psychiatric hospital whose agreement ends after the year has no note, so no closed description.
  const h = pick((x) => x.group === 'psychiatric' && !x.inactive, 'an active psychiatric hospital');
  const later = { ...h, inactive: { date: `${Number(FY)}-10-01`, reason: 'merger or closure' } };
  assert.ok(!endedBy(later.inactive, Number(FY)), 'the end falls after the year');
  const place = { name: 'Invented Hospital', place: 'Nowhere, ZZ' };
  assert.ok(outsideDescription(later, place, FY) === fillOutside('descriptionOutside', place), 'its group\'s description');
  assert.ok(outsideDescription({ ...later, inactive: { date: `${Number(FY)}-09-30`, reason: 'merger or closure' } }, place, FY) === fillOutside('descriptionOutsideClosed', place), 'an end within the year: closed');
});

// The band carries the work-requirement link, so the hero's program pages never repeat it: a hospital with a Readmissions
// page lists that alone; one with no other page has no list at all.
test('outside page: the program pages leave the work-requirement link to the band, and a list left empty is dropped', () => {
  const pagesOf = (main) => (main.includes('class="hh__pages"') ? main.slice(main.indexOf('class="hh__pages"'), main.indexOf('</section>', main.indexOf('class="hh__pages"'))) : null);
  const withBand = OUTSIDE.filter((x) => HUB.medicaid.hospitals.has(x.ccn));
  assert.ok(withBand.some((x) => x.inHrrp) && withBand.some((x) => !x.inHrrp), 'the data has banded hospitals with and without a Readmissions page');
  for (const h of withBand) {
    const main = mainOf(render(h));
    assert.ok(main.includes('data-medicaid'), 'the band shows');
    assert.equal(occurrences(main, `href="${wrHref(h)}"`), 1, 'the work-requirement link once');
    const pages = pagesOf(main);
    if (h.inHrrp) assert.ok(pages && !pages.includes(wrHref(h)), 'the list holds the Readmissions page alone');
    else assert.equal(pages, null, 'no list');
  }
});

test('outside page: the header\'s HACRP tab opens the program\'s folder (the HACRP site has no page for the hospital)', () => {
  const h = pick((x) => x.group === 'critical_access', 'a critical access hospital');
  const tab = /<a class="tab"[^>]*href="([^"]*)"[^>]*>(?:<span>)?Hospital-acquired conditions/.exec(headerOf(render(h)));
  assert.ok(tab, 'the HACRP tab');
  assert.equal(tab[1], SITE.sites.hacrp.path, 'its folder');
});

// A hospital no CMS file names: the master keeps its stand-in name; the page shows "Hospital <CCN>" in the h1 (display
// type, no parenthetical), a mono note on the card, the title and the header's chip.
test('outside page: a hospital no CMS file names goes by "Hospital <CCN>", with a note on its card', () => {
  const h = pick((x) => !cmsNamed(x.name, x.ccn), 'an outside hospital no CMS file names');
  const page = render(h);
  const shown = COPY.nameStandIn.replace('{ccn}', h.ccn);
  assert.ok(mainOf(page).includes(`<h1 class="field__value hh__name">${esc(shown)}</h1>`), 'the h1');
  assert.ok(mainOf(page).includes(`<div class="field__note">${esc(COPY.nameNotInCms)}</div>`), 'the card\'s note');
  assert.ok(!page.includes(esc(h.name)), 'the stand-in name nowhere on the page');
  assert.ok(chipOf(page)?.includes(esc(shown)), 'the chip');
  assert.match(page, new RegExp(`<title>${esc(shown)},`), 'the title');
  assert.ok(HUB.master.get(h.ccn).name === h.name, 'the master keeps its stand-in');
  const named = pick((x) => cmsNamed(x.name, x.ccn), 'an outside hospital a CMS file names');
  assert.ok(!mainOf(render(named)).includes(esc(COPY.nameNotInCms)), 'no note where a file names it');
});

test('outside page: one bed reads "1 bed", more read "beds"', () => {
  const one = pick((x) => x.beds === 1, 'an outside hospital with one bed');
  const many = pick((x) => Number.isInteger(x.beds) && x.beds > 1, 'an outside hospital with more beds');
  const nb = (text) => text.replace(/ /g, '\u00a0');
  assert.ok(mainOf(render(one)).includes(nb(COPY.typeBed.replace('{beds}', '1'))), 'singular');
  assert.ok(!/\b1\u00a0beds\b/.test(mainOf(render(one))), 'never "1 beds"');
  assert.ok(mainOf(render(many)).includes(nb(COPY.typeBeds.replace('{beds}', String(many.beds)))), 'plural');
});
