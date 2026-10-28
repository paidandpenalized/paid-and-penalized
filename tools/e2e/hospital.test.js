// A hospital's page across the programs, live (hub/client/hospital.js), in a real browser: the swarm draws, the peer
// toggle restates the page for each group (the headline, the group's name and count, the table) and moves the dollar
// rows' median ticks, each program row gets its strip with the hospital ringed, the peer table fills alphabetically when
// opened, a toggle the hospital has no group for is disabled with its reason, and nothing goes wrong on the page; without
// the data the page stays as the server wrote it, with one quiet line. The factor what-if: a handle stepped by keyboard
// or dragged marks the page hypothetical everywhere (the banner, the stamp, the struck actuals, the ghost rings, the
// fragment) and Escape or Reset puts it back; a shared link with a valid changed scenario opens on it under "Reader-made
// scenario", one with junk opens on the actual figures. Runs against dist/ (make build) or any URL.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadHub } from '../../hub/data.js';
import { hubHospitals } from '../../hub/model.js';
import { hospitalPathOf } from '../../web/site.js';
import { audit } from './axe.js';
import { CONCURRENCY, assertQuiet, settle, useBrowser, useContext, withPage } from './lib.js';
import { samplePages } from './site.js';

const shared = useBrowser();
const CUT = samplePages().find((p) => p.type === 'hub-hospital-cut');
// A hospital with an estimate and no teaching status on record, picked by property.
const NO_TEACH = hubHospitals(loadHub()).find((h) => h.est && h.teach === null);
// By property, for the what-if's edges: the hospital with the highest value-based purchasing factor in the data (its own
// factor sits past the range's four-decimal end), and the one in both factor programs whose base is the largest share of
// its pay (its hypothetical figures reach furthest past every actual one on the share axis).
const ESTIMATED = hubHospitals(loadHub()).filter((h) => h.est);
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
      await page.keyboard.press('Shift+ArrowRight');
      if ((await now()) === start) await page.keyboard.press('Shift+ArrowLeft');
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
      const box = await handle.locator('.st__hb').boundingBox();
      const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
      await page.mouse.move(x, y);
      await page.mouse.down();
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
      await page.goto(new URL('/about/', page.url()).href, { waitUntil: 'networkidle' });
      await page.goto(new URL(`${CUT.path}#whatif&hrrp=2&hvbp=abc&hac=7`, page.url()).href, { waitUntil: 'networkidle' });
      await page.waitForSelector('.st__h');
      await page.waitForTimeout(SETTLED_MS);
      const junk = await hypo(page);
      assert.deepEqual([junk.banner, junk.shared, junk.struck], [false, false, 0], 'junk changes nothing');
      await assertQuiet(seen, 'the hospital page from a shared what-if link');
    }));

    it('a focused handle stays clear of the sticky row when the Hypothetical banner makes it taller', () => withPage(tabs, { path: CUT.path, watched: true }, async (page, { seen }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForSelector('.st__h');
      const handle = page.locator('.st__h').first();
      await handle.focus();
      // Park the handle just under the sticky row, as Shift+Tab up into it leaves it.
      await page.evaluate(() => {
        const box = document.activeElement.querySelector('.st__hb').getBoundingClientRect();
        window.scrollBy(0, box.top - document.querySelector('[data-peers]').getBoundingClientRect().bottom - 2);
      });
      const start = await handle.getAttribute('aria-valuenow');
      await page.keyboard.press('ArrowLeft');
      if ((await handle.getAttribute('aria-valuenow')) === start) await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(SETTLED_MS);
      const covered = await page.evaluate(() => {
        const box = document.activeElement.querySelector('.st__hb').getBoundingClientRect();
        const bar = document.querySelector('[data-peers]').getBoundingClientRect();
        return { banner: document.querySelector('[data-peers]').classList.contains('hh__peers--hyp'), px: Math.max(0, Math.min(box.bottom, bar.bottom) - Math.max(box.top, bar.top)), below: box.bottom <= innerHeight };
      });
      assert.deepEqual(covered, { banner: true, px: 0, below: true }, 'the handle in view, none of it under the banner');
      await assertQuiet(seen, 'the hospital page\'s what-if, focus kept in view');
    }));

    it('without its data the page stays as the server wrote it, with one quiet line', () => withPage(tabs, { path: '/about/' }, async (page) => {
      await page.route('**/assets/hub-hospitals.*.json', (route) => route.fulfill({ status: 503, body: '' }));
      await page.goto(new URL(CUT.path, page.url()).href, { waitUntil: 'networkidle' });
      await settle(page);
      const s = await page.evaluate(() => ({
        error: document.querySelector('[data-load-error]').checkVisibility(),
        canvas: document.querySelectorAll('.hh__cv').length,
        buttons: [...document.querySelectorAll('[data-peer]')].filter((b) => b.checkVisibility()).length,
        head: document.querySelector('[data-headline]').checkVisibility(),
      }));
      assert.deepEqual(s, { error: true, canvas: 0, buttons: 0, head: true });
    }));
  });
}

// The what-if's edges, at one width: Home and End go where the slider says its ends are; a drag reaches the range's ends
// and every hypothetical stands on the share axis (none pinned at its end); a drag updates the page once a frame and
// lands its last place on release; the shared link's way back stays on this site.
describe('the what-if\'s edges', () => {
  const tabs = useContext(shared);
  const at = (page, id) => page.locator(`[data-row="${id}"] .st__h`);
  const value = (handle) => handle.getAttribute('aria-valuenow');

  it('Home and End go to the ends the handle states: the highest factor in the data is its own top', () => withPage(tabs, { path: hospitalPathOf('hub', TOP_VBP.ccn), watched: true }, async (page, { seen }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const handle = at(page, 'hvbp');
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
    const handle = at(page, 'hvbp');
    await handle.waitFor();
    await page.locator('[data-row="hvbp"]').scrollIntoViewIfNeeded();
    const drag = async (side) => {
      const box = await handle.locator('.st__hb').boundingBox();
      const strip = await page.locator('[data-row="hvbp"] [data-strip] svg').boundingBox();
      const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(side > 0 ? strip.x + strip.width - 1 : strip.x + 1, y, { steps: 8 });
      await page.mouse.up();
    };
    await drag(1);
    assert.equal(await value(handle), await handle.getAttribute('aria-valuemax'), 'the strip\'s right end: the range\'s top');
    await drag(-1);
    assert.equal(await value(handle), await handle.getAttribute('aria-valuemin'), 'its left end: the bottom');
    // Both factors at their lowest, then the cut on and off: the hypothetical net moves, never pinned at the axis's end.
    await at(page, 'hrrp').focus();
    await page.keyboard.press('Home');
    const net = () => page.evaluate(() => Number(/translate\(([-\d.]+)px/.exec(document.querySelector('[data-row="net"] .st__hyp').style.transform)?.[1]));
    await at(page, 'hacrp').focus();
    await page.keyboard.press('Home');
    const cut = await net();
    await page.keyboard.press('End');
    const none = await net();
    assert.ok(cut < none, `the net with the cut (${cut} px) left of the net without it (${none} px)`);
    await assertQuiet(seen, 'the what-if at its ends');
  }));
});
