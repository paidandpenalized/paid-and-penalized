// The work-requirement program page in a real browser (pages.test.js has its load checks and one axe pass, and the hub
// hospital pages' Medicaid band):
//   - the stage head: the scenario switch moves step 1's range rows (low < middle < high), and the use-rate what-if at
//     75% and 125% moves them (still low < middle < high at each), and Back to 100% gives the server's words back;
//   - a group chip and the state list light a group in the strips, and Clear puts every hospital back;
//   - the page's hospital, set by ?h= or by Find, is the one steps 1, 4 and 5 name; a pick follows (the address's ?h= and
//     the header's chip, which names it without a dollar figure, R29), and a pick the hub's asset doesn't have stops the
//     chip; the random default does not follow (R23);
//   - the random default and "Show another at random" never draw a Virginia hospital (the page's Math.random is fed
//     chosen draws, so each pick is known in advance);
//   - steps 3 and 5 fetch their own data as they near, once, and the page stays quiet (no console or CSP error);
//   - with JavaScript off every step's figure is there as SVG, the middle case shows, and the controls are hidden;
//   - each step fits the window from 1280 x 720 to 1440 x 1000, and below 900 px the steps stack with no sticky stage;
//   - axe, light and dark: at 1280 px once per step (the story shows one step's figure at a time and leaves the others
//     unseen, which axe skips), and at 390 and 320 px on the stacked page, every step's data in; and the dots that mark
//     the case shown, the Find's matches and the page's hospital stand 3:1 off the paper.
// Hospitals are picked from the emitted data by property, never named: CI's logs are public, so no message or assertion
// prints a hospital's name or CCN. Runs against dist/ (make build) or any URL; see site.js.
import { before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hubHospitals } from '../../hub/model.js';
import { loadHub } from '../../hub/data.js';
import { loadMedicaid } from '../../sites/work-requirement/web/data.js';
import { PROGRAM_PATH } from '../../sites/work-requirement/web/links.js';
import { hospitalRows } from '../../sites/work-requirement/web/program/strips.js';
import { AXE_WIDTHS, audit, grainWorst, openFolds } from './axe.js';
import { CONCURRENCY, ENGINE, SCHEMES, assertNoSideways, assertQuiet, eventually, fetchesOf, settle, useBrowser, useContext, withPage } from './lib.js';

const shared = useBrowser();

// The state no page may open on, nor draw at random (global constraints: never Mary Washington, Stafford or any UVA
// Health hospital), written out here rather than read from the page's constants, so the check is the spec's.
const SKIP = 'VA';
const ROWS = hospitalRows(loadMedicaid());
const HUB = new Map(hubHospitals(loadHub()).map((h) => [h.ccn, h]));
// Every hospital the strips draw in a scenario state, Virginia's among them, in the file's order (the order the page's
// pool keeps), and the pool the page may draw from: the same without Virginia.
const DRAWN = ROWS.filter((r) => r.share && r.cls === 'scenario');
const POOL = DRAWN.filter((r) => r.state !== SKIP);
// A hospital a pick can name in full on the strips (a short name: the thread's label is never shortened) that the hub
// has a page for, outside Virginia; `not` a state it must not share with an earlier pick.
const pickable = (not = null) => POOL.find((r) => HUB.has(r.ccn) && r.name.length <= 24 && r.state !== not);
const FIRST = pickable();
const SECOND = pickable(FIRST?.state);
// A hospital in the file the hub's asset doesn't have (the header can't name it), outside Virginia.
const UNKNOWN = ROWS.find((r) => !HUB.has(r.ccn) && r.state !== SKIP);
if (!FIRST || !SECOND || !UNKNOWN) throw new Error('wr-interact.test.js: the emitted data has no hospital for one of the picks');

const STEPS = ['finding', 'how', 'states', 'hospital', 'both'];
const RANGES = ['lost', 'added', 'income'];
const CASES = ['low', 'middle', 'high'];

// ---------- the page ----------

// Resolves once the page's script has its data and has drawn from it: the stage head (the switch and the what-if), the
// chips and step 4's random pick show, and step 4's card has its hospital's numbers.
async function ready(page) {
  await page.locator('[data-stage-head]:not([hidden])').waitFor({ state: 'attached' });
  await page.locator('.wr-chips:not([hidden])').waitFor({ state: 'attached' });
  await page.locator('[data-h-pick]:not([hidden])').waitFor({ state: 'attached' });
  await page.locator('[data-h-card]:not([aria-busy])').waitFor({ state: 'attached' });
}

