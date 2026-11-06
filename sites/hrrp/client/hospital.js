// The Readmissions hospital page's browser script, one feature to a file; each is progressive (without it the page shows whole).
import { mountNeighbors } from './neighbors.js';
import { mountWhatIf } from './whatif.js';

mountWhatIf();
mountNeighbors();
