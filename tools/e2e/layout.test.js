// Layout facts a reader sees at a glance, in a real browser at 1280 px (light): a hospital page with scripts off offers no
// what-if it cannot run.
// Pages are picked by type (site.js), never named. Runs against dist/ (make build) or any URL; see site.js.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { useBrowser, useContext, withPage } from './lib.js';
import { samplePages } from './site.js';

const shared = useBrowser();
const PAGES = samplePages();
const ofType = (type) => PAGES.find((p) => p.type === type);

describe('a hospital page with scripts off', () => {
  const tabs = useContext(shared, { javaScript: false });
  it('offers no what-if it cannot run: no button to it, the section headed by what it shows, what needs JavaScript said', () => withPage(tabs, { path: ofType('hub-hospital-cut').path }, async (page) => {
    const s = await page.evaluate(() => ({
      button: document.querySelector('.hh__wbtn').checkVisibility(),
      heading: document.getElementById('whatif-h').innerText.trim(),
      kicker: document.querySelector('.hh__sechead .kicker').checkVisibility(),
      lines: [...document.querySelectorAll('.hh__noscript')].filter((p) => p.checkVisibility()).length,
    }));
    assert.deepEqual(s, { button: false, heading: 'Every program, among its peers', kicker: false, lines: 2 });
  }));
});
