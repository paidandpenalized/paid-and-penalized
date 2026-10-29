// The home page's story, live (hub/client/home.js), in a real browser: on a phone and on a desktop, with reduced motion
// each step shows its end state at once (the chart drawn, the right drawing behind it, the rail or the step's name
// marking it), nothing scrolls sideways, and nothing goes wrong on the page; without the story's data the page stays as
// the server wrote it; below it, the directory's slips fit their rows. Runs against dist/ (make build) or any URL
// (E2E_BASE_URL); see site.js.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { audit } from './axe.js';
import { CONCURRENCY, SCHEMES, assertNoSideways, assertQuiet, settle, useBrowser, useContext, visit, withPage } from './lib.js';

const shared = useBrowser();
// The story drawn (its script has laid out the chart and drawn it); the states' readout holding a state's line; the front
// page's own script, which some tests hold back.
const drawn = (page) => page.waitForFunction(() => document.querySelector('.story')?.classList.contains('story--drawn'));
const lined = (page) => page.waitForFunction(() => document.querySelector('.readout')?.classList.contains('is-line'));
const HOME_SCRIPT = /\/assets\/hub-home\.[^/]+\.js$/;

// The story's state after the reader has scrolled step i to where it is read: the step the page marks, the current
// rail link or step name, the two drawings' opacities, whether the canvas has paint on it, and the sideways overflow.
async function readStep(page, i) {
  await page.evaluate((k) => {
    const el = document.querySelectorAll('.story .step')[k];
    const phone = window.innerWidth <= 760;
    const head = document.querySelector('.topbar').getBoundingClientRect().height;
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - (phone ? head - 44 : window.innerHeight * 0.1));
  }, i);
  await settle(page);
  await settle(page);
  return page.evaluate(() => {
    const story = document.querySelector('.story');
    const canvas = story.querySelector('.stage__cv');
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let painted = 0;
    for (let p = 3; p < pixels.length; p += 4) if (pixels[p] > 0) painted += 1;
    const opacity = (sel) => Number(getComputedStyle(story.querySelector(sel)).opacity);
    const wide = window.innerWidth >= 1080;
    const marked = wide ? [...story.querySelectorAll('.rail a')].findIndex((a) => a.getAttribute('aria-current') === 'step')
      : [...story.querySelectorAll('.nowstep li')].findIndex((li) => li.classList.contains('is-now') && li.offsetParent !== null);
    return {
      step: Number(story.dataset.step), marked, painted, bar: opacity('.stage__panel--bar'), map: opacity('.stage__panel--map'),
      sideways: document.documentElement.scrollWidth - window.innerWidth,
    };
  });
}

// A 1x screen zoomed out to 50% (devicePixelRatio 0.5): the story lays out as at 1x and runs every step without error.
describe('the story zoomed out to 50%', () => {
  it('every step draws, nothing throws', async () => {
    const context = await shared.browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 0.5, reducedMotion: 'reduce' });
    try {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await visit(page, shared.site.base, '/');
      await drawn(page);
      assert.equal(await page.evaluate(() => window.devicePixelRatio), 0.5);
      for (let i = 0; i < 9; i++) {
        const s = await readStep(page, i);
        assert.equal(s.step, i);
        assert.ok(s.painted > 1000, `step ${i}: the canvas holds the dots`);
      }
      assert.deepEqual(errors, []);
    } finally {
      await context.close();
    }
  });
});

for (const width of [320, 390, 1280]) {
  describe(`the story at ${width} px`, { concurrency: CONCURRENCY }, () => {
    const tabs = useContext(shared, { width });

    it('with reduced motion, every step\'s end state at once: its chart drawn on its drawing, the step marked, nothing sideways', () => withPage(tabs, { path: '/', watched: true }, async (page, { seen }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await drawn(page);
      for (let i = 0; i < 9; i++) {
        const s = await readStep(page, i);
        assert.equal(s.step, i, `step ${i} is the one being read`);
        assert.equal(s.marked, i, `step ${i} is marked`);
        assert.ok(s.painted > 1000, `step ${i}: the canvas holds the dots (${s.painted} pixels)`);
        assert.equal(s.bar, i === 0 ? 1 : 0, `step ${i}: the scale bar ${i === 0 ? 'shows' : 'is gone'}`);
        assert.equal(s.map, i === 6 || i === 7 ? 1 : 0, `step ${i}: the map ${i === 6 || i === 7 ? 'shows' : 'is gone'}`);
        assert.ok(s.sideways <= 0, `step ${i}: the page scrolls ${s.sideways} px sideways`);
      }
      await assertQuiet(seen, `the story at ${width} px`);
    }));

    // Mid-scroll, between two steps (the words of both on screen, one being read and one not): every word still meets
    // contrast. Reduced motion, so the colors have finished turning when axe looks.
    for (const scheme of SCHEMES) {
      it(`mid-scroll between two steps, ${scheme}: axe finds nothing`, () => withPage(tabs, { path: '/', scheme }, async (page) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await drawn(page);
        await page.evaluate(() => {
          const [a, b] = [...document.querySelectorAll('.story .step')].slice(2, 4);
          const top = (el) => el.getBoundingClientRect().top + window.scrollY;
          window.scrollTo(0, (top(a) + top(b)) / 2);
        });
        await settle(page);
        await settle(page);
        const shown = await page.evaluate(() => [...document.querySelectorAll('.story .step__in')].filter((el) => {
          const r = el.getBoundingClientRect();
          return r.bottom > 0 && r.top < window.innerHeight;
        }).length);
        assert.ok(shown >= 2, `two steps' words on screen (${shown})`);
        await audit(page, `the story mid-scroll at ${width} px, ${scheme}`);
      }));
    }

    it('without its data the page stays as the server wrote it: both drawings, no canvas, no live layout', () => withPage(tabs, { path: '/about/' }, async (page) => {
      await page.route('**/assets/hub-hospitals.*.json', (route) => route.fulfill({ status: 503, body: '' }));
      await visit(page, tabs.base, '/');
      await settle(page);
      const s = await page.evaluate(() => {
        const story = document.querySelector('.story');
        return {
          live: story.classList.contains('story--live'), canvas: story.querySelector('.stage__cv').hidden,
          bar: getComputedStyle(story.querySelector('.stage__panel--bar')).opacity, map: getComputedStyle(story.querySelector('.stage__panel--map')).opacity,
          faded: story.querySelectorAll('.step.is-current').length,
        };
      });
      assert.deepEqual(s, { live: false, canvas: true, bar: '1', map: '1', faded: 0 });
    }));
  });
}