// What steps 3 and 5 show once their own data has come and their script has redrawn them: step 3's state list takes the
// state's name's place, and step 5's named table is limited to its first rows.
const MOUNTED = { states: '#states .wr-stcard__pick:not([hidden])', both: '#both [data-b-named][data-limited]' };

// Scrolls the step's top to just under the sticky header, where the story makes it the step in view.
const scrollToStep = (page, id) => page.evaluate((id) => {
  const top = parseFloat(document.documentElement.style.getPropertyValue('--sticky-top')) || 0;
  window.scrollTo({ top: document.getElementById(id).getBoundingClientRect().top + window.scrollY - top, behavior: 'instant' });
}, id);

// Brings each step near in turn (each lazy step's data comes as it nears) and waits for steps 3 and 5 to be drawn from
// theirs.
async function bringAll(page) {
  for (const id of STEPS) {
    await scrollToStep(page, id);
    if (MOUNTED[id]) await page.locator(MOUNTED[id]).waitFor({ state: 'attached' });
  }
}

// In the story (from 900 px): the step scrolled into view, and its figure shown whole (no dots in flight, the fade done).
async function showStep(page, id) {
  await scrollToStep(page, id);
  if (MOUNTED[id]) await page.locator(MOUNTED[id]).waitFor({ state: 'attached' });
  await eventually(() => page.evaluate((id) => {
    const stage = document.querySelector(`#${id} > .wr-step__stage`);
    const fig = stage?.querySelector('.wr-step__fig');
    return Boolean(fig) && stage.hasAttribute('data-on') && !stage.hasAttribute('data-flying') && getComputedStyle(fig).opacity === '1'
      && fig.getAnimations({ subtree: true }).every((a) => a.playState !== 'running');
  }, id), `step ${id} is not the one shown`);
}

// Step 1's three range rows: { lost, added, income }, each { v (the range), mid (the case shown's line) }.
const rangesOf = (page) => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#finding .wr-range')].map((el) => [
  el.dataset.range, { v: el.querySelector('.wr-range__v').textContent, mid: el.querySelector('.wr-range__mid').textContent },
])));

// A dollar amount's value: the first "$1.2B" (K, M or B, or none) in the text.
function dollars(text) {
  const m = /\$([\d.,]+)\s*([KMB])?/.exec(text);
  assert.ok(m, 'a dollar amount in the range row');
  return Number(m[1].replace(/,/g, '')) * ({ K: 1e3, M: 1e6, B: 1e9 }[m[2]] ?? 1);
}

// Picks a case with the stage head's switch, and waits for the range rows to name it.
async function pickCase(page, scenario) {
  const word = `${scenario[0].toUpperCase()}${scenario.slice(1)}`;
  await page.locator('.wr-switch__opt', { hasText: word }).click();
  await eventually(async () => Object.values(await rangesOf(page)).every((r) => r.mid.startsWith(`${word} case:`)), `the range rows name the ${scenario} case`);
  return rangesOf(page);
}

// Each range row's case line, read under each case in turn: { lost: [low, middle, high], ... } as dollars. Leaves the
// middle case picked.
async function midsByCase(page) {
  const out = Object.fromEntries(RANGES.map((key) => [key, []]));
  for (const scenario of CASES) {
    const ranges = await pickCase(page, scenario);
    for (const key of RANGES) out[key].push(dollars(ranges[key].mid));
  }
  await pickCase(page, 'middle');
  return out;
}

const assertOrdered = (mids, what) => {
  for (const key of RANGES) {
    const [low, middle, high] = mids[key];
    assert.ok(low < middle && middle < high, `${what}: the ${key} row's cases run low < middle < high`);
  }
};

// The page's hospital as each step names it: step 1's thread label in the strips on show (or the line that says the
// strips don't draw it), step 4's record card's CCN, and step 5's line under its head.
const namedBySteps = (page) => page.evaluate(() => {
  const shown = [...document.querySelectorAll('#figure-1 svg[data-fit]')].find((svg) => svg.checkVisibility());
  return {
    strips: shown?.querySelector('.wr-thread__name')?.textContent ?? null,
    stripsDots: shown?.querySelectorAll('.wr-thread__dot').length ?? 0,
    card: document.querySelector('[data-h-card] .wr-rec')?.dataset.ccn ?? null,
    cardName: document.querySelector('[data-h-card] .wr-rec__name')?.textContent ?? null,
    both: document.querySelector('[data-b-you]')?.textContent ?? null,
  };
});

