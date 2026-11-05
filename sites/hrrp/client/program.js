// The Readmissions program page's browser script, one feature to a file: the hero's search (client/search.js) and Worksheet
// R's hospital box (client/worksheet.js). Each is progressive: without this script the page shows the default view whole.
// The Map Part's switch, dots and pager (client/map.js) and Step 2's condition switch (client/swarm.js). Later features mount here the same way.
import { mountMap } from './map.js';
import { mountSearch } from './search.js';
import { mountSwarm } from './swarm.js';
import { mountWorksheet } from './worksheet.js';

mountSearch();
mountWorksheet();
mountMap();
mountSwarm();
