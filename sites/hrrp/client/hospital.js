// The Readmissions hospital page's browser script, one feature to a file; each is progressive (without it the page shows whole). It carries the top bar's search too.
import { mountNeighbors } from './neighbors.js';
import { mountSearch } from './search.js';
import { mountWhatIf } from './whatif.js';

mountSearch();
mountWhatIf();
mountNeighbors();