// Waits until steps 1, 4 and 5 all name the row's hospital (step 5 once its data has come: it is brought near).
async function assertStepsName(page, row, what) {
  await scrollToStep(page, 'both');
  await page.locator(MOUNTED.both).waitFor({ state: 'attached' });
  const got = await eventually(async () => {
    const n = await namedBySteps(page);
    return n.strips === row.name && n.card === row.ccn && n.cardName?.includes(row.name) && n.both?.includes(row.name) ? n : null;
  }, `${what}: steps 1, 4 and 5 do not all name the hospital`);
  assert.equal(got.stripsDots, 3, `${what}: step 1 threads the hospital through its three dots`);
}

// The header's chip: shown, its name, and whether it carries a dollar figure (R29: never on this page).
const chipOf = (page) => page.evaluate(() => {
  const chip = document.querySelector('header.fam [data-chip]');
  return { shown: Boolean(chip) && !chip.hidden, name: chip?.querySelector('.chip__t')?.textContent ?? null, value: chip?.querySelectorAll('.chip__v').length ?? 0 };
});

// The CCN the page's address follows (?h=), or null.
const followed = (page) => new URL(page.url()).searchParams.get('h');

// Picks the row's hospital with the bar's Find: its CCN typed, its one option taken with Enter.
async function find(page, row) {
  const box = page.locator('#omni-q');
  await box.fill(row.ccn);
  const options = page.locator('#omni-list [role="option"]');
  await eventually(async () => (await options.count()) === 1 && (await box.getAttribute('aria-expanded')) === 'true', 'Find does not list exactly one hospital for a CCN');
  await box.press('Enter');
}

// ---------- the controls ----------

