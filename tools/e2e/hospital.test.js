// A hospital's page across the programs, live (hub/client/hospital.js), in a real browser: the swarm draws, the peer
// toggle restates the page for each group (the headline, the group's name and count, the table) and moves the dollar
// rows' median ticks, each program row gets its strip with the hospital ringed, the peer table fills alphabetically when
// opened, a toggle the hospital has no group for is disabled with its reason, and nothing goes wrong on the page; without
// the data the page stays as the server wrote it, with one quiet line. The factor what-if: a handle stepped by keyboard
// or dragged marks the page hypothetical everywhere (the banner, the stamp, the struck actuals, the ghost rings, the
// fragment) and Escape or Reset puts it back; a shared link with a valid changed scenario opens on it under "Reader-made
// scenario", one with junk opens on the actual figures. The strips keep the data's own axis and widen only as far as a
// hypothetical figure past it needs (every part on one glide), narrowing when nothing needs the room; while a drag lasts
// they only grow, and a drag past a strip's end reaches its factor's end. Runs against dist/ (make build) or any URL.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pctOf } from '../../engine/js/dollars/whatif.js';
import { outcome } from '../../hub/client/hospital/whatif-state.js';
import { loadHub } from '../../hub/data.js';
import { EXAMPLE_CCN, hubHospitals } from '../../hub/model.js';
import { hospitalPathOf } from '../../web/site.js';
import { audit } from './axe.js';
import { CONCURRENCY, assertQuiet, settle, useBrowser, useContext, visit, withPage } from './lib.js';
import { samplePages } from './site.js';

const shared = useBrowser();
const CUT = samplePages().find((p) => p.type === 'hub-hospital-cut');
const ESTIMATED = hubHospitals(loadHub()).filter((h) => h.est);
// A hospital with an estimate and no teaching status on record, picked by property.
const NO_TEACH = ESTIMATED.find((h) => h.teach === null);
// By property, for the what-if's edges: the hospital with the highest value-based purchasing factor in the data (its own
// factor sits past the range's four-decimal end), and the one in both factor programs whose base is the largest share of
// its pay (its hypothetical figures reach furthest past every actual one on the share axis).
const most = (list, by) => list.reduce((a, b) => (by(b) > by(a) ? b : a));
const TOP_VBP = most(ESTIMATED.filter((h) => h.est.vbpListed), (h) => h.est.vbpFactor);
const HIGH_BASE = most(ESTIMATED.filter((h) => h.est.hrrpListed && h.est.vbpListed), (h) => h.est.base / h.est.total);

// The what-if's marks: whether the page says it is hypothetical, and where.
const hypo = (page) => page.evaluate(() => ({
  banner: document.querySelector('.hh__scen')?.checkVisibility() ?? false,
  dashed: document.querySelector('[data-peers]').classList.contains('hh__peers--hyp'),
  shared: document.querySelector('.hh__shared')?.checkVisibility() ?? false,
  stamp: document.querySelector('.hh__stamp .stamp').textContent,
  struck: document.querySelectorAll('.hh__was').length,
  ghosts: document.querySelectorAll('.st__me--ghost').length,
  hash: location.hash,
  result: document.querySelector('[data-result] .hh__rs').textContent,
  head: document.querySelector('[data-headline]').textContent,
  sideways: document.documentElement.scrollWidth - window.innerWidth,
}));
// Long enough for the result and the fragment to settle (web/whatif/dom.js SETTLE_MS, 400 ms).
const SETTLED_MS = 700;

// A row's what-if handle.
const handleAt = (page, id = 'hrrp') => page.locator(`[data-row="${id}"] .st__h`);
// A press on a handle's capsule, in its middle: the pointer moves there and goes down. Returns the point.
async function grab(page, handle) {
  const box = await handle.locator('.st__hb').boundingBox();
  const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
  await page.mouse.move(x, y);
  await page.mouse.down();
  return [x, y];
}
// A step of the focused handle: the first key, and the second where the first left its value as it was (an end).
async function stepAway(page, handle, [first, second] = ['ArrowLeft', 'ArrowRight']) {
  const start = await handle.getAttribute('aria-valuenow');
  await page.keyboard.press(first);
  if ((await handle.getAttribute('aria-valuenow')) === start) await page.keyboard.press(second);
}
// Every part the same way along its move at one moment (along: each moving part's way along, 0 at its start and 1 at its
// end), part way. Returns the least.
function assertOneGlide(along, what) {
  const [lo, hi] = [Math.min(...along), Math.max(...along)];
  assert.ok(lo > 0.05 && hi < 0.95 && hi - lo < 0.01, `${what} (${lo}..${hi})`);
  return lo;
}
const NEVER = /\bshould\b|\bfailed\b|could have avoided|NaN|undefined|Infinity/i;

// The page's state: the pressed toggle, the group line, the headline, the ticks' places, whether the canvas has paint,
// how many strips have a ring, and the sideways overflow.
const read = (page) => page.evaluate(() => {
  const canvas = document.querySelector('.hh__cv');
  const pixels = canvas ? canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data : [];
  let painted = 0;
  for (let p = 3; p < pixels.length; p += 4) if (pixels[p] > 0) painted += 1;
  return {
    pressed: [...document.querySelectorAll('[data-peer][aria-pressed="true"]')].map((b) => b.dataset.peer),
    group: document.querySelector('[data-peer-name]').textContent.trim(),
    head: document.querySelector('[data-headline]').textContent,
    ticks: [...document.querySelectorAll('.hh__tick')].map((t) => t.style.getPropertyValue('--m')).join(' '),
    painted,
    rings: [...document.querySelectorAll('.st__me')].filter((c) => c.style.display !== 'none').length,
    strips: document.querySelectorAll('[data-strip] svg').length,
    sideways: document.documentElement.scrollWidth - window.innerWidth,
  };
});

