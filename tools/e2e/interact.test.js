// What a reader does on the pages, in a real browser: the hospital search finds a hospital and opens its page, the
// what-if recomputes when a measure changes, the keyboard reaches every control without a focused element sliding under
// the sticky top bar, and with JavaScript off every page keeps its footer (the hub's pages lose nothing, and a hospital's
// page across the programs shows its record, net, dollars and headline, with no empty frame). Runs
// against dist/ (make build) or any URL (E2E_BASE_URL); see site.js. CI's logs are public, so no message or assertion
// here prints a hospital's name, city, CCN or values, or a search list's options: they say counts, or the page type.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalize } from '../../web/client/search.js';
import { RELEASE_MS } from '../../web/client/topbar.js';
import { PROGRAM_PATH } from '../ci/page-types.js';
import { CONCURRENCY, FEEDBACK_LINK, SEARCH_BOXES, assertQuiet, searchIn, settle, useBrowser, useContext, withPage } from './lib.js';
import { samplePages } from './site.js';

const PAGES = samplePages();
const CUT = PAGES.find((p) => p.type === 'hospital-cut');
// 1280 px, the narrowest width the top bar sticks (641), and the narrowest phone width, where it scrolls away.
const WIDTHS = [1280, 641, 320];
// Pixels a focused element may sit under the top bar's edge before it counts as under it (see focusFacts).
const SNAP = 1;
// The most Tab presses a walk may take before it fails: the longest page needs about half as many each way.
const MAX_PRESSES = 1000;

const shared = useBrowser();

