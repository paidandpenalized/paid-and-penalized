// The Readmissions program page's browser script, one feature to a file: the hero's search (client/search.js) and Worksheet
// R's hospital box (client/worksheet.js). Each is progressive: without this script the page shows the default view whole.
// The Map Part's switch, dots and pager (client/map.js). Later features (Step 2's condition switch) mount here the same way.
import { mountMap } from './map.js';
import { mountSearch } from './search.js';
import { mountWorksheet } from './worksheet.js';

mountSearch();
mountWorksheet();
mountMap();
