// The roll call's own words that both the build (history-figures.js) and the program page's picker
// (client/roll-picker.js) draw with, so a state's redrawn grid reads like the national one.
import { count } from '../../../web/render/format.js';
import { everBrackets } from '../../../web/charts/rollCall.js';
import { fill } from './explore/copy.js';

// The brackets under a roll call of n hospitals, ever of them ever cut: those ever cut, then those never cut (none when
// every hospital is on one side).
export const rollBrackets = (n, ever) => everBrackets(n, ever, { ever: (k) => fill('rollEver', { n: count(k) }), never: (k) => fill('rollNever', { n: count(k) }) });