// Calls fn until it returns something truthy, for up to five seconds; its last answer goes in the failure.
async function eventually(fn, what) {
  const end = Date.now() + 5000;
  let last;
  while (Date.now() < end) {
    last = await fn();
    if (last) return last;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail(`${what} (last seen: ${JSON.stringify(last)})`);
}

describe('search', () => {
  const tabs = useContext(shared);

  // The program page holds two boxes over one index: the top bar's and the larger one in its hero.
  for (const [where, container] of SEARCH_BOXES) {
    it(`${where}: the hospital's name, typed word by word, lists it, and Enter opens its page`, () => withPage(tabs, { path: PROGRAM_PATH, watched: true }, async (page, { seen }) => {
      const { name, state } = CUT.hospital;
      const words = name.split(/\s+/);
      const { box, list } = searchIn(page, container);
      // The list shows names in display case (the data holds them as CMS prints them), each with its city and state
      // beneath. It lists at most ten, so a name that opens with a common word needs more of its words to be listed:
      // the query grows by one until the hospital is among them. The hospital is the option with its name and its state.
      const options = () => list.evaluateAll((items) => items.map((li) => ({ label: li.querySelector('.omni__t')?.textContent ?? '', sub: li.querySelector('.omni__s')?.textContent ?? '' })));
      const find = async () => (await options()).findIndex((o) => normalize(o.label) === normalize(name) && o.sub.includes(`, ${state}`));
      let at = -1;
      for (const [i, word] of words.entries()) {
        await box.pressSequentially(i === 0 ? word : ` ${word}`);
        // The index loads on first focus: the list is up once it has, and a later word repaints it at once.
        await eventually(async () => (await box.getAttribute('aria-expanded')) === 'true', `the list is not up after ${i + 1} of the name's ${words.length} words`);
        at = await find();
        if (at >= 0) break;
      }
      const shown = await list.count();
      assert.ok(at >= 0, `typing all ${words.length} words of the name does not list the hospital; the list shows ${shown} option${shown === 1 ? '' : 's'}`);
      // The first match is active; arrow down to the hospital's, as a reader would, then Enter.
      for (let i = 0; i < at; i++) await box.press('ArrowDown');
      assert.equal(await box.getAttribute('aria-activedescendant'), await list.nth(at).getAttribute('id'), 'the hospital\'s option is the active one');
      await box.press('Enter');
      // Waited for by a test, not by address: a timeout would print the address.
      const opened = await page.waitForURL((url) => url.pathname === CUT.path, { timeout: 10000 }).then(() => true, () => false);
      assert.ok(opened, 'Enter opens the hospital\'s page');
      assert.ok(normalize(await page.locator('h1').innerText()) === normalize(name), 'the page opened is the hospital\'s');
      await assertQuiet(seen, 'search');
    }));
  }
});

describe('what-if', () => {
  const tabs = useContext(shared);

  it('changing a measure on a hospital CMS cut changes the result', () => withPage(tabs, { path: CUT.path, watched: true }, async (page, { seen }) => {
    const whatIf = page.locator('#whatif');
    const headScore = whatIf.locator('[data-wi="head-score"]');
    const hypothetical = whatIf.locator('[data-wi="score"]');
    const sentence = whatIf.locator('[data-wi="sentence"]');
    const was = { head: await headScore.textContent(), hypothetical: await hypothetical.textContent(), sentence: await sentence.textContent() };
    assert.equal(await hypothetical.getAttribute('data-same'), '', 'the hypothetical starts as "same"');

    // The best a measure can read (lower is better) is its input's minimum: a hospital CMS cut scores lower with it.
    // Setting a measure already at its floor changes nothing, so the first one above it is the one to set.
    const inputs = whatIf.getByRole('spinbutton');
    const readings = await inputs.evaluateAll((els) => els.map((el) => ({ value: el.value, min: el.min })));
    const at = readings.findIndex(({ value, min }) => value !== '' && min !== '' && Number(value) > Number(min));
    assert.ok(at !== -1, `the hospital has a measure above its floor to lower (none of its ${readings.length} inputs is)`);
    await inputs.nth(at).fill(readings[at].min);
    await eventually(async () => (await hypothetical.textContent()) !== was.hypothetical, 'the hypothetical score did not change');
    assert.equal(await hypothetical.getAttribute('data-same'), null, 'the hypothetical no longer reads "same"');
    const score = Number.parseFloat((await hypothetical.textContent()).replace('−', '-'));
    assert.ok(score < CUT.hospital.total, 'the score fell');
    assert.ok((await headScore.textContent()) !== was.head, 'the head figure moved');
    // The live sentence follows once the reader stops (SETTLE_MS).
    await eventually(async () => (await sentence.textContent()) !== was.sentence, 'the live sentence did not change');
    await assertQuiet(seen, 'what-if');
  }));
});

// A focused element's part in the walk, and whether it sits under the top bar. In the page: the skip link, the top
// bar's search (or, on a phone, the button that opens it), the theme toggle, a nav item (by position) or the footer's
// feedback link; its rect against the bar's.
// The skip link is left out of the rect check: it is placed over the top of the page on purpose, above the bar. The
// browser scrolls to a whole device pixel, so an element focused at the bar's edge can land a fraction of a pixel under
// it (an svg at 99.8 px under a bar ending at 100): only an overlap over SNAP counts. An element is described by its
// tag, id and first class and the number of words it reads, never its text or address (a link can be a hospital's).
async function focusFacts([feedbackLink, snap]) {
  // A frame for the page to finish moving what was focused, as a reader's eye would wait: the top bar's correction
  // (web/client/topbar.js) is queued in a frame during the key press, so it runs before this one.
  await new Promise((resolve) => requestAnimationFrame(resolve));
  const el = document.activeElement;
  const bar = document.querySelector('.topbar');
  const roleOf = () => {
    if (el.matches('.skip')) return 'skip';
    // On a phone the bar's search is behind the find button, which is a reader's way in: it stands for the search there.
    if (bar?.contains(el) && el.matches('[role="combobox"], .fam__find')) return 'search';
    if (el.matches('.theme-toggle')) return 'theme';
    const nav = [...document.querySelectorAll('.nav a')].indexOf(el);
    if (nav >= 0) return `nav ${nav}`;
    if (el.matches(feedbackLink)) return 'feedback';
    return null;
  };
  const role = roleOf();
  const box = el.getBoundingClientRect();
  const barBox = bar?.getBoundingClientRect();
  const under = Boolean(barBox) && role !== 'skip' && !bar.contains(el) && box.width * box.height > 0
    && box.top < barBox.bottom - snap && box.bottom > barBox.top && box.left < barBox.right && box.right > barBox.left;
  const words = (el.getAttribute('aria-label') || el.textContent || '').trim().split(/\s+/).filter(Boolean).length;
  return { role, under, desc: `<${el.localName}${el.id ? `#${el.id}` : ''}${el.className && typeof el.className === 'string' ? `.${el.className.split(/\s+/)[0]}` : ''}> (${words} words)`, box: [box.top, box.bottom].map(Math.round), bar: barBox && [barBox.top, barBox.bottom].map(Math.round) };
}

// The keys that move focus forward and back. Safari's engine, on macOS, tabs only through form controls unless Option is
// held (its "Press Tab to highlight each item" setting is off), so a walk there holds it.
const keys = () => (shared.browser.browserType().name() === 'webkit' && process.platform === 'darwin'
  ? { next: 'Alt+Tab', back: 'Alt+Shift+Tab' }
  : { next: 'Tab', back: 'Shift+Tab' });

// Presses `key` until `done(steps)` says so, at most MAX_PRESSES times; each step is the focused element's facts.
async function walk(page, key, done) {
  const steps = [];
  for (let i = 0; i < MAX_PRESSES; i++) {
    await page.keyboard.press(key);
    steps.push(await page.evaluate(focusFacts, [FEEDBACK_LINK, SNAP]));
    if (done(steps)) break;
  }
  return steps;
}

// Tabs forward from the top of the page at path, then back from the footer: every control the page offers is reached
// and none is focused under the top bar.
async function keyboardWalk(page, path) {
  // What the page offers, so a control a page lacks is a failure and not a skipped target. The theme toggle and the
  // search appear when the page's scripts have run. Every page's bar has a search (a program's, or the family's on the
  // hub's pages); a program page also has its section menu.
  const hasNav = path.startsWith(PROGRAM_PATH);
  const offered = await page.evaluate((feedbackLink) => ({
    // Two in the markup (the bar's and the footer's); the CSS shows one at any width.
    theme: [...document.querySelectorAll('.theme-toggle')].filter((b) => b.checkVisibility()).length,
    search: [...document.querySelectorAll('.topbar [role="combobox"]')].filter((b) => !b.closest('[hidden]')).length,
    nav: document.querySelectorAll('.nav a').length,
    feedback: document.querySelectorAll(feedbackLink).length,
  }), FEEDBACK_LINK);
  assert.equal(offered.theme, 1, 'one theme toggle');
  assert.equal(offered.feedback, 1, 'one feedback link in the footer');
  assert.equal(offered.search, 1, 'the top bar\'s search');
  if (hasNav) assert.ok(offered.nav > 0, 'the top bar\'s nav');
  const wanted = ['theme', 'feedback', 'search', ...(hasNav ? Array.from({ length: offered.nav }, (_, i) => `nav ${i}`) : [])];
  const reached = (steps) => wanted.every((role) => steps.some((s) => s.role === role));
  const last = (steps) => steps.at(-1)?.desc;

  // Forward from the top: the first stop is the skip link, then each control is reached.
  const forward = await walk(page, keys().next, reached);
  assert.equal(forward[0].role, 'skip', `the first Tab stop is the skip link, not ${forward[0].desc}`);
  const missed = wanted.filter((role) => !forward.some((s) => s.role === role));
  assert.deepEqual(missed, [], `Tab never reached ${missed.join(', ')} in ${forward.length} presses; the last focus was ${last(forward)}`);

  // And back up from the footer: a focus that moves up lands at the top edge, where the bar is.
  const backward = await walk(page, keys().back, (steps) => steps.at(-1).role === 'skip');
  assert.equal(backward.at(-1).role, 'skip', `Shift+Tab never came back to the skip link in ${backward.length} presses; the last focus was ${last(backward)}`);

  const hidden = [...forward, ...backward].filter((s) => s.under).map((s) => `${s.desc} at ${s.box} under the bar at ${s.bar}`);
  assert.deepEqual([...new Set(hidden)], [], 'focused elements under the top bar');
}

describe('keyboard', { concurrency: CONCURRENCY }, () => {
  for (const width of WIDTHS) {
    describe(`${width} px wide`, { concurrency: CONCURRENCY }, () => {
      const tabs = useContext(shared, { width });
      for (const { name, path } of PAGES) it(name, () => withPage(tabs, { path }, (page) => keyboardWalk(page, path)));
    });
  }
});

// The hospital table's name filter on the program page, its top half under the top bar and its bottom half below it
// (the table shows once its section nears the screen): { field, at }, at being { scrollY, top, edge, x, y }: the field's
// top and the bar's bottom edge, and the middle of the half that shows.
async function fieldUnderBar(page) {
  const field = page.locator('#ht-name');
  await page.locator('#hospitals').scrollIntoViewIfNeeded();
  await field.waitFor();
  await page.waitForLoadState('networkidle');
  await field.evaluate((el) => {
    const box = el.getBoundingClientRect();
    window.scrollBy(0, box.top - (document.querySelector('.topbar').getBoundingClientRect().bottom - box.height / 2));
  });
  await settle(page);
  const at = await field.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const edge = document.querySelector('.topbar').getBoundingClientRect().bottom;
    return { scrollY: window.scrollY, top: box.top, edge, x: box.left + box.width / 2, y: (edge + box.bottom) / 2 };
  });
  assert.ok(at.top < at.edge && at.y > at.edge, 'the field sits partly under the bar');
  return { field, at };
}