describe('the work-requirement page\'s controls', { concurrency: CONCURRENCY }, () => {
  const tabs = useContext(shared);

  it('the scenario switch moves the range rows, low < middle < high, and the middle case gives the server\'s words back', () => withPage(tabs, { path: PROGRAM_PATH, watched: true }, async (page, { seen }) => {
    await ready(page);
    const server = await rangesOf(page);
    assert.ok(RANGES.every((key) => server[key].mid.startsWith('Middle case:')), 'the page opens on the middle case');
    const low = await pickCase(page, 'low');
    assert.ok(RANGES.every((key) => low[key].mid !== server[key].mid), 'the low case changes every row\'s case line');
    assert.ok(RANGES.every((key) => low[key].v === server[key].v), 'the range itself is the same in every case');
    // Only the drawing on show is redrawn (the other when the width brings it on).
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('#figure-1 svg[data-fit]')].find((svg) => svg.checkVisibility())?.querySelector('.wr-strip--on')?.dataset.scen), 'low', 'the strips raise the low case');
    assertOrdered(await midsByCase(page), 'at 100%');
    assert.deepEqual(await rangesOf(page), server, 'back on the middle case, the rows read as the server wrote them');
    await assertQuiet(seen, 'the scenario switch');
  }));

  // D1 (11-11): step 5's penalties label names the hospitals the sum is of (the corner's count, as its head gives it), and
  // the line under it stays, in the browser's redraw at each case as on the server's step.
  it('step 5\'s penalties label names the corner\'s count in each case, with the line that the case moves the group', () => withPage(tabs, { path: PROGRAM_PATH, watched: true }, async (page, { seen }) => {
    await ready(page);
    await scrollToStep(page, 'both');
    await page.locator(MOUNTED.both).waitFor({ state: 'attached' });
    const readOf = () => page.evaluate(() => {
      const read = document.querySelector('#both [data-b-read]');
      return {
        count: /; ([\d,]+) in the \w+ case\.$/.exec(document.querySelector('#both .wr-both__lab').textContent.trim())?.[1] ?? null,
        pen: read.querySelectorAll('dt')[1].textContent.replace(/\s+/g, ' ').trim(),
        shift: read.querySelector('.wr-both__shift')?.textContent ?? null,
      };
    });
    const seenCounts = new Set();
    for (const scenario of CASES) {
      await pickCase(page, scenario);
      await eventually(async () => {
        const r = await readOf();
        return r.count !== null && r.pen.includes(` ${r.count} hospitals`);
      }, `step 5's label follows the ${scenario} case`);
      const r = await readOf();
      assert.ok(r.pen.startsWith(`Medicare penalties of these ${r.count} hospitals, FY`), `${scenario}: the label names the count`);
      assert.match(r.shift, /changes which hospitals cross the 1% line, not any hospital’s penalties\./, `${scenario}: the line under the numbers`);
      seenCounts.add(r.count);
    }
    assert.equal(seenCounts.size, CASES.length, 'each case its own count');
    await pickCase(page, 'middle');
    await assertQuiet(seen, 'step 5\'s readout');
  }));

  it('the use rate at 75% and 125% moves the range rows, cases still in order, and Back to 100% restores them', () => withPage(tabs, { path: PROGRAM_PATH, watched: true }, async (page, { seen }) => {
    await ready(page);
    const server = await rangesOf(page);
    const counts = await page.locator('#finding .wr-counts').textContent();
    const slider = page.locator('#wr-use');
    const reset = page.locator('.wr-use__reset');
    // The slider moved by a key to value, once the rows have moved off what they read before (another rate's, or the
    // server's).
    const at = async (key, value) => {
      const was = (await rangesOf(page)).lost.v;
      await slider.focus();
      await slider.press(key);
      assert.equal(await slider.inputValue(), value, `${key} puts the slider at ${value}`);
      assert.equal(await page.locator('.wr-use__v').textContent(), `${value}%`, 'the readout follows');
      await eventually(async () => (await rangesOf(page)).lost.v !== was, `the range rows move at ${value}%`);
      assert.equal(await reset.isVisible(), true, 'Back to 100% shows off the default');
      return rangesOf(page);
    };
    const low = await at('Home', '75');
    assert.ok(RANGES.every((key) => low[key].v !== server[key].v), 'every range moves at 75%');
    assert.ok(dollars(low.lost.mid) < dollars(server.lost.mid), 'less use, less revenue lost (middle case)');
    assertOrdered(await midsByCase(page), 'at 75%');
    const high = await at('End', '125');
    assert.ok(RANGES.every((key) => high[key].v !== server[key].v), 'every range moves at 125%');
    assert.ok(dollars(high.lost.mid) > dollars(server.lost.mid), 'more use, more revenue lost (middle case)');
    assertOrdered(await midsByCase(page), 'at 125%');
    await reset.click();
    await eventually(async () => JSON.stringify(await rangesOf(page)) === JSON.stringify(server), 'Back to 100% does not restore the server\'s range rows');
    assert.equal(await slider.inputValue(), '100', 'the slider is back at 100');
    assert.equal(await page.locator('#finding .wr-counts').textContent(), counts, 'and the counts line');
    assert.equal(await reset.isVisible(), false, 'Back to 100% goes once there');
    await assertQuiet(seen, 'the use rate');
  }));

  it('a chip and the state list light a group in the strips, and Clear puts every hospital back', () => withPage(tabs, { path: PROGRAM_PATH, watched: true }, async (page, { seen }) => {
    await ready(page);
    const out = page.locator('.wr-chips__out');
    const clear = page.locator('.wr-chips__clear');
    const hint = await out.textContent();
    const outline = () => page.locator('#figure-1 svg[data-fit] .wr-outline').count();
    assert.equal(await outline(), 0, 'no group is lit at first');
    const chip = page.locator('.wr-chip[data-group="critical_access"]');
    await chip.click();
    assert.equal(await chip.getAttribute('aria-pressed'), 'true', 'the chip is pressed');
    await eventually(async () => (await outline()) > 0, 'the strips draw the gray outline of every hospital behind the group');
    assert.ok((await out.textContent()).includes(await chip.getAttribute('data-name')), 'the readout names the group');
    assert.equal(await clear.isVisible(), true, 'Clear shows');
    // A second chip replaces the first.
    const second = page.locator('.wr-chip[data-group="rural"]');
    await second.click();
    assert.equal(await second.getAttribute('aria-pressed'), 'true', 'the second chip is pressed');
    assert.equal(await chip.getAttribute('aria-pressed'), 'false', 'one group at a time');
    await clear.click();
    await eventually(async () => (await outline()) === 0, 'Clear does not put every hospital back');
    assert.equal(await out.textContent(), hint, 'the readout goes back to its hint');
    assert.equal(await page.locator('.wr-chip[aria-pressed="true"]').count(), 0, 'no chip is pressed');
    // The state list lights one state.
    const select = page.locator('.wr-chips__state');
    const state = await select.locator('option:not([value=""])').first().getAttribute('value');
    await select.selectOption(state);
    await eventually(async () => (await outline()) > 0, 'the state list lights a state');
    assert.notEqual(await out.textContent(), hint, 'the readout speaks of the state');
    await clear.click();
    await eventually(async () => (await outline()) === 0, 'Clear puts the state\'s hospitals back');
    assert.equal(await select.inputValue(), '', 'the state list is emptied');
    await assertQuiet(seen, 'the chips');
  }));

  it('a ?h= sets the hospital in steps 1, 4 and 5, and the header\'s chip names it without a dollar figure', () => withPage(tabs, { path: `${PROGRAM_PATH}?h=${FIRST.ccn}`, watched: true }, async (page, { seen }) => {
    await ready(page);
    await assertStepsName(page, FIRST, 'a ?h=');
    const chip = await eventually(async () => {
      const c = await chipOf(page);
      return c.shown ? c : null;
    }, 'the header\'s chip does not show the followed hospital');
    assert.ok(chip.name === HUB.get(FIRST.ccn).name, 'the chip names the hospital');
    assert.equal(chip.value, 0, 'the chip has no dollar figure on this page (R29)');
    await assertQuiet(seen, 'a ?h=');
  }));

  it('Find sets the hospital in steps 1, 4 and 5, and the address and the chip follow; a pick the hub lacks stops the chip', () => withPage(tabs, { path: PROGRAM_PATH, watched: true }, async (page, { seen }) => {
    await ready(page);
    // The random default does not follow (R23): no ?h=, no chip.
    assert.ok(followed(page) === null, 'the random default writes no ?h=');
    assert.equal((await chipOf(page)).shown, false, 'nor fills the chip');
    await scrollToStep(page, 'finding');
    await find(page, FIRST);
    await assertStepsName(page, FIRST, 'a Find pick');
    assert.ok(followed(page) === FIRST.ccn, 'the pick is in the address\'s ?h=');
    await eventually(async () => (await chipOf(page)).shown, 'the chip does not follow the pick');
    const chip = await chipOf(page);
    assert.ok(chip.name === HUB.get(FIRST.ccn).name, 'the chip names the pick');
    assert.equal(chip.value, 0, 'the chip has no dollar figure on this page (R29)');
    // A second pick, in another state (its own asset), moves the steps and the chip on.
    await scrollToStep(page, 'finding');
    await find(page, SECOND);
    await assertStepsName(page, SECOND, 'a second Find pick');
    assert.ok(followed(page) === SECOND.ccn, 'the second pick is in the address');
    await eventually(async () => (await chipOf(page)).name === HUB.get(SECOND.ccn).name, 'the chip does not move to the second pick');
    // A hospital the hub's asset doesn't have: the page shows it and the header stops naming the one before.
    await scrollToStep(page, 'finding');
    await find(page, UNKNOWN);
    await eventually(async () => (await namedBySteps(page)).card === UNKNOWN.ccn, 'step 4 does not show a pick the hub lacks');
    assert.ok(followed(page) === UNKNOWN.ccn, 'that pick is in the address too');
    await eventually(async () => !(await chipOf(page)).shown, 'the chip goes on naming the hospital picked before');
    await assertQuiet(seen, 'Find');
  }));

  it('steps 3 and 5 fetch their data as they near, once each, and the page stays quiet through every step', () => withPage(tabs, { path: PROGRAM_PATH, watched: true }, async (page, { seen }) => {
    await ready(page);
    assert.equal(await fetchesOf(page, 'wr-states'), 0, 'step 3\'s data waits until the step nears');
    assert.equal(await fetchesOf(page, 'wr-both'), 0, 'step 5\'s data waits until the step nears');
    await bringAll(page);
    // Back up and down again: nothing fetched twice.
    for (const id of [...STEPS].reverse()) await scrollToStep(page, id);
    await bringAll(page);
    assert.equal(await fetchesOf(page, 'wr-states'), 1, 'step 3\'s data, once');
    assert.equal(await fetchesOf(page, 'wr-both'), 1, 'step 5\'s data, once');
    assert.equal(await fetchesOf(page, 'wr-strips'), 1, 'the strips\' data, once');
    await assertNoSideways(page, 'the program page');
    await assertQuiet(seen, 'every step');
  }));
});

