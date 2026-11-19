// The family search's file (names and places), fetched once for the page: Part 1's lookup and Part 5's calculator both
// read it, and a second fetch of the same file would be a second request. Kept per document, so a page (or a test's
// stand-in page) starts with none. src: its address (a site asset).
import { fetchAsset } from '../../../web/client/fetch-asset.js';
import { once } from '../../../web/client/once.js';

const kept = new WeakMap();
export function loadSearch(src) {
  if (!kept.has(document)) kept.set(document, once((from) => fetchAsset(from, 'search')));
  return kept.get(document)(src);
}
