// The numbers behind the program page's "Every hospital" Part, as plain data: the filter controls' options (read from the
// hospitals), and the hospitals asset the search boxes read (one short row for each hospital, /assets/hrrp-hospitals.<hash>.json).
// The explorer's own rows come from the place pages' rows asset. Pure.
import { CONDS } from '../../../../engine/js/hrrp/formula.js';
import { BED_BANDS, TEACH_LABEL } from '../../../../engine/js/hrrp/filters.js';
import { PAGE_SIZE } from '../constants.js';
import { conditionShort } from '../derive.js';
import { HOSPITALS_PATH, csvPath } from '../links.js';
import { hospitalsCsvName } from '../csv.js';
import { byId } from '../numbers.js';
import { SORT_KEYS } from './place-table-data.js';

// The search asset's row fields, in order (the search box and Worksheet R's box read them). name: the hospital as CMS lists it.
// The explorer's table rows are the place pages' rows asset (place-table-data.js placeRowsAsset), one asset for both.
export const FIELDS = Object.freeze(['id', 'name', 'city', 'st', 'zip']);

const byNameThenId = (a, b) => a[1].localeCompare(b[1], 'en') || byId(a[0], b[0]);

// hospitals: the file's rows; places: the site's places, as [kind, key, name, path, hospitals] (the search box finds them).
// Rows come in name order, then CCN.
export function hospitalsAsset(hospitals, places = []) {
  const rows = hospitals.map((h) => [h.id, h.name, h.city, h.st, h.zip ?? null]).sort(byNameThenId);
  return { hospitalPath: HOSPITALS_PATH, fields: FIELDS, rows, places };
}

// The filter controls' options, from the hospitals: states (codes, in order), peer groups present, the teaching statuses
// present (in TEACH_LABEL's order) with their labels, the bed bands, the conditions (key and short name), the page size and the sorts (name A to Z first, the rest as the place table has them).
// conditions: the file's [{ key, short }]; fy: the edition's year (the full hospitals CSV's folder).
export function exploreControls(hospitals, conditions, fy) {
  const states = [...new Set(hospitals.map((h) => h.st))].sort();
  const peers = [...new Set(hospitals.map((h) => h.peer).filter((p) => p != null))].sort((a, b) => a - b);
  const teach = Object.keys(TEACH_LABEL).filter((k) => hospitals.some((h) => h.teach === k)).map((value) => ({ value, label: TEACH_LABEL[value] }));
  return { states, peers, teach, beds: BED_BANDS, conds: CONDS.map((key) => ({ key, short: conditionShort(conditions, key) })), pageSize: PAGE_SIZE, sorts: ['name', ...SORT_KEYS.filter((k) => k !== 'name')], csvHref: csvPath(fy, hospitalsCsvName(fy)) };
}