// ---------- the random pick ----------

// Tied to the picker: randomPick (web/program/hospital.js) maps a draw d to the hospital at floor(d × n) of the n it
// draws from. A picker that maps draws any other way breaks this test (each expected pick is worked out that way), not
// the page; change both together.
// The page's Math.random is fed draws chosen in advance (window.__draws, then the browser's own once they run out), so
// each pick is known: the page opens on POOL[floor(d * POOL.length)], and "Show another at random" draws from the pool
// without the hospital shown. The draws are those that would land on a Virginia hospital were the pool to keep them
// (every fourth of DRAWN's Virginia run, and its last), then a stride across [0, 1): if the page drew from DRAWN, each of
// the first would pick a Virginia hospital.
describe('the random pick never draws a Virginia hospital', () => {
  const at = DRAWN.flatMap((r, i) => (r.state === SKIP ? [i] : []));
  assert.ok(at.length > 0 && at[at.length - 1] - at[0] === at.length - 1, 'the file keeps Virginia\'s hospitals together');
  const intoVirginia = at.filter((_, j) => j % 4 === 0 || j === at.length - 1).map((i) => (i + 0.5) / DRAWN.length);
  assert.ok(intoVirginia.every((d) => DRAWN[Math.floor(d * DRAWN.length)].state === SKIP), 'each aimed draw picks a Virginia hospital from DRAWN');
  const STRIDE = 12;
  const DRAWS = [...intoVirginia, ...Array.from({ length: STRIDE }, (_, j) => (j + 0.5) / STRIDE)];
  // Below the story's width: the steps stack, so the card and its button sit in the page's flow.
  const tabs = useContext(shared, { width: 800 });
  before(() => tabs.context.addInitScript((first) => {
    const own = Math.random;
    window.__draws = [first];
    Math.random = () => (window.__draws.length ? window.__draws.shift() : own());
  }, intoVirginia[0]));

  it(`the default and ${DRAWS.length} picks of "Show another at random", each the pool's, none in Virginia`, (t) => withPage(tabs, { path: PROGRAM_PATH, watched: true }, async (page, { seen }) => {
    await ready(page);
    const shown = () => page.locator('[data-h-card] .wr-rec').getAttribute('data-ccn');
    let current = POOL[Math.floor(intoVirginia[0] * POOL.length)];
    assert.ok(await shown() === current.ccn, 'the default is the pool\'s pick for the draw');
    assert.ok(followed(page) === null, 'and is not followed (R23)');
    const button = page.locator('[data-h-pick] button');
    for (const d of DRAWS) {
      const from = POOL.filter((r) => r.ccn !== current.ccn);
      const next = from[Math.floor(d * from.length)];
      await page.evaluate((v) => window.__draws.push(v), d);
      await button.click();
      await eventually(async () => (await shown()) === next.ccn, 'the card does not show the pool\'s pick for the draw');
      assert.ok(followed(page) === next.ccn, 'the pick is followed in the address');
      // The state of the hospital the page shows (its card's CCN), not of the pick worked out above.
      const on = await shown();
      assert.ok(ROWS.find((r) => r.ccn === on)?.state !== SKIP, 'never a Virginia hospital');
      current = next;
    }
    t.diagnostic(`${DRAWS.length + 1} picks (${intoVirginia.length} aimed at Virginia's run), none in Virginia`);
    await assertQuiet(seen, 'the random pick');
  }));
});

