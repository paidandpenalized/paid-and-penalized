// The Census Bureau's nine divisions, the regions CMS prices TEAM by (web/charts/divisionMap.js and the TEAM program page
// and its script read them). Pure and browser-safe: it imports nothing. A module of its own, apart from states.js, so the
// family's bundles that read the states table (the search, the maps) don't carry it.

// The divisions numbered 1 to 9 in the Census Bureau's order (a division's number is its index plus one), each with its
// states and DC by postal code: engine/py/pp_engine/geo.py DIVISIONS, which a test holds this to. A territory is in none.
export const DIVISIONS = Object.freeze([
  ['New England', ['CT', 'ME', 'MA', 'NH', 'RI', 'VT']],
  ['Middle Atlantic', ['NJ', 'NY', 'PA']],
  ['East North Central', ['IL', 'IN', 'MI', 'OH', 'WI']],
  ['West North Central', ['IA', 'KS', 'MN', 'MO', 'NE', 'ND', 'SD']],
  ['South Atlantic', ['DE', 'DC', 'FL', 'GA', 'MD', 'NC', 'SC', 'VA', 'WV']],
  ['East South Central', ['AL', 'KY', 'MS', 'TN']],
  ['West South Central', ['AR', 'LA', 'OK', 'TX']],
  ['Mountain', ['AZ', 'CO', 'ID', 'MT', 'NV', 'NM', 'UT', 'WY']],
  ['Pacific', ['AK', 'CA', 'HI', 'OR', 'WA']],
].map(([name, codes]) => Object.freeze([name, Object.freeze(codes)])));

// A state's (or DC's) division number, 1 to 9; null for a code in none (a territory).
const DIVISION_OF = new Map(DIVISIONS.flatMap(([, codes], i) => codes.map((code) => [code, i + 1])));
export const divisionOf = (code) => DIVISION_OF.get(code) ?? null;