// Phones of every height: each step's words fit the window between the header and the pinned chart, so none scrolls
// behind the chart (the chart's share and the words' size follow the window's height on short phones), and By state
// keeps its parts apart: the step's name, then the readout (as tall as its longest line, so the map never moves under
// the dots when a long line shows), then the map and its key, all inside the chart.
for (const [width, height] of [[320, 640], [375, 667], [390, 844], [414, 896]]) {
  describe(`the phone story at ${width}×${height}`, () => {
    const tabs = useContext(shared, { width, height });
    it('every step\'s words fit above the chart, and By state\'s parts stand apart inside it', () => withPage(tabs, { path: '/', watched: true }, async (page, { seen }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await drawn(page);
      const fit = await page.evaluate(() => {
        const head = document.querySelector('.topbar').getBoundingClientRect().bottom;
        const stage = document.querySelector('.stage').getBoundingClientRect().height;
        const room = window.innerHeight - stage - head - 24;
        return [...document.querySelectorAll('.story > .step')].slice(1, 8).map((s) => ({
          id: s.id, tall: s.classList.contains('step--tall'), words: Math.round(s.querySelector('.step__in').getBoundingClientRect().height), room: Math.round(room),
        }));
      });
      for (const f of fit) assert.ok(!f.tall && f.words <= f.room, `${f.id}: ${f.words} px of words in ${f.room} px`);
      await readStep(page, 7);
      const box = (sel) => page.evaluate((q) => { const r = document.querySelector(q).getBoundingClientRect(); return { top: r.top, bottom: r.bottom, height: r.height }; }, sel);
      const parts = async () => ({ stage: await box('.stage'), name: await box('.nowstep li.is-now'), readout: await box('.readout'), map: await box('.smap'), foot: await box('.mapfoot') });
      const p = await parts();
      assert.ok(p.name.bottom <= p.readout.top + 0.5, 'the step\'s name above the readout');
      assert.ok(p.readout.top >= p.stage.top && p.readout.bottom <= p.map.top + 0.5, 'the readout inside the chart, above the map');
      assert.ok(p.map.bottom <= p.foot.top + 0.5 && p.foot.bottom <= p.stage.bottom + 0.5, 'the map, then its key, inside the chart');
      assert.ok(p.map.height >= 60, `a map ${Math.round(p.map.height)} px tall`);
      // The longest line the readout can show (Maryland's) leaves the map where it was.
      await page.locator('.smalls [data-st="MD"]').focus();
      await settle(page);
      assert.match(await page.locator('.readout').textContent(), /^Maryland: not in these programs/);
      const q = await parts();
      assert.deepEqual([q.readout.height, q.map.top, q.map.height], [p.readout.height, p.map.top, p.map.height], 'the readout keeps its height; the map stays put');
      await assertQuiet(seen, `the phone story at ${width}×${height}`);
    }));
  });
}