for (const width of [390, 1280]) {
  describe(`a hospital's page at ${width} px`, { concurrency: CONCURRENCY }, () => {
    const tabs = useContext(shared, { width });

    it('the toggle restates the page for each group and moves the same dots; the table fills alphabetically', () => withPage(tabs, { path: CUT.path, watched: true }, async (page, { seen }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForSelector('.hh__cv');
      await settle(page);
      const first = await read(page);
      assert.deepEqual(first.pressed, ['state']);
      assert.ok(first.painted > 1000, `the swarm draws (${first.painted} painted pixels)`);
      assert.equal(first.strips, 4, 'a strip per program and the net');
      assert.ok(first.rings >= 3, 'the hospital ringed in the strips of the programs it is in');
      assert.equal(first.sideways, 0, 'nothing scrolls sideways');
      for (const mode of ['size', 'teach', 'state']) {
        const before = await read(page);
        await page.click(`[data-peer="${mode}"]`);
        await settle(page);
        const after = await read(page);
        assert.deepEqual(after.pressed, [mode], `${mode}: pressed`);
        assert.notEqual(after.group, before.group, `${mode}: the group line changes`);
        assert.notEqual(after.head, before.head, `${mode}: the headline changes`);
        assert.ok(after.head.includes(after.group.replace(/^[\d,]+ /, '')), `${mode}: the headline names the group`);
        assert.ok(!/NaN|undefined|Infinity/.test(after.head + after.group), 'no broken numbers');
        assert.equal(after.sideways, 0, 'nothing scrolls sideways');
      }
      await page.click('[data-peer="size"]');
      await page.click('[data-peer-table] summary');
      await settle(page);
      const table = await page.evaluate(() => {
        const rows = [...document.querySelectorAll('.hh__pt tbody tr')];
        const names = rows.map((r) => r.querySelector('th').textContent.replace(/\s*\(this hospital\)$/, ''));
        return {
          n: rows.length, names, me: document.querySelectorAll('.hh__pt .hh__me').length,
          group: document.querySelector('[data-peer-name] b').textContent, zero: rows.some((r) => [...r.cells].slice(3, 6).some((c) => c.textContent === '$0')),
        };
      });
      assert.equal(table.n.toLocaleString('en-US'), table.group, 'one row per peer');
      assert.deepEqual(table.names, [...table.names].sort((a, b) => a.localeCompare(b, 'en-US')), 'alphabetical');
      assert.equal(table.me, 1, 'this hospital\'s row marked');
      await audit(page, `the hospital page at ${width} px with the toggle and the table`);
      await assertQuiet(seen, 'the hospital page');
    }));

    it('a toggle the hospital has no group for is disabled, with the reason', () => withPage(tabs, { path: hospitalPathOf('hub', NO_TEACH.ccn), watched: true }, async (page, { seen }) => {
      await page.waitForSelector('.hh__cv');
      const teach = await page.evaluate(() => {
        const b = document.querySelector('[data-peer="teach"]');
        const note = document.getElementById(b.getAttribute('aria-describedby'));
        return { disabled: b.disabled, note: note?.checkVisibility() ? note.textContent : null };
      });
      assert.equal(teach.disabled, true);
      assert.match(teach.note ?? '', /no teaching status/);
      await assertQuiet(seen, 'the hospital page without a teaching status');
    }));

    it('the what-if: a stepped or dragged handle marks the page hypothetical, and Escape or Reset puts it back', () => withPage(tabs, { path: CUT.path, watched: true }, async (page, { seen }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForSelector('.st__h');
      const before = await hypo(page);
      assert.equal(before.banner, false);
      assert.equal(before.struck, 0);
      const handle = page.locator('.st__h').first();
      await handle.focus();
      const now = () => handle.getAttribute('aria-valuenow');
      const start = await now();
      await stepAway(page, handle, ['Shift+ArrowRight', 'Shift+ArrowLeft']);
      assert.notEqual(await now(), start, 'the handle steps');
      await page.waitForTimeout(SETTLED_MS);
      const on = await hypo(page);
      assert.equal(on.banner, true, 'the Hypothetical banner shows');
      assert.equal(on.dashed, true, 'the sticky row is dashed');
      assert.equal(on.shared, false, 'no shared-link line for the reader\'s own change');
      assert.match(on.stamp, /what if/i);
      assert.ok(on.struck > 0, 'the actual figures struck through beside the new ones');
      assert.ok(on.ghosts > 0, 'the actual\'s ring a ghost');
      assert.match(on.hash, /^#whatif&/);
      assert.match(on.result, /^If .* would be /);
      assert.match(on.head, /^What if: /);
      assert.doesNotMatch(on.result + on.head, NEVER);
      assert.match(await handle.getAttribute('aria-valuetext'), /estimated FY\d{4} .*hypothetical$/);
      assert.equal(on.sideways, 0);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(SETTLED_MS);
      const off = await hypo(page);
      assert.deepEqual([off.banner, off.dashed, off.struck, off.ghosts, off.hash], [false, false, 0, 0, ''], 'Escape resets');
      assert.deepEqual([off.stamp, off.head, off.result], [before.stamp, before.head, before.result], 'the actual words back');
      // A drag: the handle moves with the pointer.
      await page.locator('#whatif').scrollIntoViewIfNeeded();
      const [x, y] = await grab(page, handle);
      for (const dx of [-20, -40, -60]) await page.mouse.move(x + dx, y);
      if ((await now()) === start) for (const dx of [20, 40, 60]) await page.mouse.move(x + dx, y);
      await page.mouse.up();
      assert.notEqual(await now(), start, 'the drag moves the handle');
      await page.waitForTimeout(SETTLED_MS);
      assert.equal((await hypo(page)).banner, true);
      await page.locator('.hh__scen .hh__reset').click();
      await page.waitForTimeout(SETTLED_MS);
      assert.equal((await hypo(page)).banner, false, 'Reset to actual');
      assert.equal(await page.evaluate(() => document.activeElement?.dataset.peer ?? null), 'state', 'focus moves to the pressed peer toggle, not the page\'s start');
      // A typed factor, then Escape in the field: the page resets and the field shows the actual factor again.
      const field = page.locator('.hh__fin').first();
      if (await field.count()) {
        const shown = await field.inputValue();
        await field.fill(shown === '0.9800' ? '0.9900' : '0.9800');
        await field.press('Enter');
        await page.waitForTimeout(SETTLED_MS);
        assert.equal((await hypo(page)).banner, true, 'a typed factor is a what-if');
        await field.press('Escape');
        await page.waitForTimeout(SETTLED_MS);
        assert.equal((await hypo(page)).banner, false, 'Escape in the field resets');
        assert.equal(await field.inputValue(), shown, 'the field shows the actual factor again');
      }
      await audit(page, `the hospital page at ${width} px after a what-if`);
      await assertQuiet(seen, 'the hospital page\'s what-if');
    }));

    // Review Focus 2's link: a value out of range before a valid one, a non-number, a cut that is neither 0 nor 1.
    it('a shared what-if link opens on its valid parts, marked reader-made; one with only junk opens on the actual figures', () => withPage(tabs, { path: `${CUT.path}#whatif&hrrp=2&hrrp=0.99&hvbp=abc&hac=7`, watched: true }, async (page, { seen }) => {
      assert.ok(CUT.hospital.est.hrrpListed && CUT.hospital.est.hrrpFactor !== 0.99, 'the sample is in Readmissions at a factor other than 0.99');
      await page.waitForSelector('.st__h');
      await page.waitForTimeout(SETTLED_MS);
      const linked = await hypo(page);
      assert.equal(linked.banner, true);
      assert.equal(linked.shared, true, 'Reader-made scenario, not CMS data.');
      assert.equal(linked.hash, '#whatif&hrrp=0.99', 'the junk dropped from the address, the first valid value kept');
      assert.match(linked.result, /readmissions factor were 0\.9900 /);
      await page.locator('.hh__shared a').click();
      await page.waitForTimeout(SETTLED_MS);
      assert.deepEqual(await hypo(page).then((s) => [s.banner, s.shared, s.hash]), [false, false, '']);
      // A fresh page (not a same-document jump) from a link with only junk.
      await visit(page, tabs.base, '/about/');
      await visit(page, tabs.base, `${CUT.path}#whatif&hrrp=2&hvbp=abc&hac=7`);
      await page.waitForSelector('.st__h');
      await page.waitForTimeout(SETTLED_MS);
      const junk = await hypo(page);
      assert.deepEqual([junk.banner, junk.shared, junk.struck], [false, false, 0], 'junk changes nothing');
      await assertQuiet(seen, 'the hospital page from a shared what-if link');
    }));

    it('a linked what-if the reader then changes is their own: the banner stays, "Reader-made scenario" goes', () => withPage(tabs, { path: `${CUT.path}#whatif&hrrp=0.99`, watched: true }, async (page, { seen }) => {
      await page.waitForSelector('.st__h');
      await page.waitForTimeout(SETTLED_MS);
      assert.deepEqual(await hypo(page).then((s) => [s.banner, s.shared]), [true, true], 'opened from the link: reader-made');
      const handle = page.locator('.st__h').first();
      await handle.focus();
      await stepAway(page, handle);
      await page.waitForTimeout(SETTLED_MS);
      assert.deepEqual(await hypo(page).then((s) => [s.banner, s.shared]), [true, false], 'edited: still hypothetical, no longer the link\'s');
      await assertQuiet(seen, 'a linked what-if, edited');
    }));

    it('a focused handle stays clear of the sticky rows when the Hypothetical banner joins them', () => withPage(tabs, { path: CUT.path, watched: true }, async (page, { seen }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForSelector('.st__h');
      const handle = page.locator('.st__h').first();
      await handle.focus();
      // Park the handle just under the sticky row, as Shift+Tab up into it leaves it.
      await page.evaluate(() => {
        const box = document.activeElement.querySelector('.st__hb').getBoundingClientRect();
        window.scrollBy(0, box.top - document.querySelector('[data-peers]').getBoundingClientRect().bottom - 2);
      });
      await stepAway(page, handle);
      await page.waitForTimeout(SETTLED_MS);
      const covered = await page.evaluate(() => {
        const box = document.activeElement.querySelector('.st__hb').getBoundingClientRect();
        // The sticky rows: the peer row and, under it (on a phone, in its place), the banner.
        const rows = [...document.querySelectorAll('[data-peers], .hh__scen')].filter((el) => el.checkVisibility()).map((el) => el.getBoundingClientRect());
        const bar = { top: Math.min(...rows.map((r) => r.top)), bottom: Math.max(...rows.map((r) => r.bottom)) };
        return { banner: document.querySelector('[data-peers]').classList.contains('hh__peers--hyp'), px: Math.max(0, Math.min(box.bottom, bar.bottom) - Math.max(box.top, bar.top)), below: box.bottom <= innerHeight };
      });
      assert.deepEqual(covered, { banner: true, px: 0, below: true }, 'the handle in view, none of it under the banner');
      await assertQuiet(seen, 'the hospital page\'s what-if, focus kept in view');
    }));

    it('without its data the page stays as the server wrote it, with one quiet line', () => withPage(tabs, { path: '/about/' }, async (page) => {
      await page.route('**/assets/hub-hospitals.*.json', (route) => route.fulfill({ status: 503, body: '' }));
      await visit(page, tabs.base, CUT.path);
      await settle(page);
      const s = await page.evaluate(() => ({
        error: document.querySelector('[data-load-error]').checkVisibility(),
        canvas: document.querySelectorAll('.hh__cv').length,
        // The toggle keeps its room unseen until the data arrives (the first visit holds still), so it is checked as seen.
        buttons: [...document.querySelectorAll('[data-peer]')].filter((b) => b.checkVisibility({ visibilityProperty: true })).length,
        head: document.querySelector('[data-headline]').checkVisibility(),
      }));
      assert.deepEqual(s, { error: true, canvas: 0, buttons: 0, head: true });
    }));
  });
}

// The net is the page's hero number: at its full size (3.5rem) wherever the record and the money take the page's whole
// width (641 to 1023 px), and well over the hospital's name beside the swarm from 1024 px.
describe('the net figure', () => {
  const tabs = useContext(shared, { width: 768 });
  it('reads as the page\'s hero number at 768 and 1024 px', () => withPage(tabs, { path: CUT.path }, async (page) => {
    for (const width of [700, 768, 1023, 1024, 1100]) {
      await page.setViewportSize({ width, height: 900 });
      await settle(page);
      const [big, name] = await page.evaluate(() => ['.hh__big', '.hh__name'].map((s) => parseFloat(getComputedStyle(document.querySelector(s)).fontSize)));
      if (width < 1024) assert.equal(big, 56, `${width} px: the net is ${big} px`);
      assert.ok(big >= name * 1.3, `${width} px: the net (${big} px) against the name (${name} px)`);
    }
  }));
});

// On a touch screen a tap on a dot shows its tooltip (a second tap opens that hospital); a tap anywhere outside the
// swarm puts the tooltip away, as a pointer leaving it does. The taps are the events a touch screen sends, dispatched in
// the page, so the check is the same in every engine and does not lean on the tap moving focus (Safari's does not).
describe('the swarm by touch', () => {
  const tabs = useContext(shared, { width: 390 });
  it('a tap outside the swarm hides the tooltip a tap on a dot showed', () => withPage(tabs, { path: CUT.path, watched: true }, async (page, { seen }) => {
    await page.waitForSelector('.hh__tip', { state: 'attached' });
    await page.locator('.hh__cv').scrollIntoViewIfNeeded();
    await settle(page);
    const found = await page.evaluate(() => {
      const canvas = document.querySelector('.hh__cv');
      const tip = document.querySelector('.hh__tip');
      const b = canvas.getBoundingClientRect();
      // Tap across the swarm until a dot answers.
      for (let y = b.top + b.height * 0.1; y < b.top + b.height * 0.9; y += 4) {
        for (let x = b.left + b.width * 0.1; x < b.left + b.width * 0.9; x += 4) {
          canvas.dispatchEvent(new PointerEvent('click', { bubbles: true, clientX: x, clientY: y, pointerType: 'touch' }));
          if (!tip.hidden) return true;
        }
      }
      return false;
    });
    assert.ok(found, 'a tap on a dot shows its tooltip');
    await page.evaluate(() => {
      const outside = document.querySelector('[data-headline]');
      outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }));
    });
    assert.equal(await page.evaluate(() => document.querySelector('.hh__tip').hidden), true, 'a tap outside the swarm hides it');
    await assertQuiet(seen, 'the swarm by touch');
  }));
});

