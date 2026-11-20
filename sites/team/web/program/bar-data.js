// Part 4's arithmetic on the regional prices, shared by the build (program/bar.js) and the page's script (client/bar.js),
// so the map the server draws and the one the script redraws agree. Pure and light: no map code, no copy.
import { DIVISIONS } from '../../../../engine/js/divisions.js';

// The divisions' numbers, 1 to 9, in the Census Bureau's order.
export const DIVISION_NUMBERS = Object.freeze(DIVISIONS.map((_, i) => i + 1));
export const divisionName = (div) => DIVISIONS[div - 1][0];

// The lowest-priced and the highest-priced division of { div: price } (the first in census order on a tie).
export function extremes(values) {
  let [lo, hi] = [DIVISION_NUMBERS[0], DIVISION_NUMBERS[0]];
  for (const div of DIVISION_NUMBERS) {
    if (values[div] < values[lo]) lo = div;
    if (values[div] > values[hi]) hi = div;
  }
  return { lo, hi };
}
