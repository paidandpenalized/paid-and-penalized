// A place page's scripts: its hospital table (client/table.js, the place's hospitals only), the score rule's names,
// and its map's dots, which open their hospitals' pages.
import { hospitalLoader } from './hospitals.js';
import { mountPlaceMaps, mountRule } from './explore.js';
import { startTable } from './table.js';

const hospitals = hospitalLoader();
startTable(hospitals);
for (const fig of document.querySelectorAll('.rulefig[data-src]')) mountRule(fig, () => hospitals(fig.dataset.src));
mountPlaceMaps();