// The what-if's edges, at one width: Home and End go where the slider says its ends are; a drag reaches the range's ends
// and every hypothetical stands on the share axis (none pinned at its end); a drag updates the page once a frame and
// lands its last place on release; the shared link's way back stays on this site.
describe('the what-if\'s edges', () => {
  const tabs = useContext(shared);
  const value = (handle) => handle.getAttribute('aria-valuenow');

  it('Home and End go to the ends the handle states: the highest factor in the data is its own top', () => withPage(tabs, { path: hospitalPathOf('hub', TOP_VBP.ccn), watched: true }, async (page, { seen }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const handle = handleAt(page, 'hvbp');
    await handle.waitFor();
    await handle.focus();
    const [own, min, max] = await Promise.all([value(handle), handle.getAttribute('aria-valuemin'), handle.getAttribute('aria-valuemax')]);
    assert.equal(own, max, 'its own factor is the handle\'s top');
    await page.keyboard.press('End');
    assert.equal(await value(handle), own, 'End stays at its own factor');
    await page.keyboard.press('Home');
    assert.equal(await value(handle), min, 'Home: the bottom');
    await page.keyboard.press('End');
    assert.equal(await value(handle), max, 'End: the top it states');
    await page.waitForTimeout(SETTLED_MS);
    assert.equal((await hypo(page)).banner, false, 'back on the actual figures');
    await assertQuiet(seen, 'Home and End on the highest factor');
  }));

  it('a handle dragged to its strip\'s ends reaches its range\'s ends; two hypothetical nets stand at two places', () => withPage(tabs, { path: hospitalPathOf('hub', HIGH_BASE.ccn), watched: true }, async (page, { seen }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const handle = handleAt(page, 'hvbp');
    await handle.waitFor();
    await page.locator('[data-row="hvbp"]').scrollIntoViewIfNeeded();
    // Past a strip's end a drag goes to that end of the range, whatever axis the strips draw.
    const drag = async (side) => {
      const strip = await page.locator('[data-row="hvbp"] [data-strip] svg').boundingBox();
      const [, y] = await grab(page, handle);
      await page.mouse.move(side > 0 ? strip.x + strip.width - 1 : strip.x + 1, y, { steps: 8 });
      await page.mouse.up();
    };
    await drag(1);
    assert.equal(await value(handle), await handle.getAttribute('aria-valuemax'), 'the strip\'s right end: the range\'s top');
    await drag(-1);
    assert.equal(await value(handle), await handle.getAttribute('aria-valuemin'), 'its left end: the bottom');
    // Both factors at their lowest, then the cut on and off: the hypothetical net stands at its own value on the axis
    // drawn (read off the ticks either side of it), never pinned at the axis's end.
    await handleAt(page, 'hrrp').focus();
    await page.keyboard.press('Home');
    const net = () => page.evaluate(() => {
      const svg = document.querySelector('[data-row="net"] svg.st');
      const x = (el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).e;
      const ticks = [...svg.querySelectorAll('.st__tl')].map((t) => [Number(t.textContent.replace('−', '-').replace('%', '')), x(t)]).sort((a, b) => a[0] - b[0]);
      const at = x(svg.querySelector('.st__hyp'));
      // The net is a cut here: between two ticks left of $0, on the cuts' side of the axis.
      const i = ticks.findIndex(([, tx]) => tx > at);
      const [[a, xa], [b, xb]] = [ticks[i - 1], ticks[i]];
      return a + ((at - xa) * (b - a)) / (xb - xa);
    });
    const share = (hac) => pctOf({ total: HIGH_BASE.est.total, ...outcome({ hrrp: 0.97, hvbp: 0.98, hac }, HIGH_BASE) }).net;
    await handleAt(page, 'hacrp').focus();
    await page.keyboard.press('Home');
    const cut = await net();
    await page.keyboard.press('End');
    const none = await net();
    for (const [read, want] of [[cut, share(true)], [none, share(false)]]) assert.ok(Math.abs(read - want) < 0.05, `the net at ${read.toFixed(3)}%, its value ${want.toFixed(3)}%`);
    assert.ok(cut < none, `the net with the cut (${cut.toFixed(3)}%) left of the net without it (${none.toFixed(3)}%)`);
    await assertQuiet(seen, 'the what-if at its ends');
  }));

  it('a drag updates the page once a frame, and lands its last place on release', () => withPage(tabs, { path: hospitalPathOf('hub', HIGH_BASE.ccn), watched: true }, async (page, { seen }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const handle = handleAt(page, 'hrrp');
    await handle.waitFor();
    await page.locator('[data-row="hrrp"]').scrollIntoViewIfNeeded();
    const start = await value(handle);
    const dir = start === (await handle.getAttribute('aria-valuemin')) ? 1 : -1;
    const [x, y] = await grab(page, handle);
    // Ten moves in one task, a frame, four more and a release in one task, a frame: what the page shows after each, and
    // how many times it wrote the net (each update writes it once).
    const s = await page.evaluate(async ([x0, y0, d]) => {
      const el = document.querySelector('[data-row="hrrp"] .st__h');
      // The writes delivered to the observer (between a frame's callbacks) and those still queued.
      let delivered = 0;
      const writes = new MutationObserver((list) => { delivered += list.length; });
      writes.observe(document.querySelector('.hh__big'), { childList: true, characterData: true, subtree: true });
      const fire = (type, n) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x0 + d * 6 * n, clientY: y0, pointerId: 1, pointerType: 'mouse', isPrimary: true }));
      const read = () => {
        const out = { now: el.getAttribute('aria-valuenow'), writes: delivered + writes.takeRecords().length };
        delivered = 0;
        return out;
      };
      const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
      for (let n = 1; n <= 10; n++) fire('pointermove', n);
      const sync = read();
      await frame();
      const framed = read();
      for (let n = 11; n <= 14; n++) fire('pointermove', n);
      fire('pointerup', 14);
      const up = read();
      await frame();
      const after = read();
      writes.disconnect();
      return { sync, framed, up, after };
    }, [x, y, dir]);
    await page.mouse.up();
    assert.deepEqual(s.sync, { now: start, writes: 0 }, 'nothing yet within the moves\' own task');
    assert.equal(s.framed.writes, 1, 'one update in the frame');
    assert.notEqual(s.framed.now, start, 'to the last move\'s place');
    assert.equal(s.up.writes, 1, 'the release lands the moves since at once');
    assert.notEqual(s.up.now, s.framed.now);
    assert.deepEqual(s.after, { now: s.up.now, writes: 0 }, 'and nothing is left for the next frame');
    await assertQuiet(seen, 'a drag, once a frame');
  }));

  it('the shared link\'s way back is a link on this site, even on a path that begins "//"', () => withPage(tabs, { path: '/about/' }, async (page) => {
    const path = hospitalPathOf('hub', HIGH_BASE.ccn);
    const { origin } = new URL(page.url());
    const body = await (await page.request.get(`${origin}${path}`)).text();
    await page.route((url) => url.pathname.startsWith('//'), (route) => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body }));
    await page.goto(`${origin}/${path}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.st__h');
    assert.equal(await page.evaluate(() => location.pathname), `/${path}`);
    assert.equal(await page.locator('.hh__shared a').getAttribute('href'), path);
  }));
});

// The strips' axis: the data's own (the full width for the data), widened only as far as a hypothetical figure past it
// needs, on that side, to a whole percent, and back when nothing needs the room; each change one glide with every part
// of each strip on one transition. Opening the what-if changes nothing. While a drag lasts the axis only grows, a drag
// past a strip's end reaches its factor's end, and on release the axis settles to what the figures need. A link that
// opens on a scenario starts on the axis it needs, with no glide. When the axis widens under a drag, the handle moves
// one for one with the pointer from where it then stands; a mouse that lets go resting on the strip holds the axis until
// it leaves.
describe('the strips\' axis', () => {
  const tabs = useContext(shared);
  const phone = useContext(shared, { width: 390 });
  const path = hospitalPathOf('hub', HIGH_BASE.ccn);
  // Its value-based purchasing handle: at the top of its range the program's share of pay lies past the data's axis
  // (by property: the hospital whose base is the largest share of its pay reaches furthest).
  const vbp = (page) => handleAt(page, 'hvbp');
  // The ticks of the data's own axis, and of the one value-based purchasing's top needs: the same left end, out to the
  // next whole percent on the right.
  const TIGHT = '-3 -2 -1 0 1 2 3';
  const TOP = '-3 -2 -1 0 1 2 3 4 5';
  // A strip's axis as it stands on the screen, read off its tick labels and its $0 gutter (strips.js: the plot runs 4 px
  // in from each side): k, pixels per percentage point between the two leftmost labels, and the span in points the plot
  // holds beside the gutter. A label on its way out (faded) is not counted.
  const axisOf = (page, id = 'hrrp') => page.evaluate((row) => {
    const svg = document.querySelector(`[data-row="${row}"] svg.st`);
    const ticks = [...svg.querySelectorAll('.st__tl')].filter((t) => getComputedStyle(t).opacity !== '0').map((t) => {
      const b = t.getBoundingClientRect();
      return { v: Number(t.textContent.replace('−', '-').replace('%', '')), x: b.left + b.width / 2 };
    }).sort((a, b) => a.v - b.v);
    const k = (ticks[1].x - ticks[0].x) / (ticks[1].v - ticks[0].v);
    const gutter = svg.querySelector('.st__gut').getBoundingClientRect().width;
    return { k, span: (svg.getBoundingClientRect().width - 8 - gutter) / k, ticks: ticks.map((t) => t.v).join(' ') };
  }, id);
  // Glides started in the strips since the page loaded (an init script counts each transform transition's start).
  const counting = (page) => page.addInitScript(() => {
    window.stGlides = 0;
    document.addEventListener('transitionstart', (e) => {
      if (e.propertyName === 'transform' && e.target.closest?.('svg.st')) window.stGlides += 1;
    }, true);
  });
  const glides = (page) => page.evaluate(() => window.stGlides);
  const near = (a, b) => Math.abs(a - b) < 1e-6;

  it('opening the what-if changes nothing: a handle\'s focus, the "What if?" button, a step inside the axis', () => withPage(tabs, { path: '/about/', watched: true }, async (page, { seen }) => {
    await counting(page);
    await visit(page, tabs.base, path);
    await page.waitForSelector('.st__h');
    const before = await axisOf(page);
    assert.equal(before.ticks, TIGHT, 'the data\'s own axis');
    await handleAt(page).focus();
    await page.locator('.hh__wbtn').click();
    await page.waitForTimeout(1600);
    assert.equal(await page.evaluate(() => document.activeElement?.closest('[data-row]')?.dataset.row ?? null), 'hrrp', 'the button jumps to the first handle');
    await stepAway(page, handleAt(page));
    await settle(page);
    assert.equal((await hypo(page)).banner, true, 'a hypothetical inside the axis');
    const after = await axisOf(page);
    assert.deepEqual([after.ticks, near(after.span, before.span), near(after.k, before.k)], [before.ticks, true, true], 'the same axis');
    assert.equal(await glides(page), 0, 'no glide');
    await assertQuiet(seen, 'opening the what-if');
  }));

  it('a figure past the axis widens it just enough, every part of a strip on one glide (the thread too); back inside, Reset or Escape, it narrows', () => withPage(tabs, { path: '/about/', watched: true }, async (page, { seen }) => {
    await counting(page);
    await visit(page, tabs.base, path);
    await page.waitForSelector('.st__h');
    await page.locator('#whatif').scrollIntoViewIfNeeded();
    await settle(page);
    const before = await axisOf(page);
    const handle = vbp(page);
    await handle.focus();
    // End: the program's share past the axis's right end. Every transition the strips start is paused part way, at one
    // moment.
    const mid = await page.evaluate(async () => {
      const parts = [...document.querySelectorAll('svg.st :is(.st__d, .st__me, .st__med, .st__grid, .st__tl, .st__gut, .st__h)')];
      const place = (el) => new DOMMatrixReadOnly(getComputedStyle(el).transform);
      const start = new Map(parts.map((el) => [el, place(el)]));
      document.querySelector('[data-row="hvbp"] .st__h').dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
      const glide = document.getAnimations().filter((a) => a.transitionProperty === 'transform');
      for (const a of glide) {
        a.pause();
        a.currentTime = 300;
      }
      // Each part's way along its move (x, and the gutter's width), where it moves at all; the handle, which moves to its
      // new value as well, is left out.
      const along = [];
      for (const el of parts) {
        if (el.matches('.st__h')) continue;
        const [a, now, end] = [start.get(el), place(el), new DOMMatrixReadOnly(el.style.transform || 'none')];
        for (const [p, q, r] of [[a.e, now.e, end.e], [a.a, now.a, end.a]]) if (Math.abs(r - p) > 2) along.push((q - p) / (r - p));
      }
      // A frame later, the thread goes through each ring where it stands now.
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const box = document.querySelector('.hh__rows').getBoundingClientRect();
      const rings = [...document.querySelectorAll('svg.st')].map((svg) => [svg, svg.querySelector('.st__me')]).filter(([, me]) => me.style.display !== 'none')
        .map(([svg, me]) => {
          const b = svg.getBoundingClientRect();
          const m = place(me);
          return [Math.round(b.left - box.left + m.e), Math.round(b.top - box.top + m.f)];
        });
      const d = document.querySelector('.hh__thread path').getAttribute('d');
      const thread = d.split(/[MC]/).filter(Boolean).map((seg) => seg.trim().split(/\s+/).map(Number).slice(-2).map(Math.round));
      for (const a of glide) a.play();
      return { glides: glide.length, along, rings, thread };
    });
    assert.ok(mid.glides > 100, `the strips glide (${mid.glides} transitions)`);
    assert.ok(mid.along.length > 50, `${mid.along.length} parts move`);
    assertOneGlide(mid.along, 'every part the same way along at one moment: dots and ticks move as one');
    assert.deepEqual(mid.thread, mid.rings, 'the thread goes through each ring where it stands mid-glide');
    await page.waitForTimeout(1200);
    const wide = await axisOf(page);
    assert.equal(await handle.getAttribute('aria-valuenow'), await handle.getAttribute('aria-valuemax'), 'End: the range\'s top');
    assert.equal(wide.ticks, TOP, 'just enough: the left end stays, the right out to the next whole percent past the figure');
    assert.ok(wide.span > before.span + 0.5 && wide.span < before.span + 2, `wider by under two points: ${before.span.toFixed(2)} → ${wide.span.toFixed(2)}`);
    assert.ok(await page.evaluate(() => !document.querySelector('svg.st.st--live')), 'the glide\'s class comes off when it ends');
    const back = async (what) => {
      await page.waitForTimeout(1200);
      const now = await axisOf(page);
      assert.deepEqual([now.ticks, near(now.span, before.span), near(now.k, before.k)], [before.ticks, true, true], `${what}: the data's axis again`);
    };
    // Home: the figure back inside the axis.
    await page.keyboard.press('Home');
    await back('Home');
    // Reset to actual (the banner's), and Escape.
    await page.keyboard.press('End');
    await page.waitForTimeout(1200);
    assert.equal((await axisOf(page)).ticks, TOP);
    await page.locator('.hh__scen .hh__reset').click();
    await back('Reset');
    await handle.focus();
    await page.keyboard.press('End');
    await page.waitForTimeout(1200);
    await page.keyboard.press('Escape');
    await back('Escape');
    assert.equal((await hypo(page)).sideways, 0);
    await assertQuiet(seen, 'the strips widening and narrowing');
  }));

  // Half way through a glide (widening for a figure past the axis, then the reset back), on a desktop's and a phone's
  // strips: each pile is still a pile
  // (no stack folds through its middle line: every pile keeps at least 70% of its height at either end, and every dot
  // off $0 stands at least half a dot clear of every other), the hint stands aside, and no tick's label shows cut or past
  // its strip's sides at any moment.
  for (const width of [1280, 390]) {
    it(`mid-glide each strip stays a pile, the hint stands aside, and every label shows whole inside its strip (${width} px)`, () => withPage(width === 390 ? phone : tabs, { path, watched: true }, async (page, { seen }) => {
      await page.waitForSelector('.st__h');
      await page.locator('#whatif').scrollIntoViewIfNeeded();
      await settle(page);
      const glide = (how) => page.evaluate(async (trigger) => {
        const handle = document.querySelector('[data-row="hvbp"] .st__h');
        const place = (el) => new DOMMatrixReadOnly(getComputedStyle(el).transform);
        const dots = (svg) => [...svg.querySelectorAll('.st__d')];
        const height = (ys) => (ys.length ? Math.max(...ys) - Math.min(...ys) : 0);
        const svgs = [...document.querySelectorAll('svg.st')];
        const start = svgs.map((svg) => height(dots(svg).map((d) => place(d).f)));
        handle.dispatchEvent(new KeyboardEvent('keydown', { key: trigger === 'widen' ? 'End' : 'Escape', bubbles: true }));
        const moving = document.getAnimations().filter((a) => a.transitionProperty);
        const at = (ms) => {
          for (const a of moving) {
            a.pause();
            a.currentTime = ms;
          }
        };
        // Every label at each moment of the glide: none past its strip's sides while it shows (12 px: an end label's
        // reach at rest).
        const stray = [];
        for (let ms = 0; ms <= 700; ms += 35) {
          at(ms);
          for (const svg of svgs) {
            const b = svg.getBoundingClientRect();
            for (const t of svg.querySelectorAll('.st__tl')) {
              if (Number(getComputedStyle(t).opacity) < 0.02) continue;
              const r = t.getBoundingClientRect();
              if (r.left < b.left - 12 || r.right > b.right + 12) stray.push(`${t.textContent} at ${ms} ms`);
            }
          }
        }
        at(350);
        const rows = svgs.map((svg, i) => {
          const all = dots(svg).map((d) => ({ d, m: place(d), s: Number(d.getAttribute('width')), zero: d.classList.contains('st__d--neu') }));
          const end = height(dots(svg).map((d) => new DOMMatrixReadOnly(d.style.transform).f));
          const off = all.filter((p) => !p.zero);
          const clear = off.filter((p) => !all.some((o) => o !== p && Math.hypot(o.m.e - p.m.e, o.m.f - p.m.f) < p.s / 2)).length;
          return { row: svg.closest('[data-row]').dataset.row, off: off.length, clear, height: height(all.map((p) => p.m.f)) / (Math.min(start[i], end) || 1) };
        });
        const hint = document.querySelector('.st__hint');
        const out = { glides: moving.length, rows, stray, hint: hint ? Number(getComputedStyle(hint).opacity) : 0, clipped: document.querySelectorAll('svg.st [clip-path]').length };
        for (const a of moving) a.finish();
        return out;
      }, how);
      const check = (g, when) => {
        assert.ok(g.glides > 50, `${when}: the strips glide`);
        for (const { row, off, clear, height } of g.rows) {
          assert.ok(clear >= 0.95 * off, `${when}, ${row}: ${clear} of ${off} dots off $0 stand clear half way`);
          assert.ok(height >= 0.7, `${when}, ${row}: the pile keeps ${(height * 100).toFixed(0)}% of its height half way`);
        }
        assert.equal(g.hint, 0, `${when}: the hint stands aside while the strips glide`);
        assert.deepEqual(g.stray, [], `${when}: no label shows past its strip`);
        assert.equal(g.clipped, 0, `${when}: no label is clipped`);
      };
      check(await glide('widen'), 'widening');
      await page.waitForTimeout(900);
      check(await glide('reset'), 'resetting');
      await page.waitForTimeout(900);
      await assertQuiet(seen, 'a strip mid-glide');
    }));
  }

  it('a reset and a widening within one glide turn every part back from where it is drawn, with one label a tick', () => withPage(tabs, { path, watched: true }, async (page, { seen }) => {
    const handle = vbp(page);
    await handle.waitFor();
    await page.locator('#whatif').scrollIntoViewIfNeeded();
    await handle.focus();
    await page.keyboard.press('End');
    await page.waitForTimeout(900);
    const s = await page.evaluate(() => {
      const el = document.querySelector('[data-row="hvbp"] .st__h');
      const place = (p) => new DOMMatrixReadOnly(getComputedStyle(p).transform);
      const key = (code) => el.dispatchEvent(new KeyboardEvent('keydown', { key: code, bubbles: true }));
      const pauseAt = (ms) => {
        const moving = document.getAnimations().filter((a) => a.transitionProperty);
        for (const a of moving) {
          a.pause();
          a.currentTime = ms;
        }
        return moving;
      };
      // Escape: the reset's glide back, caught at 300 ms; then End: the strips widen again from there.
      key('Escape');
      pauseAt(300);
      const parts = [...document.querySelectorAll('svg.st :is(.st__d, .st__me, .st__med, .st__grid, .st__tl, .st__gut)')];
      const from = new Map(parts.map((p) => [p, place(p)]));
      key('End');
      const moving = pauseAt(250);
      const along = [];
      for (const p of parts) {
        if (!p.isConnected) continue;
        const [a, now, end] = [from.get(p), place(p), new DOMMatrixReadOnly(p.style.transform || 'none')];
        for (const [u, v, w] of [[a.e, now.e, end.e], [a.a, now.a, end.a]]) if (Math.abs(w - u) > 2) along.push((v - u) / (w - u));
      }
      const shown = new Map();
      for (const t of document.querySelectorAll('[data-row="hrrp"] svg.st .st__tl')) {
        if (Number(getComputedStyle(t).opacity) > 0.05) shown.set(t.textContent, (shown.get(t.textContent) ?? 0) + 1);
      }
      for (const a of moving) a.finish();
      return { along, twice: [...shown].filter(([, n]) => n > 1).map(([v]) => v), labels: document.querySelectorAll('[data-row="hrrp"] svg.st .st__tl').length };
    });
    assert.ok(s.along.length > 50, `${s.along.length} parts turn back`);
    assertOneGlide(s.along, 'every part the same way along from where it was drawn');
    assert.deepEqual(s.twice, [], 'no tick shows two labels');
    await page.waitForTimeout(900);
    const ticks = await axisOf(page);
    assert.equal(await page.locator('[data-row="hrrp"] svg.st .st__tl').count(), ticks.ticks.split(' ').length, 'no label left behind');
    await assertQuiet(seen, 'a reset and a widening within one glide');
  }));

  it('the hint stays inside its strip once the what-if opens', () => withPage(phone, { path, watched: true }, async (page, { seen }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForSelector('.st__hint');
    await handleAt(page).focus();
    const box = await page.evaluate(() => {
      const t = document.querySelector('.st__hint').getBoundingClientRect();
      const s = document.querySelector('.st__hint').closest('svg').getBoundingClientRect();
      return { top: t.top - s.top, left: t.left - s.left, right: s.right - t.right, bottom: s.bottom - t.bottom };
    });
    for (const [side, px] of Object.entries(box)) assert.ok(px >= -1, `the hint's ${side} edge ${px} px inside the strip`);
    await assertQuiet(seen, 'the hint inside its strip');
  }));

  it('a drag inside the axis keeps the handle under the pointer and the axis as it is, held and after', () => withPage(tabs, { path, watched: true }, async (page, { seen }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const handle = handleAt(page);
    await handle.waitFor();
    await page.locator('[data-row="hrrp"]').scrollIntoViewIfNeeded();
    const before = await axisOf(page);
    const [x, y] = await grab(page, handle);
    for (const dx of [-15, -30, -45, -60]) await page.mouse.move(x + dx, y);
    await settle(page);
    const held = await axisOf(page);
    assert.notEqual(await handle.getAttribute('aria-valuenow'), String(HIGH_BASE.est.hrrpFactor), 'the drag moved the factor');
    assert.deepEqual([held.ticks, near(held.span, before.span)], [before.ticks, true], 'the axis as it was while held');
    const hb = await handle.locator('.st__hb').boundingBox();
    assert.ok(Math.abs(hb.x + hb.width / 2 - (x - 60)) < 2, 'the handle stays under the pointer');
    await page.mouse.up();
    const after = await axisOf(page);
    assert.deepEqual([after.ticks, near(after.span, before.span)], [before.ticks, true], 'and after the release');
    await assertQuiet(seen, 'a drag inside the axis');
  }));

  // The middle of a handle's capsule, across (client x).
  const middle = async (handle) => {
    const b = await handle.locator('.st__hb').boundingBox();
    return b.x + b.width / 2;
  };

  it('a drag past a strip\'s end reaches the range\'s end and widens the strips; from there the handle moves one for one with the pointer; resting, the release waits for the pointer to leave', () => withPage(tabs, { path, watched: true }, async (page, { seen }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const handle = vbp(page);
    await handle.waitFor();
    await page.locator('[data-row="hvbp"]').scrollIntoViewIfNeeded();
    const before = await axisOf(page);
    const strip = await page.locator('[data-row="hvbp"] [data-strip] svg').boundingBox();
    const [, y] = await grab(page, handle);
    const end = strip.x + strip.width - 1;
    await page.mouse.move(end, y, { steps: 8 });
    await settle(page);
    assert.equal(await handle.getAttribute('aria-valuenow'), await handle.getAttribute('aria-valuemax'), 'past the end: the range\'s top');
    assert.equal((await axisOf(page)).ticks, TOP, 'wider while held, just enough to hold it');
    // From where the widening left the handle, it moves with the pointer one for one, and its value with it (except at
    // the hospital's own factor, where the handle sits on its dot in the pile).
    const from = await middle(handle);
    const own = String(HIGH_BASE.est.vbpFactor);
    let last = await handle.getAttribute('aria-valuenow');
    for (const dx of [40, 80, 160, 240]) {
      await page.mouse.move(end - dx, y, { steps: 4 });
      await settle(page);
      const now = await handle.getAttribute('aria-valuenow');
      assert.ok(Number(now) < Number(last), `the factor down with it (${now} after ${last})`);
      last = now;
      if (now === own) continue;
      const moved = from - (await middle(handle));
      assert.ok(Math.abs(moved - dx) <= 2, `the pointer ${dx} px left, the handle ${moved.toFixed(1)} px`);
    }
    const held = await axisOf(page);
    assert.equal(held.ticks, TOP, 'back inside, never narrower while held');
    // Let go where it rests: nothing moves.
    const at = await middle(handle);
    await page.mouse.up();
    await settle(page);
    assert.ok(Math.abs((await middle(handle)) - at) < 1, 'the handle stays under the resting pointer');
    assert.equal((await axisOf(page)).ticks, TOP, 'the axis waits while the pointer rests on the strip');
    // The pointer leaves the strip: the axis settles to the data's own; the value is as dragged.
    await page.mouse.move(strip.x + strip.width / 2, strip.y - 120, { steps: 4 });
    await settle(page);
    const after = await axisOf(page);
    assert.deepEqual([after.ticks, near(after.span, before.span)], [before.ticks, true], 'the data\'s axis, the figures needing no more');
    assert.equal(await handle.getAttribute('aria-valuenow'), last, 'the value as dragged');
    await assertQuiet(seen, 'a drag past the end');
  }));

  it('a drag that begins on a widened axis and ends inside the data\'s: the release leaves the handle under the resting pointer; a key or the pointer leaving settles the axis', () => withPage(tabs, { path, watched: true }, async (page, { seen }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const handle = vbp(page);
    await handle.waitFor();
    await page.locator('[data-row="hvbp"]').scrollIntoViewIfNeeded();
    const before = await axisOf(page);
    for (const leave of ['the pointer', 'a key']) {
      await handle.focus();
      await page.keyboard.press('End');
      assert.equal((await axisOf(page)).ticks, TOP, `${leave}: End widens the axis`);
      const [x, y] = await grab(page, handle);
      await page.mouse.move(x - 200, y, { steps: 6 });
      await settle(page);
      const at = await middle(handle);
      assert.ok(Math.abs(at - (x - 200)) < 2, `${leave}: on an axis that does not change, the handle under the pointer`);
      await page.mouse.up();
      await settle(page);
      assert.ok(Math.abs((await middle(handle)) - at) < 1, `${leave}: released and resting, the handle stays`);
      assert.equal((await axisOf(page)).ticks, TOP, `${leave}: the axis waits`);
      if (leave === 'the pointer') await page.mouse.move(x - 200, y - 150, { steps: 4 });
      else await page.keyboard.press('ArrowLeft');
      await settle(page);
      assert.equal((await axisOf(page)).ticks, before.ticks, `${leave}: the axis settles to the data's own`);
      await page.keyboard.press('Escape');
      await page.mouse.move(0, 0);
    }
    await assertQuiet(seen, 'a drag from a widened axis');
  }));

  it('the strips widening under a drag glide around the held handle, which keeps moving with the pointer; leaving the strip after the release, they glide back as one, the handle on its value', () => withPage(tabs, { path, watched: true }, async (page, { seen }) => {
    const handle = vbp(page);
    await handle.waitFor();
    await page.locator('[data-row="hvbp"]').scrollIntoViewIfNeeded();
    const strip = await page.locator('[data-row="hvbp"] [data-strip] svg').boundingBox();
    const [, y] = await grab(page, handle);
    const end = strip.x + strip.width - 1;
    await page.mouse.move(end, y, { steps: 8 });
    // Mid-glide (the strips widening), the held handle has no transition and follows the pointer at once.
    await page.waitForTimeout(150);
    assert.ok(await page.evaluate(() => document.querySelector('svg.st.st--live') !== null), 'the strips glide');
    const from = await middle(handle);
    await page.mouse.move(end - 30, y);
    await settle(page);
    assert.ok(Math.abs(from - (await middle(handle)) - 30) <= 2, 'mid-glide, one for one with the pointer');
    assert.ok(await page.evaluate(() => document.querySelector('[data-row="hvbp"] .st__h').getAnimations().length === 0), 'no transition on the held handle');
    await page.waitForTimeout(1000);
    await page.mouse.move(end - 260, y, { steps: 6 });
    await settle(page);
    const held = await handle.getAttribute('aria-valuenow');
    assert.notEqual(held, String(HIGH_BASE.est.vbpFactor), 'a factor of its own, not the hospital\'s');
    await page.mouse.up();
    // Resting: nothing glides. Then the pointer leaves, and every part of the strip glides back on one transition.
    assert.ok(await page.evaluate(() => !document.querySelector('svg.st.st--live')), 'no glide while the pointer rests');
    await page.evaluate(() => {
      window.stFrom = new Map([...document.querySelectorAll('[data-row="hvbp"] svg.st :is(.st__d, .st__me, .st__med, .st__grid, .st__tl, .st__gut, .st__h)')]
        .map((p) => [p, new DOMMatrixReadOnly(getComputedStyle(p).transform)]));
    });
    await page.mouse.move(strip.x + strip.width / 2, strip.y - 120);
    const along = await page.evaluate(() => {
      const moving = document.getAnimations().filter((a) => a.transitionProperty);
      for (const a of moving) {
        a.pause();
        a.currentTime = 300;
      }
      const out = [];
      let hand = null;
      for (const [p, a] of window.stFrom) {
        const [now, end] = [new DOMMatrixReadOnly(getComputedStyle(p).transform), new DOMMatrixReadOnly(p.style.transform || 'none')];
        if (Math.abs(end.e - a.e) > 2) out.push((now.e - a.e) / (end.e - a.e));
        if (p.classList.contains('st__h')) hand = (now.e - a.e) / (end.e - a.e);
      }
      for (const a of moving) a.play();
      return { out, hand };
    });
    assert.ok(along.out.length > 10, `${along.out.length} parts move`);
    const lo = assertOneGlide(along.out, 'the whole strip glides as one');
    assert.ok(Math.abs(along.hand - lo) < 0.01, 'the handle with it');
    await page.waitForTimeout(1000);
    assert.equal(await handle.getAttribute('aria-valuenow'), held, 'the value stays as dragged');
    // On the data's axis again, the handle stands at that value's place: read off the ticks either side of it.
    const share = ((Number(held) - 1) * HIGH_BASE.est.base * 100) / HIGH_BASE.est.total;
    const at = await page.evaluate((v) => {
      const svg = document.querySelector('[data-row="hvbp"] svg.st');
      const x = (el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).e;
      const ticks = new Map([...svg.querySelectorAll('.st__tl')].map((t) => [Number(t.textContent.replace('−', '-').replace('%', '')), x(t)]));
      // Two ticks on the value's own side of the $0 gutter (the side's line runs on through them).
      const a = v >= 0 ? Math.max(1, Math.floor(v)) : Math.min(-1, Math.ceil(v));
      const b = v >= 0 ? a + 1 : a - 1;
      return { want: ticks.get(a) + ((v - a) * (ticks.get(b) - ticks.get(a))) / (b - a), got: x(svg.querySelector('.st__h')), ticks: [...ticks.keys()].sort((p, q) => p - q).join(' ') };
    }, share);
    assert.equal(at.ticks, TIGHT, 'the strips back on the data\'s axis');
    assert.ok(Math.abs(at.got - at.want) < 1, `the handle at ${at.got} px, its value's place ${at.want} px`);
    await assertQuiet(seen, 'a release after a drag that widened the strips');
  }));

  // A link to the what-if: with no scenario the page loads on the data's axis; with one, on the axis it needs, the same
  // as the reader reaches by keys, with no glide either way.
  for (const [what, hash, ticks] of [['a link to #whatif (no scenario)', '#whatif', TIGHT], ['a shared link that opens on a figure past the axis', '#whatif&hvbp=1.0452', TOP]]) {
    it(`${what} loads on the axis it needs, with no glide`, () => withPage(tabs, { path: '/about/', watched: true }, async (page, { seen }) => {
      await counting(page);
      await visit(page, tabs.base, `${path}${hash}`);
      await page.waitForSelector('.st__h');
      await page.waitForTimeout(SETTLED_MS);
      const linked = await axisOf(page);
      assert.equal((await hypo(page)).banner, ticks === TOP, ticks === TOP ? 'the scenario loaded' : 'no scenario: the actual figures');
      assert.equal(linked.ticks, ticks);
      assert.equal(await glides(page), 0, 'no glide on load');
      if (ticks === TOP) {
        await visit(page, tabs.base, path);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.waitForSelector('.st__h');
        await vbp(page).focus();
        await page.keyboard.press('End');
        const keyed = await axisOf(page);
        assert.deepEqual([keyed.ticks, near(keyed.span, linked.span)], [linked.ticks, true], 'the same axis as End reaches');
      }
      await assertQuiet(seen, what);
    }));
  }

  it('under reduced motion the axis changes at once, with no glide', () => withPage(tabs, { path: '/about/', watched: true }, async (page, { seen }) => {
    await counting(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await visit(page, tabs.base, path);
    await page.waitForSelector('.st__h');
    const before = await axisOf(page);
    const handle = vbp(page);
    await handle.focus();
    await page.keyboard.press('End');
    // Read in the same task as the key: already there.
    const now = await page.evaluate(() => document.getAnimations().filter((a) => a.transitionProperty === 'transform').length);
    const wide = await axisOf(page);
    assert.equal(now, 0, 'no transition running');
    assert.equal(wide.ticks, TOP, `wide at once: ${before.span} → ${wide.span}`);
    await page.keyboard.press('Escape');
    assert.ok(near((await axisOf(page)).span, before.span), 'the data\'s axis at once after Escape');
    await settle(page);
    assert.equal(await glides(page), 0, 'no glide started at any point');
    await assertQuiet(seen, 'the strips under reduced motion');
  }));

  it('the swarm\'s change of axis lets go of the dot the pointer showed: no ring is left without its tooltip', () => withPage(tabs, { path, watched: true }, async (page, { seen }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForSelector('.hh__cv');
    await page.locator('.hh__cv').scrollIntoViewIfNeeded();
    await settle(page);
    // The pointer over a dot of the swarm: its tooltip and ring show.
    const shown = await page.evaluate(() => {
      const canvas = document.querySelector('.hh__cv');
      const b = canvas.getBoundingClientRect();
      for (let y = b.top + 20; y < b.bottom - 20; y += 3) {
        for (let x = b.left + 10; x < b.right - 10; x += 3) {
          canvas.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: x, clientY: y, pointerType: 'mouse' }));
          if (!document.querySelector('.hh__tip').hidden) return true;
        }
      }
      return false;
    });
    assert.ok(shown, 'a dot under the pointer shows its tooltip');
    // By keys alone (the pointer stays), every factor to its floor and the cut on: the net lies past the swarm's axis.
    for (const id of ['hrrp', 'hacrp', 'hvbp']) {
      await page.locator(`[data-row="${id}"] .st__h`).focus();
      await page.keyboard.press('Home');
    }
    await settle(page);
    const pixels = () => page.evaluate(() => {
      const c = document.querySelector('.hh__cv');
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 7) sum = (sum * 31 + d[i]) % 1000000007;
      return sum;
    });
    assert.equal(await page.evaluate(() => document.querySelector('.hh__tip').hidden), true, 'the tooltip goes as the axis changes');
    // Chrome's first read of a canvas can differ from the next with no paint between: read once to settle it.
    await pixels();
    const drawn = await pixels();
    await page.evaluate(() => document.querySelector('.hh__cv').dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' })));
    assert.equal(await pixels(), drawn, 'no hover ring left to clear when the pointer leaves');
    await assertQuiet(seen, 'the swarm\'s change of axis');
  }));


});

