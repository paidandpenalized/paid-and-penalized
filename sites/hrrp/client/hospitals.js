// The hospitals asset (figures/explore-data.js hospitalsAsset) for the page's scripts: fetched once, and again on the next
// call after a failure. Rows with a bad CCN are dropped; an asset whose hospitalPath or place paths are not the site's own
// is refused. The search box and Worksheet R's box share it.
import { CCN } from '../../../engine/js/ccn.js';
import { once } from '../../../web/client/once.js';
import { KINDS, PROGRAM_PATH } from '../web/links.js';

const PATH = new RegExp(`^${PROGRAM_PATH}[a-z0-9/-]*/$`);

export const loadHospitals = once(async (src) => {
  const res = await fetch(src);
  if (!res.ok) throw new Error(`hospital list: HTTP ${res.status}`);
  const { hospitalPath, fields, rows, places = [] } = await res.json();
  if (!PATH.test(hospitalPath)) throw new Error('hospital list: bad hospitalPath');
  const at = Object.fromEntries(['id', 'name', 'city', 'st', 'zip'].map((k) => [k, fields.indexOf(k)]));
  if (Object.values(at).includes(-1)) throw new Error('hospital list: fields are missing');
  return {
    hospitalPath,
    hospitals: rows.filter((r) => CCN.test(r[at.id])).map((r) => ({ id: r[at.id], name: r[at.name], city: r[at.city], st: r[at.st], zip: r[at.zip] ?? '' })),
    places: places.filter(([kind, , , path]) => KINDS.includes(kind) && PATH.test(path)),
  };
});
