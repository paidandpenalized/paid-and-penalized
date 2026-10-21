// The hospitals asset (generate.js hospitalRows) for a page script: hospitalLoader() gives a script its own loader,
// which fetches once and tries again on the next call after a failure (the top bar's search and the program page's
// table each hold one; the asset's hashed URL lets the second fetch come from the browser's cache). Rows with a bad
// CCN are dropped, and an asset whose hospitalPath isn't a plain site path is refused.
import { CCN } from '../../../engine/js/ccn.js';

const PATH = /^\/[a-z0-9/-]*\/$/;

export function hospitalLoader() {
  let pending = null;
  return (src) => (pending ??= (async () => {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`hospital list: HTTP ${res.status}`);
    const { hospitalPath, rows } = await res.json();
    if (!PATH.test(hospitalPath)) throw new Error('hospital list: bad hospitalPath');
    return { hospitalPath, rows: rows.filter(([ccn]) => CCN.test(ccn)) };
  })().catch((error) => {
    pending = null;
    throw error;
  }));
}