// The what-if's banner on a phone: it takes the peer row's place in the sticky stack while it shows (the peer row scrolls
// with the page, its toggle still at the top), so the stack is no taller than without it; the "Reader-made scenario" line
// scrolls with the page.
for (const [width, height] of [[390, 844], [320, 640]]) {
  describe(`a shared what-if link on a ${width} by ${height} phone`, () => {
    const tabs = useContext(shared, { width, height });
    // The lowest sticky row's bottom once the page is scrolled well down: the header, the peer row or the banner.
    const stack = (page) => page.evaluate(() => {
      window.scrollTo(0, 1600);
      const bottoms = [...document.querySelectorAll('.topbar, [data-peers], .hh__scen')]
        .filter((el) => el.checkVisibility()).map((el) => el.getBoundingClientRect()).filter((r) => r.bottom > 0 && r.top < innerHeight / 2).map((r) => r.bottom);
      return { bottom: Math.max(...bottoms), shared: document.querySelector('.hh__shared')?.getBoundingClientRect().bottom ?? null };
    });

    it('the banner replaces the peer row in the sticky stack, and the reader-made line scrolls away', () => withPage(tabs, { path: `${CUT.path}#whatif&hrrp=0.99`, watched: true }, async (page, { seen }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForSelector('.st__h');
      await page.waitForTimeout(SETTLED_MS);
      assert.deepEqual(await hypo(page).then((s) => [s.banner, s.shared]), [true, true], 'opened on the scenario, reader-made');
      const on = await stack(page);
      assert.ok(on.shared !== null && on.shared <= 0, `the reader-made line scrolls away with the page (${on.shared})`);
      await page.locator('.hh__scen .hh__reset').click();
      await page.waitForTimeout(SETTLED_MS);
      const off = await stack(page);
      assert.ok(on.bottom <= off.bottom + 16, `the sticky stack with the banner (${on.bottom} px) no taller than without it (${off.bottom} px), give or take a line`);
      assert.ok(on.bottom <= height * 0.3, `the sticky stack ${on.bottom} px of ${height}`);
      await assertQuiet(seen, 'a shared what-if link on a phone');
    }));
  });
}

