// The program page's scripts: the hospital table (client/table.js), the explorable figures (client/explore.js) and
// the sandbox: the what-if on the median hospital, mounted from the page's own data (client/whatif.js), whose share
// is false: the URL is never read or written by it.
import { hospitalLoader } from './hospitals.js';

const hospitals = hospitalLoader();
import { mountFromPage } from './whatif.js';
import { exploreLoader, mountAgree, mountHalving, mountMeasureToggles, mountRule, mountSlideRules, mountSwarm, mountUsMap } from './explore.js';
import { placePath } from '../web/place-paths.js';
import { startTable } from './table.js';

startTable(hospitals);

// The explorable figures: measure buttons, the slide rule, the halving button and the score rule's names.
const article = document.querySelector('[data-explore]');
const explore = article ? exploreLoader(article.dataset.explore) : null;
mountMeasureToggles(document, explore);
mountSlideRules();
mountHalving();
for (const fig of document.querySelectorAll('.rulefig[data-src]')) mountRule(fig, () => hospitals(fig.dataset.src));
const searchSrc = document.querySelector('form.omni[data-src]')?.dataset.src;
// Each figure found by its own part (a selector every browser the bundle targets supports).
const figuresWith = (part) => [...document.querySelectorAll(part)].map((el) => el.closest('.fig')).filter(Boolean);
if (explore && searchSrc) for (const fig of figuresWith('.swarm')) mountSwarm(fig, { explore, hospitals, src: searchSrc });
if (explore) for (const fig of figuresWith('.agree')) mountAgree(fig, explore);
for (const fig of figuresWith('.usmap')) mountUsMap(fig, (code) => placePath('state', code));

// After the search and the table, so a fault in the sandbox never takes them with it.
mountFromPage('hacrp-program');