// The last two steps answer to the reader: an address's #state= (either case) scrolls to the states and pins that one in
// the readout, a junk one does nothing; the last step's search follows a hospital in place (the page stays, the card and
// the 'hub:select' event name it, the worksheet below fills in for it), and a hospital without a teaching status has that
// peer toggle disabled with the hospital page's note.
describe('states you can read, and Find yours', () => {
  const tabs = useContext(shared);

  it('#state= pins a state on the map; a junk one is ignored', () => withPage(tabs, { path: '/#state=oh', watched: true }, async (page, { seen }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await lined(page);
    await settle(page);
    const s = await page.evaluate(() => ({
      step: document.querySelector('.story').dataset.step, line: document.querySelector('.readout').textContent,
      pinned: [...document.querySelectorAll('.smap .is-pin')].map((el) => el.dataset.st),
      focusable: [...document.querySelectorAll('.smap .st')].every((el) => el.getAttribute('role') === 'button' && el.tabIndex === 0),
    }));
    assert.equal(s.step, '7');
    assert.match(s.line, /^Ohio: [\d,]+ hospitals, net [−+]?\d\.\d\d% of pay, \d+% take a net cut$/);
    assert.deepEqual(s.pinned, ['OH']);
    assert.ok(s.focusable, 'the states are buttons in the tab order on step 7');
    await visit(page, tabs.base, '/about/');
    await visit(page, tabs.base, '/#state=%3Cimg%20src=x%3E');
    await drawn(page);
    assert.equal(await page.evaluate(() => document.querySelectorAll('.smap .is-pin, img[src="x"]').length), 0, 'nothing pinned, no markup');
    await assertQuiet(seen, 'state fragment');
  }));

  it('the last step\'s search follows a hospital in place, with its card, its event and its peer toggles', () => withPage(tabs, { path: '/', watched: true }, async (page, { seen }) => {
    await drawn(page);
    // A hospital with an estimate and no teaching status, from the page's own asset.
    const ccn = await page.evaluate(async () => {
      const { cols, rows } = await (await fetch(document.querySelector('form#find').dataset.src)).json();
      const at = (c) => cols.indexOf(c);
      return rows.find((r) => r[at('status')] === 'e' && r[at('teach')] === null)[at('ccn')];
    });
    await page.evaluate(() => document.addEventListener('hub:select', (e) => { window.selected = e.detail.ccn; }));
    // The reader groups the example by teaching status first.
    await page.locator('#step-find').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector('.story').dataset.step === '8');
    await page.locator('.peers [data-peer="teach"]').click();
    const box = page.locator('main form#find').getByRole('combobox');
    await box.pressSequentially(ccn.toLowerCase());
    await page.locator('main form#find [role="option"]').first().waitFor();
    await box.press('Enter');
    await page.waitForFunction((c) => document.querySelector('[data-card]').dataset.ccn === c, ccn);
    assert.equal(await box.inputValue(), await page.locator('.card__nm').textContent(), 'the box names the hospital followed, not what was typed');
    const s = await page.evaluate(() => ({
      path: window.location.pathname, selected: window.selected, step: document.querySelector('.story').dataset.step,
      teach: document.querySelector('.peers [data-peer="teach"]').getAttribute('aria-disabled'),
      why: document.querySelector('#peers-no-teach').checkVisibility(), example: document.querySelector('.card__ex').hidden,
    }));
    assert.deepEqual(s, { path: '/', selected: ccn, step: '8', teach: 'true', why: true, example: true });
    // Shown by state (it has no teaching group), "Same state" is still the reader's choice for the next hospital.
    const pressed = () => page.evaluate(() => [...document.querySelectorAll('.peers [data-peer]')].filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.dataset.peer));
    await page.locator('.peers [data-peer="state"]').click();
    const other = await page.evaluate(async () => {
      const { cols, rows } = await (await fetch(document.querySelector('form#find').dataset.src)).json();
      const at = (c) => cols.indexOf(c);
      return rows.find((r) => r[at('status')] === 'e' && r[at('teach')] === 'major')[at('ccn')];
    });
    await box.fill('');
    await box.pressSequentially(other.toLowerCase());
    await page.locator('main form#find [role="option"]').first().waitFor();
    await box.press('Enter');
    await page.waitForFunction((c) => document.querySelector('[data-card]').dataset.ccn === c, other);
    assert.deepEqual(await pressed(), ['state']);
    await page.locator('.peers [data-peer="teach"]').click();
    assert.deepEqual(await pressed(), ['teach']);
    await assertQuiet(seen, 'find yours');
  }));

  // A followed hospital without an estimate (Maryland's all-payer model, or no inputs): the card names it with its status
  // and why, as its page does, and links to that page; it shows no figure, and the chart rings nothing for it.
  it('a ?h= hospital without an estimate is on the card with its status and why, and no figure', () => withPage(tabs, { path: '/', watched: true }, async (page, { seen }) => {
    const picks = await page.evaluate(async () => {
      const { cols, rows } = await (await fetch(document.querySelector('form#find').dataset.src)).json();
      const at = (c) => cols.indexOf(c);
      const of = (status) => rows.find((r) => r[at('status')] === status);
      return [['m', 'Not in these programs', of('m')[at('ccn')], of('m')[at('name')]], ['n', 'No estimate', of('n')[at('ccn')], of('n')[at('name')]]];
    });
    for (const [, status, ccn, name] of picks) {
      await visit(page, tabs.base, `/?h=${ccn}`);
      await page.waitForFunction((c) => document.querySelector('[data-card]').dataset.ccn === c, ccn);
      await page.locator('#step-find').scrollIntoViewIfNeeded();
      await page.waitForFunction(() => document.querySelector('.story').dataset.step === '8');
      await settle(page);
      const c = await page.evaluate(() => {
        const card = document.querySelector('[data-card]');
        const shown = (sel) => card.querySelector(sel).checkVisibility();
        return {
          name: card.querySelector('.card__nm').textContent, status: card.querySelector('.card__pct').textContent,
          why: card.querySelector('.card__netl').textContent, href: card.querySelector('.card__go').getAttribute('href'),
          example: shown('.card__ex'), rows: shown('.card__rows'), peer: shown('.card__peer'), text: card.innerText,
          toggle: document.querySelector('.story .peers').checkVisibility(),
        };
      });
      assert.equal(c.toggle, false, 'no peer toggle: the chart has no dot for it to group');
      assert.equal(c.name, name);
      assert.equal(c.status, status);
      assert.ok(c.why.length > 20, c.why);
      assert.equal(c.href, `/hospital/${ccn.toLowerCase()}/`);
      assert.deepEqual([c.example, c.rows, c.peer], [false, false, false], 'no example lead, no rows, no peers');
      assert.doesNotMatch(c.text, /\$|NaN|undefined|null|Infinity/, 'no figure on the card');
    }
    await assertQuiet(seen, 'a followed hospital without an estimate');
  }));

  // The worksheet in "Methods, in brief" fills in for the hospital the last step finds: its CCN, lines that add up as
  // printed (line 6 = 3 + 4 + 5, the hospital's net), the example's lead gone, the stamp for its sign. A hospital with a
  // net bonus, so the bonus stamp shows, and axe judges its contrast in each scheme.
  for (const scheme of SCHEMES) {
    it(`the worksheet fills in for a hospital found with a net bonus, ${scheme}`, () => withPage(tabs, { path: '/', scheme, watched: true }, async (page, { seen }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await drawn(page);
      const found = await page.evaluate(async () => {
        const { cols, rows } = await (await fetch(document.querySelector('form#find').dataset.src)).json();
        const at = (c) => cols.indexOf(c);
        const row = rows.find((r) => r[at('status')] === 'e' && r[at('net')] > 0);
        return { ccn: row[at('ccn')], net: row[at('net')] };
      });
      await page.locator('#step-find').scrollIntoViewIfNeeded();
      const box = page.locator('main form#find').getByRole('combobox');
      await box.pressSequentially(found.ccn.toLowerCase());
      await page.locator('main form#find [role="option"]').first().waitFor();
      await box.press('Enter');
      await page.waitForFunction((c) => document.querySelector('[data-worksheet]').dataset.ccn === c, found.ccn);
      await page.locator('[data-worksheet]').scrollIntoViewIfNeeded();
      await settle(page);
      const ws = await page.evaluate(() => {
        const root = document.querySelector('[data-worksheet]');
        const text = (key) => root.querySelector(`[data-ws="${key}"]`).textContent;
        return {
          ccn: text('ccn'), lines: Object.fromEntries(['hrrp', 'hac', 'hvbp', 'net'].map((key) => [key, text(key)])),
          example: root.querySelector('[data-ws-ex]').checkVisibility(),
          stamps: [...root.querySelectorAll('[data-sign]')].filter((el) => el.checkVisibility()).map((el) => [el.dataset.sign, el.textContent]),
        };
      });
      // An amount as printed ("−$1,234", "+$56", "$0"); a program the hospital is not in adds nothing.
      const amount = (t) => (t === 'Not in this program' ? 0 : Number(t.replace('−', '-').replace(/[$,+]/g, '')));
      assert.equal(ws.ccn, found.ccn);
      assert.ok(Object.values(ws.lines).every((t) => t === 'Not in this program' || /^[−+]?\$[\d,]+$/.test(t)), JSON.stringify(ws.lines));
      assert.equal(amount(ws.lines.hrrp) + amount(ws.lines.hac) + amount(ws.lines.hvbp), amount(ws.lines.net), 'line 6 = 3 + 4 + 5');
      assert.equal(amount(ws.lines.net), found.net, 'line 6 is the hospital\'s net');
      assert.equal(ws.example, false, '"An example" is gone');
      assert.deepEqual(ws.stamps, [['bonus', 'Net bonus']]);
      await audit(page, `the worksheet for a hospital with a net bonus, ${scheme}`);
      await assertQuiet(seen, `the worksheet, ${scheme}`);
    }));
  }

  it('a state picked twice in the bar\'s search on the front page goes to it both times', () => withPage(tabs, { path: '/', watched: true }, async (page, { seen }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await drawn(page);
    const box = page.locator('.topbar form#omni').getByRole('combobox');
    for (let i = 0; i < 2; i++) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await settle(page);
      await box.fill('');
      await box.pressSequentially('Ohio');
      await page.locator('.topbar form#omni [role="option"]').filter({ hasText: 'Ohio' }).first().click();
      await page.waitForFunction(() => document.querySelector('.story').dataset.step === '7' && document.querySelector('.readout').textContent.startsWith('Ohio:'));
      assert.equal(new URL(page.url()).hash, '#state=OH', `pick ${i + 1}`);
    }
    await assertQuiet(seen, 'a state picked twice');
  }));
});

