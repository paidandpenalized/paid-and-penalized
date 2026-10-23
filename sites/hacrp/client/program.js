// The program page's scripts: the hospital table (client/table.js), the explorable figures (client/explore.js, and the
// roll call's state picker, client/roll-picker.js) and the sandbox: the what-if on the median hospital, mounted from
// the page's own data (client/whatif.js), whose share is false: the URL is never read or written by it.
import { hospitalLoader } from './hospitals.js';

const hospitals = hospitalLoader();
import { mountFromPage } from './whatif.js';
import { assetLoaders, exploreLoader, mountAgree, mountHalving, mountMeasureToggles, mountRoll, mountRule, mountYearMap, mountSlideRules, mountSwarm, mountUsMap } from './explore.js';
import { mountStatePicker } from './roll-picker.js';
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
// The roll call and the year map read one history asset, fetched once for both. Only this page's roll call has the
// state picker.
const history = assetLoaders();
for (const fig of figuresWith('.roll')) mountRoll(fig, { hospitals, history, picker: mountStatePicker });
for (const fig of figuresWith('.ymap')) mountYearMap(fig, history);

// The score rule's two views, each hospital alike or each as wide as its dollars at stake: its buttons, the drawing
// and the caption that goes with each.
for (const fig of document.querySelectorAll('.rulefig--views')) {
  const pick = fig.querySelector('.rulefig__pick');
  if (!pick) continue;
  pick.hidden = false;
  pick.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-rule-pick]');
    if (!b) return;
    const view = b.dataset.rulePick;
    for (const x of pick.querySelectorAll('button')) x.setAttribute('aria-pressed', String(x === b));
    for (const v of fig.querySelectorAll('[data-rule-view]')) v.hidden = v.dataset.ruleView !== view;
    for (const c of fig.querySelectorAll('[data-rule-cap]')) c.hidden = c.dataset.ruleCap !== view;
  });
}

// The states' map: its buttons switch which layer of circles shows (the dollars, or the dollars per stay).
for (const box of document.querySelectorAll('.bubbles')) {
  const pick = box.querySelector('.bubbles__pick');
  if (!pick) continue;
  pick.hidden = false;
  pick.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-view-pick]');
    if (!b) return;
    for (const x of pick.querySelectorAll('button')) x.setAttribute('aria-pressed', String(x === b));
    box.dataset.view = b.dataset.viewPick;
  });
}

// After the search and the table, so a fault in the sandbox never takes them with it.
mountFromPage('hacrp-program');