// ---------- without JavaScript ----------

describe('the work-requirement page without JavaScript', { concurrency: CONCURRENCY }, () => {
  for (const width of [1280, 390]) {
    const tabs = useContext(shared, { width, javaScript: false });
    it(`${width} px: every step's figure is SVG, the middle case shows, and the controls are hidden`, () => withPage(tabs, { path: PROGRAM_PATH }, async (page) => {
      const facts = await page.evaluate((steps) => ({
        story: document.querySelector('.wr-scrolly--on') !== null,
        steps: steps.map((id) => {
          const svgs = [...document.querySelectorAll(`#${id} > .wr-step__stage svg`)].filter((svg) => svg.checkVisibility() && svg.childElementCount > 0);
          return { id, svgs: svgs.length, img: svgs.some((svg) => svg.getAttribute('role') === 'img' && svg.getAttribute('aria-label')) };
        }),
        mids: [...document.querySelectorAll('#finding .wr-range__mid')].map((p) => p.textContent),
        middle: document.querySelector('input[name="wr-scen"][value="middle"]')?.checked ?? false,
        raised: document.querySelector('#figure-1 svg[data-fit] .wr-strip--on')?.dataset.scen ?? null,
      }), STEPS);
      assert.equal(facts.story, false, 'no story without the script: the steps stack');
      for (const step of facts.steps) {
        assert.ok(step.svgs > 0, `step ${step.id}: its figure is drawn as SVG`);
        assert.ok(step.img, `step ${step.id}: its figure has a text alternative`);
      }
      assert.ok(facts.mids.length === 3 && facts.mids.every((m) => m.startsWith('Middle case:')), 'the range rows give the middle case');
      assert.equal(facts.middle, true, 'the switch\'s middle case is the one checked');
      assert.equal(facts.raised, 'middle', 'the strips raise the middle case');
      const visible = (sel) => page.evaluate((s) => [...document.querySelectorAll(s)].filter((el) => el.checkVisibility()).length, sel);
      for (const sel of ['[data-stage-head]', '#wr-use', 'input[name="wr-scen"]', '.wr-chips', 'header.fam form#omni', '[data-h-pick]', '.wr-stcard__pick', '[data-b-all]', '.fig__btn', '.wr-use__reset']) {
        assert.equal(await visible(sel), 0, `${sel} is hidden`);
      }
      assert.equal(await visible('[data-h-noscript]'), 1, 'step 4 says how its hospital was chosen');
      await assertNoSideways(page, 'the program page without scripts');
    }));
  }
});