// The states as buttons: the picked one is pressed (aria-pressed), the others not, on the map and among the small states'
// buttons, from the moment the map answers; the readout follows the pointer and the focus, but the quiet region a screen
// reader hears speaks only when a state is picked (a focused state's own name already says its line), never as the
// pointer passes over the map or the focus moves.
describe('the states map speaks on a pick, not on a hover', () => {
  const tabs = useContext(shared);
  it('with nothing picked, every state is a toggle that is not pressed, before any pointer or key', () => withPage(tabs, { path: '/', watched: true }, async (page, { seen }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await drawn(page);
    const states = await page.evaluate(() => [...document.querySelectorAll('.smap .st[data-st], .smalls [data-st]')].map((el) => el.getAttribute('aria-pressed')));
    assert.ok(states.length > 50, `${states.length} states`);
    assert.deepEqual([...new Set(states)], ['false'], 'every state carries aria-pressed="false"');
    await assertQuiet(seen, 'the states map at rest');
  }));

  it('hovering or focusing writes the readout only; Enter or a click pins the state, pressed, and is said; a small state\'s button too', () => withPage(tabs, { path: '/#state=oh', watched: true }, async (page, { seen }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await lined(page);
    await settle(page);
    const facts = () => page.evaluate(() => ({
      readout: document.querySelector('.readout').textContent,
      said: document.querySelector('[data-said]').textContent,
      // A small state is pressed on the map and among the buttons alike: each code once.
      pressed: [...new Set([...document.querySelectorAll('.smap .st[data-st], .smalls [data-st]')].filter((el) => el.getAttribute('aria-pressed') === 'true').map((el) => el.dataset.st))],
      unmarked: [...document.querySelectorAll('.smap .st[data-st], .smalls [data-st]')].filter((el) => !['true', 'false'].includes(el.getAttribute('aria-pressed'))).length,
      live: document.querySelector('.readout').getAttribute('aria-live'),
    }));
    const start = await facts();
    assert.deepEqual([start.pressed, start.unmarked, start.live], [['OH'], 0, null], 'Ohio pinned from the address and pressed; every state a toggle; the readout itself is not live');
    const said = start.said;
    // Hover over another state: the readout follows, the region does not speak.
    const texas = page.locator('.smap .st[data-st="TX"]');
    await texas.hover();
    await settle(page);
    const hovered = await facts();
    assert.match(hovered.readout, /^Texas: /);
    assert.equal(hovered.said, said, 'a hover says nothing');
    // Focus on another state: the readout follows, the region does not speak (the state's own name is its line).
    const utah = page.locator('.smap .st[data-st="UT"]');
    await utah.focus();
    await settle(page);
    const focused = await facts();
    assert.match(focused.readout, /^Utah: /);
    assert.equal(focused.said, said, 'a focus says nothing more');
    // Enter pins Utah, a click pins Texas: pressed, and said.
    await page.keyboard.press('Enter');
    await settle(page);
    const entered = await facts();
    assert.deepEqual(entered.pressed, ['UT']);
    assert.match(entered.said, /^Utah: /);
    await texas.click();
    await settle(page);
    const picked = await facts();
    assert.deepEqual(picked.pressed, ['TX']);
    assert.match(picked.said, /^Texas: /);
    // A small state's button: pressed and said on a click.
    await page.locator('.smalls [data-st="RI"]').click();
    await settle(page);
    const small = await facts();
    assert.deepEqual(small.pressed, ['RI']);
    assert.match(small.said, /^Rhode Island: /);
    await assertQuiet(seen, 'the states map');
  }));
});