describe('the hospital page\'s parts, at 1280 px', () => {
  const tabs = useContext(shared);
  const EXAMPLE = hospitalPathOf('hub', EXAMPLE_CCN);

  // A glide that runs late (a busy page) is never cut short: the strips rest once every part has arrived. Each glide the
  // toggle starts runs at 40% speed here, as if every part had started late.
  it('the strips\' glide rests only once every part has arrived, however late it runs', () => withPage(tabs, { path: CUT.path, watched: true }, async (page, { seen }) => {
    await page.waitForSelector('[data-strip] svg');
    await page.locator('#whatif').scrollIntoViewIfNeeded();
    await settle(page);
    const s = await page.evaluate(async () => {
      const cut = [];
      document.addEventListener('transitioncancel', (e) => {
        if (e.propertyName === 'transform' && e.target.isConnected && e.target.closest?.('svg.st')) cut.push(e.target.getAttribute('class'));
      }, true);
      const toggle = [...document.querySelectorAll('[data-peer]')].find((b) => !b.disabled && b.getAttribute('aria-pressed') === 'false');
      toggle.click();
      const glides = document.getAnimations().filter((a) => a.effect?.target?.closest?.('svg.st'));
      for (const a of glides) a.playbackRate = 0.4;
      const live = () => document.querySelectorAll('svg.st.st--live').length;
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      await wait(1100);
      const mid = live();
      await wait(1800);
      return { glides: glides.length, mid, end: live(), cut: cut.length };
    });
    assert.ok(s.glides > 0, 'the toggle starts glides');
    assert.ok(s.mid > 0, 'still gliding past the usual length');
    assert.deepEqual([s.end, s.cut], [0, 0], 'rested once every part arrived, none cut short');
    await assertQuiet(seen, 'a late glide');
  }));

  // A part that fails to start (here the what-if's first step, after the swarm and the strips have mounted) leaves no
  // control that does nothing: the page as the server wrote it, with the one quiet line, and the scroll padding sized to
  // its sticky row (no observer of the old page's rows writes their zero heights).
  it('a part that fails to start leaves the page as the server wrote it, with the quiet line and its sticky row measured', () => withPage(tabs, { path: '/about/' }, async (page) => {
    await page.addInitScript(() => {
      const after = Element.prototype.after;
      Element.prototype.after = function (...nodes) {
        if (this.classList?.contains('hh__lede')) throw new Error('the what-if fails to start (a test)');
        return after.apply(this, nodes);
      };
    });
    await visit(page, tabs.base, CUT.path);
    await settle(page);
    await settle(page);
    const s = await page.evaluate(() => {
      const bar = document.querySelector('[data-peers]');
      const row = Math.ceil(bar.firstElementChild.getBoundingClientRect().height + parseFloat(getComputedStyle(bar).borderBottomWidth));
      const root = getComputedStyle(document.documentElement);
      return {
        error: document.querySelector('[data-load-error]').checkVisibility(),
        buttons: [...document.querySelectorAll('[data-peer]')].filter((b) => b.checkVisibility({ visibilityProperty: true })).length,
        handles: document.querySelectorAll('.st__h').length,
        canvas: document.querySelectorAll('.hh__cv').length,
        peersH: root.getPropertyValue('--peers-h').trim() === `${row}px`,
        scenH: ['', '0px'].includes(root.getPropertyValue('--scen-h').trim()),
      };
    });
    assert.deepEqual(s, { error: true, buttons: 0, handles: 0, canvas: 0, peersH: true, scenH: true });
  }));

  // On an axis a what-if widened the swarm's last tick can sit closer to the canvas's edge than half its label: each label
  // is held whole inside the canvas. Every tick label the swarm paints is recorded as painted.
  it('the swarm\'s tick labels stay whole inside its canvas, on the actual axis and one a what-if widened', () => withPage(tabs, { path: '/about/' }, async (page) => {
    await page.addInitScript(() => {
      window.tickLabels = [];
      const fill = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (text, x, ...rest) {
        if (this.canvas.classList.contains('hh__cv') && /^[−+]?\d+%$/.test(text)) {
          const w = this.measureText(text).width;
          const align = this.textAlign;
          const left = align === 'center' ? x - w / 2 : align === 'right' || align === 'end' ? x - w : x;
          window.tickLabels.push({ text, left, right: left + w, width: this.canvas.clientWidth });
        }
        return fill.call(this, text, x, ...rest);
      };
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const hash of ['', '#whatif&hrrp=0.97&hac=1&hvbp=0.98']) {
      await visit(page, tabs.base, `${EXAMPLE}${hash}`);
      await page.waitForSelector('.hh__cv');
      await settle(page);
      const labels = await page.evaluate(() => window.tickLabels);
      assert.ok(labels.length > 0, 'the swarm paints its tick labels');
      const cut = labels.filter((l) => l.left < -0.5 || l.right > l.width + 0.5);
      assert.deepEqual(cut.map((l) => l.text), [], `${hash ? 'the widened axis' : 'the actual axis'}: every label whole`);
    }
  }));

  // The "drag me" hint stands clear of its strip's dots (strips.js hintSpot).
  it('the "drag me" hint covers none of its strip\'s dots', () => withPage(tabs, { path: EXAMPLE, watched: true }, async (page, { seen }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForSelector('.st__hint');
    await page.locator('#whatif').scrollIntoViewIfNeeded();
    await settle(page);
    const s = await page.evaluate(() => {
      const hint = document.querySelector('.st__hint');
      const b = hint.getBoundingClientRect();
      const dots = [...hint.closest('svg').querySelectorAll('.st__d')].filter((d) => {
        const r = d.getBoundingClientRect();
        return r.right > b.left && r.left < b.right && r.bottom > b.top && r.top < b.bottom;
      });
      return { shown: getComputedStyle(hint).opacity !== '0' && b.width > 0, covered: dots.length };
    });
    assert.deepEqual(s, { shown: true, covered: 0 });
    await assertQuiet(seen, 'the drag hint');
  }));
});
