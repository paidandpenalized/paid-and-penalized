// The data behind Worksheet R's hospital box: every hospital's worksheet inputs, as one content-hashed asset the page's
// script loads when a hospital is picked (never in the page's HTML). The browser rebuilds the same row objects and runs
// worksheet.js on them, so a swapped sheet is the code the server's is. Pure.
import { CCN } from '../../../../engine/js/ccn.js';
import { CONDS } from '../../../../engine/js/hrrp/formula.js';
import { byId } from '../numbers.js';

// One hospital's row: [id, name, city, state, peer, dual share, CMS factor, modeled dollars or null, conditions], the
// conditions in CONDS order, each [cases, ratio, payment weight, flag] or null for a condition the hospital lacks.
export const sheetRow = (h) => [h.id, h.name, h.city, h.st, h.peer, h.dual, h.paf, h.pen ?? null,
  CONDS.map((k) => (h.c[k] ? [h.c[k].n, h.c[k].err, h.c[k].ratio ?? null, h.c[k].flag ?? null] : null))];

// The hospital object worksheetRows() reads, from a row.
export function hospitalOf([id, name, city, st, peer, dual, paf, pen, conds]) {
  const c = {};
  CONDS.forEach((k, i) => { if (conds[i]) c[k] = { n: conds[i][0], err: conds[i][1], ratio: conds[i][2], flag: conds[i][3] }; });
  return { id, name, city, st, peer, dual, paf, pen, c };
}

// hospitals: the file's rows; meta: its meta (nm and the peers' medians, all worksheetRows needs of it).
export const worksheetAsset = (hospitals, meta) => ({
  conds: CONDS,
  meta: { nm: meta.nm, peerMedians: meta.peerMedians },
  rows: hospitals.map(sheetRow).sort((a, b) => byId(a[0], b[0])),
});

// Worksheet R's pick, kept in the program page's own URL so a reload (Back, when the browser keeps no copy of the page) shows
// the same hospital: a part "ws=<CCN>" of the fragment, beside any other part ("&" between parts). The CCN in the fragment, or
// null when it names none.
export function pickFromHash(hash) {
  for (const part of String(hash ?? '').replace(/^#/, '').split('&')) {
    const m = /^ws=([0-9A-Za-z]{6})$/.exec(part);
    if (m && CCN.test(m[1].toUpperCase())) return m[1].toUpperCase();
  }
  return null;
}

// The fragment with its ws= part set to this CCN (or removed for null); every other key=value part is kept. A bare
// anchor (#how) is dropped: joined to a ws= part it would name no element, and the reader is at the worksheet by now.
export function withPick(hash, ccn) {
  const parts = String(hash ?? '').replace(/^#/, '').split('&').filter((p) => p.includes('=') && !/^ws=/.test(p));
  if (ccn) parts.push(`ws=${ccn.toUpperCase()}`);
  return parts.length ? `#${parts.join('&')}` : '';
}