// On a phone the chart is pinned over the lower part of the window: a keyboard reader who tabs to the last step's search
// and its card's link finds each in view, clear of the chart, and then reaches the peer toggle on the chart.
for (const [width, height] of [[390, 844], [320, 640]]) {
  describe(`Find yours by keyboard at ${width} px`, () => {
    const tabs = useContext(shared, { width, height });

    it('Tab reaches the search and the card\'s link clear of the pinned chart, then the peer toggle', () => withPage(tabs, { path: '/', watched: true }, async (page, { seen }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await drawn(page);
      const reached = [];
      for (let i = 0; i < 80 && !reached.some((f) => f.peer === 'teach'); i++) {
        await page.keyboard.press('Tab');
        await settle(page);
        const f = await page.evaluate(() => {
          const el = document.activeElement;
          const r = el.getBoundingClientRect();
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return { id: el.id || el.className, peer: el.dataset?.peer ?? null, clear: Boolean(hit) && (el.contains(hit) || hit.contains(el)) && !(hit.closest('[data-stage]') && !el.closest('[data-stage]')) };
        });
        if (f.id === 'find-q' || f.id === 'card__go' || f.peer) reached.push(f);
      }
      assert.deepEqual(reached.map((f) => f.id === 'find-q' || f.id === 'card__go' ? f.id : f.peer), ['find-q', 'card__go', 'state', 'size', 'teach']);
      for (const f of reached) assert.ok(f.clear, `${f.id}${f.peer ? ` ${f.peer}` : ''} is in view, not under the chart`);
      await assertQuiet(seen, `Find yours by keyboard at ${width} px`);
    }));
  });
}

// The masthead's trip into the header (hub/client/story/dock.js): near its end the first word sits in the header's
// wordmark slot (the compact P&P mark on a phone), also after the header grows (the phone's search row opens); docked,
// the header's wordmark shows; back at the top it waits hidden, unless it has focus.
for (const width of [390, 1280]) {
  describe(`the masthead's trip at ${width} px`, () => {
    const tabs = useContext(shared, { width });

    it('ends in the header\'s wordmark slot, also after the header changes height; a focused wordmark stays shown', () => withPage(tabs, { path: '/', watched: true }, async (page, { seen }) => {
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.evaluate(() => document.fonts.ready);
      // Scrolls to share p of the trip (the script's own measure) and reads the first word, the slot and the header.
      const at = async (p) => {
        await page.evaluate((share) => {
          const bar = document.querySelector('.fam');
          const strip = document.querySelector('.hero__strip');
          const trip = Math.max(110, Math.min(260, strip.getBoundingClientRect().top + window.scrollY - bar.getBoundingClientRect().bottom - 30));
          window.scrollTo(0, 0);
          window.scrollTo(0, Math.ceil(trip * share));
        }, p);
        await settle(page);
        await settle(page);
        return page.evaluate(() => {
          const head = document.querySelector('.fam a.wordmark');
          const short = head.querySelector('.wordmark__short');
          const slot = (getComputedStyle(short).display === 'none' ? head : short).getBoundingClientRect();
          const word = document.querySelector('.hero__m1').getBoundingClientRect();
          return {
            word: { top: word.top, bottom: word.bottom }, slot: { top: slot.top, bottom: slot.bottom },
            bar: document.querySelector('.fam').getBoundingClientRect().bottom, shown: getComputedStyle(head).visibility,
          };
        });
      };
      const inSlot = (s, what) => {
        assert.ok(s.word.top >= s.slot.top - 4 && s.word.top <= s.slot.bottom, `${what}: the first word's top (${Math.round(s.word.top)} px) is in the slot (${Math.round(s.slot.top)} to ${Math.round(s.slot.bottom)} px)`);
        assert.ok(s.word.bottom <= s.bar, `${what}: the first word ends inside the header`);
      };
      inSlot(await at(0.98), 'near the end');
      const find = page.locator('.fam__find');
      if (await find.isVisible()) {
        const before = (await at(0)).bar;
        await find.click();
        const opened = await at(0.98);
        assert.ok(opened.bar > before, 'the search row makes the header taller');
        inSlot(opened, 'with the search row open');
        await page.keyboard.press('Escape');
      }
      assert.equal(await page.evaluate(() => document.documentElement.classList.contains('dock-ready')), true, 'the script has taken over');
      assert.equal((await at(1.1)).shown, 'visible', 'docked, the header\'s wordmark shows');
      assert.equal((await at(0)).shown, 'hidden', 'at the top it waits hidden');
      await at(1.1);
      await page.focus('.fam a.wordmark');
      assert.equal((await at(0)).shown, 'visible', 'focused, it stays shown at the top');
      await assertQuiet(seen, `the masthead's trip at ${width} px`);
    }));

    // Reduced motion: no trip, but still one wordmark at a time. At the top the masthead's shows and the header's waits
    // hidden (with the tagline); once the masthead has gone under the header, the header's shows at once.
    it('with reduced motion, one wordmark at a time: the masthead\'s at the top, the header\'s once it has scrolled under', () => withPage(tabs, { path: '/', watched: true }, async (page, { seen }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.evaluate(() => document.fonts.ready);
      const at = async (y) => {
        await page.evaluate((top) => window.scrollTo(0, top), y);
        await settle(page);
        await settle(page);
        return page.evaluate(() => {
          const seen = (el) => getComputedStyle(el).visibility === 'visible' && Number(getComputedStyle(el).opacity) > 0.99;
          const tag = document.querySelector('.fam__tag');
          return { head: seen(document.querySelector('.fam a.wordmark')), tag: getComputedStyle(tag).display === 'none' ? null : seen(tag), moved: document.querySelector('.hero__m1').style.transform !== '' };
        });
      };
      const tag = (on) => (width >= 1100 ? on : null);
      assert.equal(await page.evaluate(() => document.documentElement.classList.contains('dock-ready')), true, 'the script has taken over');
      assert.deepEqual(await at(0), { head: false, tag: tag(false), moved: false }, 'at the top: the masthead\'s wordmark only');
      assert.deepEqual(await at(600), { head: true, tag: tag(true), moved: false }, 'scrolled under: the header\'s');
      assert.deepEqual(await at(0), { head: false, tag: tag(false), moved: false }, 'back at the top');
      await at(600);
      await page.focus('.fam a.wordmark');
      assert.equal((await at(0)).head, true, 'focused, it stays shown at the top');
      await assertQuiet(seen, `the masthead with reduced motion at ${width} px`);
    }));
  });
}

