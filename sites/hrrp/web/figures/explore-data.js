// The numbers behind the program page's "Every hospital" Part, as plain data: the hospitals asset (one row for each
// hospital, written to /assets/hrrp-hospitals.<hash>.json by the build and read by the page's browser script, so the rows
// are never in the page's HTML) and the filter controls' options, read from the same hospitals. Pure.
import { CONDS } from '../../../../engine/js/hrrp/formula.js';
import { BED_BANDS, TEACH_LABEL } from '../../../../engine/js/hrrp/filters.js';
import { PAGE_SIZE } from '../constants.js';
import { conditionShort } from '../derive.js';
import { HOSPITALS_PATH } from '../links.js';
import { STATE_LETTER } from './glyph.js';
import { statesOf } from './neighbors-data.js';
import { byId } from '../numbers.js';

// An asset row's fields, in order. name: the hospital as CMS lists it; alias: its former or other name, or null; red: the
// cut in percent; pen: modeled dollars, or null (no estimate); peer: 1-5; teach: none, minor, major or null; urban: true,
// false or null; paf: the payment adjustment factor; conds: one letter for each condition in program order (CONDS):
// c counted toward the cut, b measured and below the peer median, f too few cases, n none; inactive: 1 when CMS lists the
// hospital's agreement as ended.
export const FIELDS = Object.freeze(['id', 'name', 'alias', 'city', 'st', 'zip', 'red', 'pen', 'peer', 'beds', 'teach', 'urban', 'paf', 'conds', 'inactive']);

const byNameThenId = (a, b) => a[1].localeCompare(b[1], 'en') || byId(a[0], b[0]);

// hospitals: the file's rows; meta: the file's meta; places: the site's places, as [kind, key, name, path, hospitals] (the
// search box finds them). Rows come in the table's first order: name A to Z, then CCN.
export function hospitalsAsset(hospitals, meta, places = []) {
  const rows = hospitals.map((h) => {
    return [h.id, h.name, h.alias ?? null, h.city, h.st, h.zip ?? null, h.red, h.pen ?? null, h.peer, h.beds ?? null, h.teach ?? null, h.urban ?? null, h.paf,
      statesOf(h, meta).map((x) => STATE_LETTER[x]).join(''), h.inactive ? 1 : 0];
  }).sort(byNameThenId);
  return { hospitalPath: HOSPITALS_PATH, fields: FIELDS, conds: CONDS, pageSize: PAGE_SIZE, rows, places };
}

// The sorts the explorer offers (name A to Z first, the rest high to low, blanks last): the key is a FIELDS name.
export const SORTS = Object.freeze([
  { key: 'name', dir: 1, copy: 'exploreSortName' },
  { key: 'red', dir: -1, copy: 'exploreSortCut' },
  { key: 'pen', dir: -1, copy: 'exploreSortDollars' },
  { key: 'beds', dir: -1, copy: 'exploreSortBeds' },
]);

// The filter controls' options, from the hospitals: states (codes, in order), peer groups present, the teaching statuses
// present (in TEACH_LABEL's order) with their labels, the bed bands, the conditions (key and short name) and the page size.
// conditions: the file's [{ key, short }].
export function exploreControls(hospitals, conditions) {
  const states = [...new Set(hospitals.map((h) => h.st))].sort();
  const peers = [...new Set(hospitals.map((h) => h.peer).filter((p) => p != null))].sort((a, b) => a - b);
  const teach = Object.keys(TEACH_LABEL).filter((k) => hospitals.some((h) => h.teach === k)).map((value) => ({ value, label: TEACH_LABEL[value] }));
  return { states, peers, teach, beds: BED_BANDS, conds: CONDS.map((key) => ({ key, short: conditionShort(conditions, key) })), pageSize: PAGE_SIZE, sorts: SORTS };
}
