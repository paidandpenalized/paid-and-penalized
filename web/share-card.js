// The share cards: the image a link to a page shows where it is shared (Open Graph, and X's large-image card, which
// reads the same image). The family's card for the family's own pages (the hub's), a program site's own card for its
// pages. Each is a PNG at web/og/<id>.png, CARD_SIZE, drawn by tools/og/ (npm run og renders tools/og/card.js's HTML in
// Chrome) and committed, since the build runs with no browser; the build copies it under a content-hashed name
// (pipeline/site/assets.js), so a link preview's cache fetches a changed card anew.
import { typeset } from './render/components.js';
import { SITE, programById, siteOf } from './site.js';

export const CARD_SIZE = Object.freeze({ width: 1200, height: 630 });
// A card's committed PNG, repo-relative, and the stamp beside them (tools/og/render.js writes both).
export const cardFile = (id) => `web/og/${id}.png`;
export const CARD_STAMP = 'web/og/stamp.json';

// Each card by id, with its alt text: what the card shows, in words. The card holds no numbers, so neither does this.
export const SHARE_CARDS = Object.freeze({
  family: typeset(`${SITE.name}: a map of U.S. hospitals, each a dot, red where Medicare's quality programs cut its pay on net, green where they raised it, gray where neither or where the site has no estimate.`),
  hacrp: typeset(`${SITE.name}, ${SITE.sites.hacrp.title}: a map of U.S. hospitals, each a dot, red where Medicare's ${programById('hacrp').long} cut its pay, gray elsewhere.`),
});

// The card a page's links show, by the page's path: its site's own card when it has one, else the family's.
export function shareCardOf(path) {
  const site = siteOf(path);
  const id = Object.keys(SITE.sites).find((key) => SITE.sites[key] === site);
  return id !== undefined && Object.hasOwn(SHARE_CARDS, id) ? id : 'family';
}