// A click is not a keyboard focus: the top bar's correction (web/client/topbar.js) leaves the page where the reader
// pointed. A text field matches :focus-visible on a click too, so the bar tells the two apart by the press before it.
// The press marks only the focus it gives: a later focus with no key pressed (a screen reader's cursor, switch access,
// a script) is corrected as a keyboard's is.
describe('the top bar', () => {
  const tabs = useContext(shared);

  it('a click on the visible half of a text field partly under it does not scroll the page', () => withPage(tabs, { path: PROGRAM_PATH, watched: true }, async (page, { seen }) => {
    const { at } = await fieldUnderBar(page);
    await page.mouse.click(at.x, at.y);
    await settle(page);
    const after = await page.evaluate(() => ({ scrollY: window.scrollY, focused: document.activeElement?.id ?? null }));
    assert.equal(after.focused, 'ht-name', 'the click focused the field');
    assert.equal(after.scrollY, at.scrollY, 'the page did not scroll');
    await assertQuiet(seen, 'top bar');
  }));

  it('after a click that focuses nothing, a text field a script focuses under it is still brought clear', () => withPage(tabs, { path: PROGRAM_PATH, watched: true }, async (page, { seen }) => {
    const { field, at } = await fieldUnderBar(page);
    // A click on the page's margin, at the window's bottom left: nothing there takes focus.
    await page.mouse.click(1, page.viewportSize().height - 1);
    await settle(page);
    assert.deepEqual(await page.evaluate(() => ({ scrollY: window.scrollY, body: document.activeElement === document.body })), { scrollY: at.scrollY, body: true }, 'the click focused nothing and scrolled nothing');
    await field.evaluate((el) => el.focus());
    await settle(page);
    const now = await field.evaluate((el) => ({ top: el.getBoundingClientRect().top, edge: document.querySelector('.topbar').getBoundingClientRect().bottom, focused: document.activeElement === el }));
    assert.ok(now.focused, 'the script focused the field');
    assert.ok(now.top >= now.edge - SNAP, `the field is brought clear of the bar (its top at ${Math.round(now.top)} px, the bar's edge at ${Math.round(now.edge)} px)`);
    await assertQuiet(seen, 'top bar');
  }));

  it('after a press with no click (a middle button\'s), a text field a script focuses under it is still brought clear', () => withPage(tabs, { path: PROGRAM_PATH, watched: true }, async (page, { seen }) => {
    const { field } = await fieldUnderBar(page);
    await page.mouse.click(1, page.viewportSize().height - 1, { button: 'middle' });
    // The release clears the press's mark RELEASE_MS later; the slack covers a busy machine's late timer.
    await page.waitForTimeout(RELEASE_MS + 1_000);
    await field.evaluate((el) => el.focus());
    await settle(page);
    const now = await field.evaluate((el) => ({ top: el.getBoundingClientRect().top, edge: document.querySelector('.topbar').getBoundingClientRect().bottom, focused: document.activeElement === el }));
    assert.ok(now.focused, 'the script focused the field');
    assert.ok(now.top >= now.edge - SNAP, `the field is brought clear of the bar (its top at ${Math.round(now.top)} px, the bar's edge at ${Math.round(now.edge)} px)`);
    await assertQuiet(seen, 'top bar');
  }));
});

