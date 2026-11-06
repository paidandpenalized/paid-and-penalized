// The two tables at the foot of a place page, as plain data: the places inside it (divisions of a region, states of a division,
// metro areas of a state, none for a metro area) with their summaries, and the area's hospitals, largest cut first. Each has a CSV
// file. A metro area's hospitals are the rows of the hospital pages' area file (neighbors-data.js areaCsvName), so that file is
// linked rather than written a second time; every other place gets a file of its own. Pure.
import { PLACE_KIDS_PAGE_SIZE } from '../constants.js';
import { areaCsvName, sizedRows } from './neighbors-data.js';

// The first column of a child table's CSV, by the kind of place the table is on.
export const KIDS_COLUMN = Object.freeze({ region: 'Division', division: 'State', state: 'Metro area' });

// A place's own CSV name (without folder or extension): what is 'hospitals' or the child kind ('divisions', 'states', 'metros').
export const placeFileName = (fy, place, what) => `hrrp-fy${fy}-place-${place.kind}-${place.key}-${what}`;
const KIDS_FILE = { region: 'divisions', division: 'states', state: 'metros' };

// rows: view.js childRows' result (label, href or null, n, s = summarize's result, nEstimated), largest first; title: the table's
// heading. Returns the rows in pages of PLACE_KIDS_PAGE_SIZE, the CSV's name and its rows, or null with no row.
export function childTable(place, rows, title, meta) {
  if (!rows.length) return null;
  const pages = [];
  for (let i = 0; i < rows.length; i += PLACE_KIDS_PAGE_SIZE) pages.push(rows.slice(i, i + PLACE_KIDS_PAGE_SIZE));
  return {
    title, rows, pages, column: KIDS_COLUMN[place.kind],
    csvName: placeFileName(meta.fy, place, KIDS_FILE[place.kind]), csvRows: rows.map((r) => ({ label: r.label, ...r.s })),
  };
}

// The area's hospitals as table rows (neighbors-data sizedRows), the states it reaches (the state filter shows only with more
// than one), and the CSV: own (this build writes it for the place) or the hospital pages' file for the metro area.
export function hospitalsTable(place, meta) {
  const shared = place.kind === 'metro' && place.hospitals.length > 1;
  return {
    rows: sizedRows(place.hospitals, meta),
    states: place.states,
    spansStates: place.states.length > 1,
    csvName: shared ? areaCsvName(meta.fy, `metro-${place.key}`) : placeFileName(meta.fy, place, 'hospitals'),
    csvOwn: !shared,
  };
}
