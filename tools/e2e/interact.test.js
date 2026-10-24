// What a reader does on the pages, in a real browser: the hospital search finds a hospital and opens its page, the
// what-if recomputes when a measure changes, the keyboard reaches every control without a focused element sliding under
// the sticky top bar, no page carries the maintenance banner, and with JavaScript off every page keeps its footer
// (and the hub's pages lose nothing). Runs against dist/ (make build) or any URL (E2E_BASE_URL); see lib.js.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalize } from '../../web/client/search.js';
import { COPY } from '../../web/copy.js';
import { SITE } from '../../web/site.js';
import { hospitalAt, launch, newPage, samplePages, startSite, watch } from './lib.js';

const PAGES = samplePages();
const HACRP = SITE.sites.hacrp.path;
const pathOf = (type) => PAGES.find((p) => p.type === type).path;
// 1280 px, the narrowest width the top bar sticks (641), and the narrowest phone width, where it scrolls away.
const WIDTHS = [1280, 641, 320];
const HEIGHT = 800;
// Pixels a focused element may sit under the top bar's edge before it counts as under it (see focusFacts).
const SNAP = 1;
// The floor on a walk's cap of Tab presses: a page with few tab stops still gets this many (the cap is twice the page's
// stops or this, whichever is more; the longest page needs a little over half of the floor).
const PRESS_CAP_FLOOR = 400;

let site;
let browser;
before(async () => {
  site = await startSite();
  browser = await launch();
});
after(async () => {
  await browser?.close();
  await site?.close();
});

// Runs fn(page) in a fresh tab of the context (in the light scheme; a check that wants the watcher calls watch before
// its first goto) and closes the tab. Returns what fn returns.
async function inTab(context, fn) {
  let page;
  try {
    page = await newPage(context, 'light', site.base);
    return await fn(page);
  } finally {
    await page?.close();
  }
}

// A page the way a reader meets it: loaded, and quiet (its scripts have fetched what they fetch).
async function open(page, path) {
  await page.goto(new URL(path, site.base).href, { waitUntil: 'load' });
  await page.waitForLoadState('networkidle');
}