// On a phone the story's first screen before its script runs is the one the script sets (the chart pinned under the
// words, the story as tall), so nothing moves when it starts: the rules hub/styles.css copies from the live layout stay
// in step with it.
for (const width of [320, 390]) {
  describe(`the phone story before its script at ${width} px`, () => {
    const tabs = useContext(shared, { width, height: 844 });
    it('lays out the chart, the first step and the story\'s height as the live story does', () => withPage(tabs, { path: '/about/' }, async (page) => {
      const boxes = () => page.evaluate(() => {
        const box = (sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return [r.top, r.height].map((v) => Math.round(v)); };
        return { stage: box('.stage'), bar: box('.sbar'), first: box('#step-scale'), story: box('.story') };
      });
      await page.route(HOME_SCRIPT, (route) => route.abort());
      await visit(page, tabs.base, '/');
      await page.evaluate(() => document.fonts.ready);
      const before = await boxes();
      await page.unroute(HOME_SCRIPT);
      await visit(page, tabs.base, '/');
      await drawn(page);
      await page.evaluate(() => window.scrollTo(0, 0));
      await settle(page);
      assert.deepEqual(before, await boxes(), 'the same boxes before the script and once it has drawn');
    }));
  });
}

// A front page missing a part its scripts need (here the masthead's strip and the stage's canvas, cut from the served page)
// does not stay half taken over: the trip's script hands the header its wordmark back (dock-ready) and the story's
// script marks the story static, so a phone shows the server's layout, not the pinned chart the stylesheet set up.
describe('the front page without a part its scripts need', () => {
  const tabs = useContext(shared, { width: 390 });
  it('shows the header\'s wordmark and the server\'s story layout', () => withPage(tabs, { path: '/about/' }, async (page) => {
    await page.route((url) => url.pathname === '/', async (route) => {
      const response = await route.fetch();
      const body = (await response.text()).replace('class="hero__strip"', 'class="hero__band"').replace(/<canvas class="stage__cv"[^>]*><\/canvas>/, '');
      await route.fulfill({ response, body });
    });
    await visit(page, tabs.base, '/');
    await settle(page);
    const f = await page.evaluate(() => ({
      ready: document.documentElement.classList.contains('dock-ready'),
      head: getComputedStyle(document.querySelector('.fam a.wordmark')).visibility,
      story: [...document.querySelector('.story').classList].filter((c) => c !== 'story').sort(),
      stage: getComputedStyle(document.querySelector('.stage')).display,
    }));
    assert.deepEqual(f, { ready: true, head: 'visible', story: ['story--static'], stage: 'contents' });
  }));
});

