// npm run og: draws each share card (web/share-card.js) from its HTML (card.js) in the installed Google Chrome as
// card.js's RENDER says (CARD_SIZE, one device pixel per CSS pixel), and writes web/og/<id>.png and web/og/stamp.json: each card's sha256 of
// its HTML and of its PNG. A test fails when a card's HTML no longer matches its stamp (the data, the tokens it reads, the
// fonts, the design or RENDER changed) or the PNG is not the one drawn. Commit the PNGs and the stamp: the build copies the PNGs and
// runs with no browser. Refuses to write anything if a font fails to load or any line runs past its box.
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { REPO_ROOT, isMain } from '../../pipeline/files.js';
import { CARD_STAMP, SHARE_CARDS, cardFile } from '../../web/share-card.js';
import { sha256 } from '../../pipeline/site/assets.js';
import { CARD_FONTS, RENDER, cardHtml, cardInputs } from './card.js';

// The problems with a drawn card, as strings (none: []): a face that did not load, and a line of words (each as wide
// as its text) that runs into the map's gutter or the bottom rule's.
async function problemsOf(page) {
  const missing = await page.evaluate(async (fonts) => {
    // document.fonts.check() is true even for a face that never loaded, so require a loaded face for each one used.
    await Promise.allSettled(fonts.map(([family, weight]) => document.fonts.load(`${weight} 20px "${family}"`)));
    const loaded = [...document.fonts].filter((f) => f.status === 'loaded');
    return fonts.filter(([family, weight]) => !loaded.some((f) => f.family.replace(/["']/g, '') === family && String(f.weight) === weight))
      .map((f) => `font ${f.join(' ')} did not load`);
  }, Object.values(CARD_FONTS));
  const overflow = await page.evaluate(() => {
    const map = document.querySelector('.mapbox').getBoundingClientRect();
    const floor = document.querySelector('.dbl--bottom').getBoundingClientRect().top - 16;
    return [...document.querySelectorAll('[data-fit]')].filter((el) => {
      const box = el.getBoundingClientRect();
      return box.right > map.left - 24 || box.bottom > floor;
    }).map((el) => `"${el.textContent.trim()}" runs past its box`);
  });
  return [...missing, ...overflow];
}

export async function renderCards() {
  const inputs = cardInputs();
  const browser = await chromium.launch({ channel: 'chrome' });
  const drawn = [];
  try {
    const page = await browser.newPage({ viewport: RENDER.viewport, deviceScaleFactor: RENDER.deviceScaleFactor, colorScheme: RENDER.colorScheme });
    for (const id of Object.keys(SHARE_CARDS)) {
      const html = cardHtml(id, inputs);
      await page.setContent(html, { waitUntil: 'load' });
      const problems = await problemsOf(page);
      if (problems.length) throw new Error(`share card "${id}": ${problems.join('; ')}; nothing written`);
      drawn.push({ id, html, png: await page.screenshot({ type: 'png', clip: RENDER.clip }) });
    }
  } finally {
    await browser.close();
  }
  // Written only once every card has drawn cleanly, so a failure leaves the committed cards and stamp as they were.
  const stamp = {};
  for (const { id, html, png } of drawn) {
    writeFileSync(REPO_ROOT + cardFile(id), png);
    stamp[id] = { html: sha256(html), png: sha256(png) };
  }
  writeFileSync(REPO_ROOT + CARD_STAMP, `${JSON.stringify(stamp, null, 2)}\n`);
  return drawn;
}

if (isMain(import.meta.url)) {
  for (const { id, png } of await renderCards()) console.log(`${cardFile(id)}: ${png.length} bytes`);
  console.log(`and ${CARD_STAMP}; commit them with the change that moved them`);
}
