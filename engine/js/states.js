// The states, DC and Puerto Rico, by postal code: the one table the maps (web/charts/geo.js, at build time) and the
// family search (hub/client/search.js, in the browser) read. Pure and browser-safe: it imports nothing.
// Each row: postal code, Census FIPS code (us-atlas's geometry id) and name, as engine/py/pp_engine/geo.py lists them.
// A territory without a code here (AS, GU, MP, VI) is never drawn.
export const STATES = Object.freeze([
  ['AL', '01', 'Alabama'], ['AK', '02', 'Alaska'], ['AZ', '04', 'Arizona'], ['AR', '05', 'Arkansas'],
  ['CA', '06', 'California'], ['CO', '08', 'Colorado'], ['CT', '09', 'Connecticut'], ['DE', '10', 'Delaware'],
  ['DC', '11', 'District of Columbia'], ['FL', '12', 'Florida'], ['GA', '13', 'Georgia'], ['HI', '15', 'Hawaii'],
  ['ID', '16', 'Idaho'], ['IL', '17', 'Illinois'], ['IN', '18', 'Indiana'], ['IA', '19', 'Iowa'],
  ['KS', '20', 'Kansas'], ['KY', '21', 'Kentucky'], ['LA', '22', 'Louisiana'], ['ME', '23', 'Maine'],
  ['MD', '24', 'Maryland'], ['MA', '25', 'Massachusetts'], ['MI', '26', 'Michigan'], ['MN', '27', 'Minnesota'],
  ['MS', '28', 'Mississippi'], ['MO', '29', 'Missouri'], ['MT', '30', 'Montana'], ['NE', '31', 'Nebraska'],
  ['NV', '32', 'Nevada'], ['NH', '33', 'New Hampshire'], ['NJ', '34', 'New Jersey'], ['NM', '35', 'New Mexico'],
  ['NY', '36', 'New York'], ['NC', '37', 'North Carolina'], ['ND', '38', 'North Dakota'], ['OH', '39', 'Ohio'],
  ['OK', '40', 'Oklahoma'], ['OR', '41', 'Oregon'], ['PA', '42', 'Pennsylvania'], ['RI', '44', 'Rhode Island'],
  ['SC', '45', 'South Carolina'], ['SD', '46', 'South Dakota'], ['TN', '47', 'Tennessee'], ['TX', '48', 'Texas'],
  ['UT', '49', 'Utah'], ['VT', '50', 'Vermont'], ['VA', '51', 'Virginia'], ['WA', '53', 'Washington'],
  ['WV', '54', 'West Virginia'], ['WI', '55', 'Wisconsin'], ['WY', '56', 'Wyoming'], ['PR', '72', 'Puerto Rico'],
]);
export const STATE_NAMES = Object.freeze(Object.fromEntries(STATES.map(([code, , name]) => [code, name])));

// The fifty states and DC: the places the US map draws and the family search lists as states (geoAlbersUsa has no place
// for Puerto Rico, which hospitals are in but which is not one of the states).
export const US_STATES = Object.freeze(STATES.filter(([code]) => code !== 'PR'));