// A front page whose story fails after the map and the chart have been set up (here the card's lead is cut from the
// served page, which only the last step's script needs): the story falls back to the server's page and nothing the
// script set up is left running. The states are no buttons, the readout and its live region stay quiet, and a state
// named in the address later pins nothing.
describe('the front page when its story fails part way', () => {
  const tabs = useContext(shared, { width: 1280 });
  it('undoes the map and the chart it had set up', () => withPage(tabs, { path: '/about/' }, async (page) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route((url) => url.pathname === '/', async (route) => {
      const response = await route.fetch();
      const body = (await response.text()).replace('class="card__ex"', 'class="card__lead"');
      await route.fulfill({ response, body });
    });
    await visit(page, tabs.base, '/');
    await page.waitForFunction(() => document.querySelector('.story').classList.contains('story--static'));
    await settle(page);
    const wired = () => page.evaluate(() => ({
      story: [...document.querySelector('.story').classList].filter((c) => c !== 'story').sort(),
      states: [...document.querySelectorAll('.smap .st[data-st]')].filter((el) => el.hasAttribute('role') || el.hasAttribute('tabindex') || el.hasAttribute('aria-pressed')).length,
      buttons: [...document.querySelectorAll('.smalls [data-st]')].filter((el) => el.hasAttribute('aria-pressed')).length,
      pinned: document.querySelectorAll('.smap .is-pin, .smap .is-on, .smalls .is-pin').length,
      said: document.querySelector('[data-said]').textContent,
      readout: document.querySelector('.readout').hidden,
      canvas: document.querySelector('.stage__cv').hidden,
    }));
    const expected = { story: ['story--static'], states: 0, buttons: 0, pinned: 0, said: '', readout: true, canvas: true };
    assert.deepEqual(await wired(), expected, 'nothing set up is left behind');
    await page.evaluate(() => { window.location.hash = '#state=TX'; });
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    await settle(page);
    await settle(page);
    assert.deepEqual(await wired(), expected, 'a state named later pins nothing and says nothing');
    assert.deepEqual(errors, []);
  }));
});

// Before the trip's script runs, or with scripts off, the front page shows one wordmark: the masthead's, with the header's
// (and its tagline, where the bar shows one) hidden from the first paint; once the masthead has scrolled up under the
// header, they show (the browser runs that by scroll; Chrome does). With the script, it takes over and marks the root.
for (const width of [390, 1280]) {
  for (const javaScript of [true, false]) {
    describe(`one wordmark before the trip's script at ${width} px, scripts ${javaScript ? 'on (the script held back)' : 'off'}`, () => {
      const tabs = useContext(shared, { width, javaScript });

      it('at the top only the masthead\'s wordmark shows; scrolled past it, the header\'s does', () => withPage(tabs, { path: '/about/' }, async (page) => {
        // The front page's own script never arrives (the shell's still runs), so the page stays as it was first painted.
        if (javaScript) await page.route(HOME_SCRIPT, (route) => route.abort());
        await page.goto(new URL('/', page.url()).href, { waitUntil: 'load' });
        const shown = async (y) => {
          await page.evaluate((top) => window.scrollTo(0, top), y);
          await page.waitForTimeout(150);
          return page.evaluate(() => {
            const seen = (el) => getComputedStyle(el).visibility === 'visible' && Number(getComputedStyle(el).opacity) > 0.99;
            const tag = document.querySelector('.fam__tag');
            return {
              head: seen(document.querySelector('.fam a.wordmark')), tag: getComputedStyle(tag).display === 'none' ? null : seen(tag),
              hero: seen(document.querySelector('.hero__mark')), ready: document.documentElement.classList.contains('dock-ready'),
            };
          });
        };
        const tag = (on) => (width >= 1100 ? on : null);
        assert.deepEqual(await shown(0), { head: false, tag: tag(false), hero: true, ready: false }, 'at the top: the masthead\'s wordmark only');
        assert.deepEqual(await shown(400), { head: true, tag: tag(true), hero: true, ready: false }, 'past the masthead: the header\'s wordmark shows');
        assert.deepEqual(await shown(0), { head: false, tag: tag(false), hero: true, ready: false }, 'back at the top: hidden again');
      }));
    });
  }
}