// ---------- fit ----------

// Each step's figure in the story fits the window under the header: its pin needs no scroll of its own (no table is open)
// and ends on screen.
describe('each step fits the window', { concurrency: CONCURRENCY }, () => {
  for (const [width, height] of [[1280, 720], [1440, 1000]]) {
    const tabs = useContext(shared, { width, height });
    it(`${width} x ${height}`, () => withPage(tabs, { path: PROGRAM_PATH, watched: true }, async (page, { seen }) => {
      await ready(page);
      assert.equal(await page.locator('.wr-scrolly--on').count(), 1, 'the story is on');
      for (const id of STEPS) {
        await showStep(page, id);
        const fit = await page.evaluate((id) => {
          const pin = document.querySelector(`#${id} .wr-step__pin`);
          const fig = pin.querySelector('.wr-step__fig');
          const header = document.querySelector('header.fam').getBoundingClientRect().bottom;
          return { scrolls: pin.scrollHeight - pin.clientHeight, bottom: fig.getBoundingClientRect().bottom, top: fig.getBoundingClientRect().top, header, height: window.innerHeight };
        }, id);
        assert.ok(fit.scrolls <= 1, `step ${id}: the figure overflows its pin by ${Math.round(fit.scrolls)} px`);
        assert.ok(fit.bottom <= fit.height + 1, `step ${id}: the figure ends ${Math.round(fit.bottom - fit.height)} px below the window`);
        assert.ok(fit.top >= fit.header - 1, `step ${id}: the figure starts under the header`);
      }
      await assertQuiet(seen, `the story at ${width} x ${height}`);
    }));
  }

  const narrow = useContext(shared, { width: 899 });
  it('899 px: the steps stack, every figure shown, no sticky stage', () => withPage(narrow, { path: PROGRAM_PATH, watched: true }, async (page, { seen }) => {
    await ready(page);
    await bringAll(page);
    const facts = await page.evaluate(() => ({
      on: document.querySelector('.wr-scrolly--on') !== null,
      sticky: [...document.querySelectorAll('.wr-step__pin, .wr-step__stage')].filter((el) => getComputedStyle(el).position === 'sticky').length,
      unseen: [...document.querySelectorAll('.wr-step__fig')].filter((fig) => getComputedStyle(fig).opacity !== '1').length,
    }));
    assert.equal(facts.on, false, 'no story');
    assert.equal(facts.sticky, 0, 'no sticky stage');
    assert.equal(facts.unseen, 0, 'every figure shows');
    await assertNoSideways(page, 'the stacked program page');
    await assertQuiet(seen, 'the stacked program page');
  }));
});

// ---------- touch ----------

