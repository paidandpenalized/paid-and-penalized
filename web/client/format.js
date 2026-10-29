// The browser's number formats: the build's own (web/render/format.js), so a figure reads the same in the page and in
// the script that redraws it. Re-exported, never copied, so the two cannot drift. A true minus, K/M/B for dollars.
import { count, factor, money, pct as percent } from '../render/format.js';

export { count, factor, money };

// The build's pct with two decimals by default, which is the only reason it is wrapped (a hospital's net is a fraction of
// a percent of its pay): pct(-0.0053) is "−0.53%". sign: + before a positive share, never before one that reads 0.
export const pct = (fraction, dp = 2, options) => percent(fraction, dp, options);