// The front page's chart words at every width: the directory's histograms draw their tick labels and counts at a fixed
// size (the site's chart labels: 11 px ticks, 12 px counts; the drawing stretches, the words do not), the states map's
// key draws its scale (each swatch as tall as the scale), its words are in the 12 px of the page's smallest text, and its
// "0%" sits under the middle of its scale.
describe('the front page\'s chart words', () => {
  const tabs = useContext(shared, { width: 1440 });
  it('hold their size from 320 to 1440 px, and the key\'s 0% is centred on its scale', () => withPage(tabs, { path: '/' }, async (page) => {
    for (const width of [320, 390, 800, 1024, 1100, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await settle(page);
      const f = await page.evaluate(() => {
        // A text's drawn size: its font size times its drawing's scale on screen.
        const drawn = (t) => parseFloat(getComputedStyle(t).fontSize) * t.getScreenCTM().a;
        const sizes = (sel) => [...document.querySelectorAll(sel)].map(drawn);
        const box = (el) => el.getBoundingClientRect();
        const scale = box(document.querySelector('.dkey__g'));
        const zero = box(document.querySelector('.dkey__s > :nth-child(2)'));
        return {
          ticks: sizes('.pc__hist .st__tl'), counts: sizes('.pc__hist .st__out'),
          key: parseFloat(getComputedStyle(document.querySelector('.dkey__s')).fontSize),
          swatches: [...document.querySelectorAll('.dkey__g rect.st')].map((r) => Math.round(box(r).height)),
          scaleH: Math.round(scale.height),
          off: (zero.left + zero.width / 2) - (scale.left + scale.width / 2),
        };
      });
      assert.ok(f.ticks.length >= 18 && f.ticks.every((v) => Math.abs(v - 11) < 0.01), `${width} px: tick labels drawn at ${[...new Set(f.ticks.map((v) => v.toFixed(1)))]} px, not 11`);
      assert.ok(f.counts.length >= 6 && f.counts.every((v) => Math.abs(v - 12) < 0.01), `${width} px: counts drawn at ${[...new Set(f.counts.map((v) => v.toFixed(1)))]} px, not 12`);
      assert.ok(f.key >= 12, `${width} px: the key's words are ${f.key} px`);
      assert.ok(f.swatches.length > 1 && f.swatches.every((h) => h === f.scaleH && h > 0), `${width} px: the key's swatches are ${f.swatches} px tall on a ${f.scaleH} px scale`);
      assert.ok(Math.abs(f.off) <= 1, `${width} px: the key's 0% is ${f.off.toFixed(1)} px off its scale's middle`);
    }
  }));
});

// The worksheet in "Methods, in brief" on the narrowest phones: each line's words and formula note take the line's width
// (the amount sits under them, at the right), and nothing reaches past the form's edge. At 390 px the amounts stay beside
// the words.
describe('the worksheet on a narrow phone', () => {
  const tabs = useContext(shared, { width: 320 });
  it('gives its words the width at 320 px and keeps the amounts beside them at 390 px', () => withPage(tabs, { path: '/' }, async (page) => {
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 800 });
      await settle(page);
      const f = await page.evaluate(() => {
        const table = document.querySelector('.wst').getBoundingClientRect();
        const rows = [...document.querySelectorAll('.wst tbody tr')].map((tr) => {
          const words = tr.querySelector('th').getBoundingClientRect();
          const amount = tr.lastElementChild.getBoundingClientRect();
          return { share: words.width / table.width, under: amount.top >= words.bottom - 1, inside: amount.right <= table.right + 0.5 && words.right <= table.right + 0.5 };
        });
        return { rows };
      });
      assert.equal(f.rows.length, 6, `${width} px: six lines`);
      for (const [i, r] of f.rows.entries()) {
        assert.equal(r.inside, true, `${width} px, line ${i + 1}: inside the form`);
        if (width === 320) assert.ok(r.share >= 0.8 && r.under, `${width} px, line ${i + 1}: its words take ${Math.round(r.share * 100)}% of the form, the amount ${r.under ? 'under' : 'beside'} them`);
        else assert.equal(r.under, false, `${width} px, line ${i + 1}: the amount beside its words`);
      }
      await assertNoSideways(page, `${width} px`);
      // Still a table to a screen reader, its six lines rows, each a number, a row header and an amount.
      const tree = await page.locator('.wst').ariaSnapshot();
      // (A snapshot line is quoted when its name holds a character YAML would read, so each may start with a quote.)
      assert.match(tree, /^- '?table "Worksheet/, `${width} px: a table`);
      assert.equal((tree.match(/^ *- '?row /gm) ?? []).length, 6, `${width} px: six rows`);
      assert.equal((tree.match(/^ *- '?rowheader /gm) ?? []).length, 6, `${width} px: each with its row header`);
    }
  }));
});

// Below the story, the directory: each live program's card ends in a way to its page whose words sit on one line, as its
// neighbours' do; and the programs under consideration: at every layout each group's name sits on one line inside its
// row, each slip's band holds its words on one line, and slips in one row are one height with their bands on one bottom
// edge (from 1200 px the six share one row).
describe('the directory\'s slips', { concurrency: CONCURRENCY }, () => {
  const tabs = useContext(shared, { width: 1024 });
  it('fit their rows and bands, and line up, at 1024, 1100, 1199, 1200, 1280, 1440 and 390 px', () => withPage(tabs, { path: '/' }, async (page) => {
    for (const width of [1024, 1100, 1199, 1200, 1280, 1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await settle(page);
      const f = await page.evaluate(() => {
        const box = (el) => el.getBoundingClientRect();
        const inside = (el, outer) => box(el).left >= box(outer).left - 0.5 && box(el).right <= box(outer).right + 0.5;
        const oneLine = (el) => box(el).height <= parseFloat(getComputedStyle(el).lineHeight) * 1.5;
        const names = [...document.querySelectorAll('.sg .grp > span')];
        const slips = [...document.querySelectorAll('.slip')];
        // The slips by row (their tops within a pixel), each row's slip heights and band bottoms.
        const rows = [];
        for (const s of slips) {
          const top = box(s).top;
          let row = rows.find((r) => Math.abs(r.top - top) <= 1);
          if (!row) rows.push((row = { top, heights: [], bands: [] }));
          row.heights.push(box(s).height);
          row.bands.push(box(s.querySelector('.slip__none')).bottom);
        }
        const spread = (xs) => Math.max(...xs) - Math.min(...xs);
        // The lines a card's way to its page takes: its words' boxes, one per line.
        const lines = (a) => {
          const range = document.createRange();
          range.selectNodeContents(a.firstChild);
          return new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size;
        };
        return {
          go: [...document.querySelectorAll('.pc .go')].map(lines),
          names: names.length,
          namesOk: names.every((n) => oneLine(n) && inside(n, n.parentElement)),
          bands: slips.length,
          bandsOk: slips.every((s) => { const b = s.querySelector('.slip__none'); return box(b.firstElementChild).height <= box(b).height + 0.5 && inside(b.firstElementChild, b); }),
          rows: rows.length,
          heightSpread: Math.max(...rows.map((r) => spread(r.heights))),
          bandSpread: Math.max(...rows.map((r) => spread(r.bands))),
        };
      });
      assert.deepEqual(f.go, [1, 1, 1], `${width} px: each card's way to its page on one line`);
      assert.equal(f.names, 3, `${width} px: three groups`);
      assert.equal(f.namesOk, true, `${width} px: each group's name on one line, inside its row`);
      assert.equal(f.bands, 6, `${width} px: six slips`);
      assert.equal(f.bandsOk, true, `${width} px: each band's words on one line, inside it`);
      if (width >= 1200) assert.equal(f.rows, 1, `${width} px: the six slips share one row`);
      assert.ok(f.heightSpread <= 1, `${width} px: slips in one row are one height (spread ${f.heightSpread} px)`);
      assert.ok(f.bandSpread <= 1, `${width} px: bands in one row share a bottom edge (spread ${f.bandSpread} px)`);
    }
  }));
});