describe('without JavaScript', { concurrency: CONCURRENCY }, () => {
  const withJs = useContext(shared);
  const withoutJs = useContext(shared, { javaScript: false });

  // The page's visible text, one entry per line, and what its footer, theme toggle, the bar's search and the front page's
  // story show. No watcher: watch needs scripts.
  const linesOf = (text) => text.split('\n').map((line) => line.trim()).filter(Boolean);
  // What the story on the front page shows only with scripts: the search in its last step and the example card's hint
  // that points at it (it shows with the search). Read first, then left out of the page's lines.
  const STORY_ONLY = 'main form.omni, main .card__hint';
  const look = (tabs, path) => withPage(tabs, { path }, async (page) => ({
    story: linesOf(await page.evaluate((sel) => [...document.querySelectorAll(sel)].filter((el) => el.checkVisibility()).map((el) => el.innerText).join('\n'), STORY_ONLY)),
    lines: linesOf(await page.evaluate((sel) => {
      for (const el of document.querySelectorAll(sel)) el.style.display = 'none';
      return document.body.innerText;
    }, STORY_ONLY)),
    footer: await page.locator('footer').isVisible(),
    feedback: await page.locator(FEEDBACK_LINK).count(),
    toggle: await page.evaluate(() => document.querySelector('.theme-toggle')?.innerText ?? null),
    // A hidden element's innerText is all its text, so a search that does not show has none.
    search: linesOf(await page.evaluate(() => {
      const form = document.querySelector('.topbar form.omni');
      return form?.checkVisibility() ? form.innerText : '';
    })),
  }));

  for (const { type, name, path } of PAGES) {
    it(name, async () => {
      const off = await look(withoutJs, path);
      assert.equal(off.footer, true, 'the footer shows');
      assert.equal(off.feedback, 1, 'the footer\'s feedback link shows');

      // The hub's own pages lose no words without scripts. What scripts add is the theme toggle, the bar's search (its
      // words, and the list it shows once a reader types) and, on the front page, the story's search and the hint that
      // points at it, which are hidden in the markup because they do nothing without them (the Readmissions page's own search is
      // the same hidden box).
      if (['hub', 'policy', 'coming', 'not-found', 'hrrp'].includes(type) || type.startsWith('hrrp-hospital')) {
        const on = await look(withJs, path);
        assert.ok(on.toggle, 'the theme toggle shows with scripts');
        assert.ok(on.search.length > 0, 'the bar\'s search shows with scripts');
        assert.deepEqual(off.search, [], 'and not without');
        assert.equal(on.story.length > 0, path === '/' || type === 'hrrp', 'the story\'s search shows with scripts on the front page and the Readmissions page only');
        assert.deepEqual(off.story, [], 'and not without');
        const added = new Set([on.toggle, ...on.search]);
        const offLines = new Set(off.lines);
        const lost = on.lines.filter((line) => !added.has(line) && !offLines.has(line));
        assert.deepEqual(lost, [], 'text that shows with scripts and not without');
      }
    });
  }

  // A hospital's page across the programs without scripts: its record, the net, each program's dollars and the headline
  // show, and nothing the script fills shows as an empty frame (the swarm's frame, its caption, the load error, the
  // toggle and the what-if's buttons). The variant (Maryland's) shows its record and status.
  for (const { type, name, path } of PAGES.filter((p) => p.type.startsWith('hub-hospital'))) {
    it(`${name}: the server's page is whole without scripts`, () => withPage(withoutJs, { path }, async (page) => {
      const shown = (selector) => page.evaluate((s) => [...document.querySelectorAll(s)].map((el) => el.checkVisibility()), selector);
      assert.deepEqual(await shown('main h1'), [true], 'the record\'s name');
      if (type === 'hub-hospital-maryland') {
        assert.deepEqual(await shown('.hh__status'), [true], 'the status');
        assert.deepEqual(await shown('[data-swarm], #whatif, [data-peers]'), [], 'no swarm, what-if or peer row');
        return;
      }
      for (const selector of ['.hh__big', '[data-headline]', '[data-result]']) assert.deepEqual(await shown(selector), [true], `${selector} shows`);
      assert.deepEqual(await shown('.hh__sr'), [true, true, true, true], 'each program\'s dollars and the net');
      for (const selector of ['[data-swarm]', '[data-swarm-note]', '[data-load-error]', '[data-peers] button', '[data-match]', '[data-reset]', '[data-strip]'])
        assert.ok((await shown(selector)).every((v) => v === false), `${selector} does not show`);
    }));
  }
});