// Under a coarse pointer every control the page draws takes the kit's touch height (--control-h, 44px: tokens.css), as
// the shared fields and the hub's controls do (the 11-15 audit's deferral); text links inside a sentence are exempt, as
// WCAG's target rule exempts them. And the stacked page never scrolls sideways at a phone's widths.
// Touch is emulated in Chromium and WebKit (Playwright's Firefox has no touch).
describe('the work-requirement page under touch', { skip: ENGINE === 'firefox' && 'no touch in Firefox', concurrency: CONCURRENCY }, () => {
  for (const width of [390, 320]) {
    const tabs = useContext(shared, { width, height: 800, options: { hasTouch: true, isMobile: true } });
    it(`${width} px: every control is 44 px tall, and nothing scrolls sideways`, () => withPage(tabs, { path: PROGRAM_PATH, watched: true }, async (page, { seen }) => {
      await ready(page);
      await bringAll(page);
      const short = await page.evaluate(() => {
        // A switch option's radio is hidden over its label, so the label is the target.
        const CONTROLS = '.wr button, .wr select, .wr input:not(.wr-switch__opt input), .wr summary, .wr .wr-lines, .wr .wr-switch__opt';
        const label = (el) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`;
        return [...document.querySelectorAll(CONTROLS)]
          // A hidden control has no target.
          .filter((el) => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden')
          .map((el) => [label(el), Math.round(el.getBoundingClientRect().height * 10) / 10])
          .filter(([, h]) => h < 44);
      });
      assert.deepEqual([...new Set(short.map(([l, h]) => `${l} ${h}px`))], [], 'controls under 44 px');
      await assertNoSideways(page, `the program page at ${width} px under touch`);
      await assertQuiet(seen, `the program page at ${width} px under touch`);
    }));
  }
});

// ---------- accessibility ----------

// WCAG's contrast ratio of two colours the browser prints ('rgb(r, g, b)' or 'rgba(...)').
function contrast(a, b) {
  const lum = (rgb) => {
    const [r, g, bl] = rgb.match(/[\d.]+/g).slice(0, 3).map((c) => {
      const v = Number(c) / 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// The marks review focus 5 names, by the paint that draws each: the case shown's dots, the Find's matches and the page's
// hospital in step 1, and the corner's dots and the page's hospital in step 5.
const MARKS = [
  ['step 1: the case shown\'s dots', '#figure-1 .wr-dots--on', 'stroke'],
  ['step 1: the Find\'s matches', '#figure-1 .wr-dots--lit', 'stroke'],
  ['step 1: the page\'s hospital', '#figure-1 .wr-thread__dot', 'fill'],
  ['step 5: the corner\'s dots', '#figure-5 .wr-bdots--on', 'stroke'],
  ['step 5: the page\'s hospital', '#figure-5 .wr-b__dot', 'fill'],
];

for (const scheme of SCHEMES) {
  describe(`the work-requirement page, axe, ${scheme}`, { concurrency: CONCURRENCY }, () => {
    const wide = useContext(shared, { width: AXE_WIDTHS[0] });
    it(`${AXE_WIDTHS[0]} px, each step in view`, (t) => withPage(wide, { path: PROGRAM_PATH, scheme, watched: true }, async (page, { seen }) => {
      await ready(page);
      await bringAll(page);
      await openFolds(page);
      for (const id of STEPS) {
        await t.test(id, async () => {
          await showStep(page, id);
          await audit(page, `the program page, step ${id}`);
        });
      }
      await assertQuiet(seen, `axe at ${AXE_WIDTHS[0]} px`);
    }));

    for (const width of AXE_WIDTHS.slice(1)) {
      const tabs = useContext(shared, { width });
      it(`${width} px, the steps stacked, every step's data in`, () => withPage(tabs, { path: PROGRAM_PATH, scheme, watched: true }, async (page, { seen }) => {
        await ready(page);
        await bringAll(page);
        assert.equal(await page.locator('.wr-scrolly--on').count(), 0, 'the steps stack');
        await openFolds(page);
        await audit(page, `the program page at ${width} px`);
        await assertQuiet(seen, `axe at ${width} px`);
      }));
    }

    it('the dots that mark the case, the matches and the page\'s hospital stand 3:1 off the paper', () => withPage(wide, { path: `${PROGRAM_PATH}?h=${FIRST.ccn}`, scheme, watched: true }, async (page, { seen }) => {
      await ready(page);
      await bringAll(page);
      await scrollToStep(page, 'finding');
      // A query that matches many hospitals lights their dots.
      await page.locator('#omni-q').fill(FIRST.state);
      await page.locator('#figure-1 .wr-dots--lit').first().waitFor({ state: 'attached' });
      await settle(page);
      const { worst } = await grainWorst(page);
      const paints = await page.evaluate((marks) => marks.map(([what, sel, prop]) => {
        const el = document.querySelector(sel);
        return [what, el ? getComputedStyle(el)[prop] : null];
      }), MARKS);
      for (const [what, paint] of paints) {
        assert.ok(paint, `${what}: drawn`);
        const ratio = contrast(paint, worst);
        assert.ok(ratio >= 3, `${what}: ${ratio.toFixed(2)}:1 against the paper (${worst}), under 3:1`);
      }
      await assertQuiet(seen, 'the marks\' contrast');
    }));
  });
}
