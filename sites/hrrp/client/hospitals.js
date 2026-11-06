// The hospitals asset for the page's scripts, fetched once, and again on the next call after a failure: the search asset
// (figures/explore-data.js hospitalsAsset) on the pages that only search, or the rows asset (figures/place-table-data.js
// placeRowsAsset) on the program and place pages, where the search, Worksheet R's box and the hospitals table all read the one
// file. Rows with a bad CCN are dropped; an asset whose hospitalPath or place paths are not the site's own is refused.
import { CCN } from '../../../engine/js/ccn.js';
import { once } from '../../../web/client/once.js';
import { KINDS, PROGRAM_PATH } from '../web/links.js';
import { byId } from '../web/numbers.js';

const PATH = new RegExp(`^${PROGRAM_PATH}[a-z0-9/-]*/$`);

// The asset's parsed JSON (only /assets/ paths): one fetch for every script that reads it.
export const loadAsset = once(async (src) => {
  if (!src?.startsWith('/assets/')) throw new Error('not a site asset');
  const res = await fetch(src);
  if (!res.ok) throw new Error(`hospital list: HTTP ${res.status}`);
  return res.json();
});

const byNameThenId = (a, b) => a.name.localeCompare(b.name, 'en') || byId(a.id, b.id);

export const loadHospitals = once(async (src) => {
  const { hospitalPath, fields, rows, places = [] } = await loadAsset(src);
  if (!PATH.test(hospitalPath)) throw new Error('hospital list: bad hospitalPath');
  const at = Object.fromEntries(['id', 'name', 'city', 'st', 'zip'].map((k) => [k, fields.indexOf(k)]));
  if (Object.values(at).includes(-1)) throw new Error('hospital list: fields are missing');
  return {
    hospitalPath,
    // In name order, as the search asset comes, whichever asset this is (ties in the search go to the earlier entry).
    hospitals: rows.filter((r) => CCN.test(r[at.id])).map((r) => ({ id: r[at.id], name: r[at.name], city: r[at.city], st: r[at.st], zip: r[at.zip] ?? '' })).sort(byNameThenId),
    places: places.filter(([kind, , , path]) => KINDS.includes(kind) && PATH.test(path)),
  };
});
