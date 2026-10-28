// A hospital's page across the programs, live (hub/client/hospital.js), in a real browser: the swarm draws, the peer
// toggle restates the page for each group (the headline, the group's name and count, the table) and moves the dollar
// rows' median ticks, each program row gets its strip with the hospital ringed, the peer table fills alphabetically when
// opened, a toggle the hospital has no group for is disabled with its reason, and nothing goes wrong on the page; without
// the data the page stays as the server wrote it, with one quiet line. Runs against dist/ (make build) or any URL.
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