// Calls fn until it returns something truthy, for up to `timeout` ms; its last answer goes in the failure.
async function eventually(fn, what, timeout = 5000) {
  const end = Date.now() + timeout;
  let last;
  while (Date.now() < end) {
    last = await fn();
    if (last) return last;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail(`${what} (last seen: ${JSON.stringify(last)})`);
}

const quiet = (seen, what) => {
  assert.deepEqual(seen.errors, [], `${what}: console and page errors`);
  assert.deepEqual(seen.cspViolations, [], `${what}: CSP violations`);
  assert.deepEqual(seen.foreignRequests, [], `${what}: requests to another origin`);
};

describe('search', () => {
  let context;
  before(async () => {
    context = await browser.newContext({ viewport: { width: 1280, height: HEIGHT } });
  });
  after(() => context?.close());

  // The program page holds two boxes over one index: the top bar's and the larger one in its hero.
  for (const [where, container] of [['the top bar', '.topbar'], ['the hero', 'main']]) {
    it(`${where}: the hospital's name, typed word by word, lists it, and Enter opens its page`, async () => {
      const { path } = PAGES.find((p) => p.type === 'hospital-cut');
      const { name, state } = hospitalAt(path);
      const words = name.split(/\s+/);
      await inTab(context, async (page) => {
        const seen = await watch(page, site.base);
        await open(page, HACRP);
        const box = page.locator(container).getByRole('search').getByRole('combobox');
        const list = page.locator(container).getByRole('search').getByRole('option');
        // The list shows names in display case (the data holds them as CMS prints them), each with its city and state
        // beneath. It lists at most ten, so a name that opens with a common word needs more of its words to be listed:
        // the query grows by one until the hospital is among them. The hospital is the option with its name and its state.
        const options = () => list.evaluateAll((items) => items.map((li) => ({ label: li.querySelector('.omni__t')?.textContent ?? '', sub: li.querySelector('.omni__s')?.textContent ?? '' })));
        const find = async () => (await options()).findIndex((o) => normalize(o.label) === normalize(name) && o.sub.includes(`, ${state}`));
        let at = -1;
        let tried = '';
        for (const [i, word] of words.entries()) {
          await box.pressSequentially(i === 0 ? word : ` ${word}`);
          tried = words.slice(0, i + 1).join(' ');
          // The index loads on first focus: the list is up once it has, and a later word repaints it at once.
          await eventually(async () => (await box.getAttribute('aria-expanded')) === 'true', `the list is not up for "${tried}"`);
          at = await find();
          if (at >= 0) break;
        }
        assert.ok(at >= 0, `typing the whole name ("${tried}") does not list the hospital; the list shows ${JSON.stringify(await options())}`);
        // The first match is active; arrow down to the hospital's, as a reader would, then Enter.
        for (let i = 0; i < at; i++) await box.press('ArrowDown');
        assert.equal(await box.getAttribute('aria-activedescendant'), await list.nth(at).getAttribute('id'), 'the hospital\'s option is the active one');
        await box.press('Enter');
        await page.waitForURL(new URL(path, site.base).href, { timeout: 10000 });
        assert.equal(normalize(await page.locator('h1').innerText()), normalize(name), 'the page opened is the hospital\'s');
        quiet(seen, 'search');
      });
    });
  }
});

describe('what-if', () => {
  let context;
  before(async () => {
    context = await browser.newContext({ viewport: { width: 1280, height: HEIGHT } });
  });
  after(() => context?.close());

  it('changing a measure on a hospital CMS cut changes the result', async () => {
    const { path } = PAGES.find((p) => p.type === 'hospital-cut');
    const { total } = hospitalAt(path);
    await inTab(context, async (page) => {
      const seen = await watch(page, site.base);
      await open(page, path);
      const whatIf = page.locator('#whatif');
      const headScore = whatIf.locator('[data-wi="head-score"]');
      const hypothetical = whatIf.locator('[data-wi="score"]');
      const sentence = whatIf.locator('[data-wi="sentence"]');
      const before = { head: await headScore.textContent(), hypothetical: await hypothetical.textContent(), sentence: await sentence.textContent() };
      assert.equal(await hypothetical.getAttribute('data-same'), '', 'the hypothetical starts as "same"');

      // The best a measure can read (lower is better) is its input's minimum: a hospital CMS cut scores lower with it.
      // Setting a measure already at its floor changes nothing, so the first one above it is the one to set.
      const inputs = whatIf.getByRole('spinbutton');
      const readings = await inputs.evaluateAll((els) => els.map((el) => ({ value: el.value, min: el.min })));
      const at = readings.findIndex(({ value, min }) => value !== '' && min !== '' && Number(value) > Number(min));
      assert.notEqual(at, -1, `the hospital has a measure above its floor to lower; the inputs read ${JSON.stringify(readings)}`);
      await inputs.nth(at).fill(readings[at].min);
      await eventually(async () => (await hypothetical.textContent()) !== before.hypothetical, 'the hypothetical score did not change');
      assert.equal(await hypothetical.getAttribute('data-same'), null, 'the hypothetical no longer reads "same"');
      const score = Number.parseFloat((await hypothetical.textContent()).replace('\u2212', '-'));
      assert.ok(score < total, `the score fell from ${total} to ${score}`);
      assert.notEqual(await headScore.textContent(), before.head, 'the head figure moved');
      // The live sentence follows once the reader stops (SETTLE_MS).
      await eventually(async () => (await sentence.textContent()) !== before.sentence, 'the live sentence did not change');
      quiet(seen, 'what-if');
    });
  });
});

// A focused element's part in the walk, and whether it sits under the top bar. In the page: the skip link, the top
// bar's search, the theme toggle, a nav item (by position) or the footer's feedback link; its rect against the bar's.
// The skip link is left out of the rect check: it is placed over the top of the page on purpose, above the bar. The
// browser scrolls to a whole device pixel, so an element focused at the bar's edge can land a fraction of a pixel under
// it (an svg at 99.8 px under a bar ending at 100): only an overlap over SNAP counts.
async function focusFacts([formUrl, snap]) {
  // A frame or two for the page to finish moving what was focused, as a reader's eye would wait.
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const el = document.activeElement;
  const bar = document.querySelector('.topbar');
  const nav = [...document.querySelectorAll('.nav a')].indexOf(el);
  const role = el.matches('.skip') ? 'skip'
    : bar?.contains(el) && el.matches('[role="combobox"]') ? 'search'
      : el.matches('.theme-toggle') ? 'theme'
        : nav >= 0 ? `nav ${nav}`
          : el.closest('footer') && el.matches('a') && el.href.startsWith(formUrl) ? 'feedback'
            : null;
  const box = el.getBoundingClientRect();
  const barBox = bar?.getBoundingClientRect();
  const under = Boolean(barBox) && role !== 'skip' && !bar.contains(el) && box.width * box.height > 0
    && box.top < barBox.bottom - snap && box.bottom > barBox.top && box.left < barBox.right && box.right > barBox.left;
  const text = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('href') || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  return { role, under, desc: `<${el.localName}${el.id ? `#${el.id}` : ''}${el.className && typeof el.className === 'string' ? `.${el.className.split(/\s+/)[0]}` : ''}> "${text}"`, box: [box.top, box.bottom].map(Math.round), bar: barBox && [barBox.top, barBox.bottom].map(Math.round) };
}

// The keys that move focus forward and back. Safari's engine, on macOS, tabs only through form controls unless Option is
// held (its "Press Tab to highlight each item" setting is off), so a walk there holds it.
const keys = () => (browser.browserType().name() === 'webkit' && process.platform === 'darwin'
  ? { next: 'Alt+Tab', back: 'Alt+Shift+Tab' }
  : { next: 'Tab', back: 'Shift+Tab' });

// Presses `key` until `done(step, steps)` says so, at most `bound` times; each step is the focused element's facts.
async function walk(page, key, bound, done) {
  const steps = [];
  for (let i = 0; i < bound; i++) {
    await page.keyboard.press(key);
    const step = await page.evaluate(focusFacts, [SITE.feedback.url, SNAP]);
    steps.push(step);
    if (done(step, steps)) break;
  }
  return steps;
}

describe('keyboard', { concurrency: 4 }, () => {
  for (const width of WIDTHS) {
    describe(`${width} px wide`, { concurrency: 4 }, () => {
      let context;
      before(async () => {
        context = await browser.newContext({ viewport: { width, height: HEIGHT } });
      });
      after(() => context?.close());

      for (const { type, path } of PAGES) {
        it(type === 'policy' ? `policy ${path}` : type, async () => {
          await inTab(context, async (page) => {
            await open(page, path);
            // What the page offers, so a control a page lacks is a failure and not a skipped target. The theme toggle and
            // the search appear when the page's scripts have run. A program page has the top bar: search and the nav.
            const hasTopBar = path.startsWith(HACRP);
            const offered = await page.evaluate((formUrl) => ({
              theme: [...document.querySelectorAll('.theme-toggle')].filter((b) => !b.hidden).length,
              search: [...document.querySelectorAll('.topbar [role="combobox"]')].filter((b) => !b.closest('[hidden]')).length,
              nav: document.querySelectorAll('.nav a').length,
              feedback: [...document.querySelectorAll('footer a')].filter((a) => a.href.startsWith(formUrl)).length,
              // Where a Tab can stop: these, and the scrollable boxes a browser makes focusable, so a walk is bounded by twice as many.
              tabbable: document.querySelectorAll('a[href], button, input, select, textarea, summary, [tabindex]').length,
            }), SITE.feedback.url);
            assert.equal(offered.theme, 1, 'one theme toggle');
            assert.equal(offered.feedback, 1, 'one feedback link in the footer');
            if (hasTopBar) {
              assert.equal(offered.search, 1, 'the top bar\'s search');
              assert.ok(offered.nav > 0, 'the top bar\'s nav');
            }
            const wanted = ['theme', 'feedback', ...(hasTopBar ? ['search', ...Array.from({ length: offered.nav }, (_, i) => `nav ${i}`)] : [])];
            const bound = Math.max(PRESS_CAP_FLOOR, 2 * offered.tabbable);
            const reached = (steps) => wanted.every((role) => steps.some((s) => s.role === role));
            const last = (steps) => steps.at(-1)?.desc;

            // Forward from the top: the first stop is the skip link, then each control is reached.
            const forward = await walk(page, keys().next, bound, (_, steps) => reached(steps));
            assert.equal(forward[0].role, 'skip', `the first Tab stop is the skip link, not ${forward[0].desc}`);
            const missed = wanted.filter((role) => !forward.some((s) => s.role === role));
            assert.deepEqual(missed, [], `Tab never reached ${missed.join(', ')} in ${forward.length} presses (${bound} allowed); the last focus was ${last(forward)}`);

            // And back up from the footer: a focus that moves up lands at the top edge, where the bar is.
            const backward = await walk(page, keys().back, bound, (step) => step.role === 'skip');
            assert.equal(backward.at(-1).role, 'skip', `Shift+Tab never came back to the skip link in ${backward.length} presses (${bound} allowed); the last focus was ${last(backward)}`);

            const hidden = [...forward, ...backward].filter((s) => s.under).map((s) => `${s.desc} at ${s.box} under the bar at ${s.bar}`);
            assert.deepEqual([...new Set(hidden)], [], 'focused elements under the top bar');
          });
        });
      }
    });
  }
});

describe('maintenance banner', { concurrency: 4 }, () => {
  let context;
  before(async () => {
    context = await browser.newContext({ viewport: { width: 1280, height: HEIGHT } });
  });
  after(() => context?.close());

  // Its words up to the release name, which the config supplies.
  const lead = COPY.maintenance.slice(0, COPY.maintenance.indexOf('{release}'));
  it('has words of its own to look for', () => {
    assert.ok(lead.length > 10, `the banner's copy leads up to the release name: ${JSON.stringify(COPY.maintenance)}`);
  });

  for (const { type, path } of PAGES) {
    it(type === 'policy' ? `policy ${path}` : type, async () => {
      await inTab(context, async (page) => {
        await open(page, path);
        assert.equal(await page.locator('.notice').count(), 0, 'no banner element');
        assert.equal((await page.locator('body').innerText()).includes(lead), false, 'no banner words');
      });
    });
  }
});

describe('without JavaScript', { concurrency: 4 }, () => {
  let withJs;
  let withoutJs;
  before(async () => {
    withJs = await browser.newContext({ viewport: { width: 1280, height: HEIGHT } });
    withoutJs = await browser.newContext({ viewport: { width: 1280, height: HEIGHT }, javaScriptEnabled: false });
  });
  after(async () => {
    await withJs?.close();
    await withoutJs?.close();
  });

  // The page's visible text, one entry per line, and what its footer and theme toggle show. No watcher: watch needs scripts.
  async function look(context, path) {
    const page = await context.newPage();
    try {
      await open(page, path);
      const lines = (await page.locator('body').innerText()).split('\n').map((line) => line.trim()).filter(Boolean);
      const feedback = await page.locator('footer a').evaluateAll((links, url) => links.filter((a) => a.href.startsWith(url)).length, SITE.feedback.url);
      const toggle = await page.evaluate(() => document.querySelector('.theme-toggle')?.innerText ?? null);
      return { lines, footer: await page.locator('footer').isVisible(), feedback, toggle };
    } finally {
      await page.close();
    }
  }

  for (const { type, path } of PAGES) {
    it(type === 'policy' ? `policy ${path}` : type, async () => {
      const off = await look(withoutJs, path);
      assert.equal(off.footer, true, 'the footer shows');
      assert.equal(off.feedback, 1, 'the footer\'s feedback link shows');

      // The hub's own pages are plain text: reading them without scripts loses nothing. The one thing scripts add is
      // the theme toggle, which is hidden in the markup because it does nothing without them.
      if (['hub', 'policy', 'not-found'].includes(type)) {
        const on = await look(withJs, path);
        assert.ok(on.toggle, 'the theme toggle shows with scripts');
        const offLines = new Set(off.lines);
        const lost = on.lines.filter((line) => line !== on.toggle && !offLines.has(line));
        assert.deepEqual(lost, [], 'text that shows with scripts and not without');
      }
    });
  }
});
