// A place page's scripts: its hospital table (client/table.js, the place's hospitals only), the score rule's names,
// its map's dots, which open their hospitals' pages, and its years' grid, which names the hospital under the pointer.
import { hospitalLoader } from './hospitals.js';
import { mountPlaceMaps, mountRoll, mountRule } from './explore.js';
import { startTable } from './table.js';

const hospitals = hospitalLoader();
startTable(hospitals);
for (const fig of document.querySelectorAll('.rulefig[data-src]')) mountRule(fig, () => hospitals(fig.dataset.src));
mountPlaceMaps();
for (const box of document.querySelectorAll('.roll[data-src]')) mountRoll(box.closest('.fig'), { hospitals });
