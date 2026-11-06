// The Readmissions program page's browser script, one feature to a file; each is progressive (without it the page shows whole).
import { mountMap } from './map.js';
import { mountHospitalTables } from './place-tables.js';
import { mountSearch } from './search.js';
import { mountSwarm } from './swarm.js';
import { mountWorksheet } from './worksheet.js';

mountSearch();
mountWorksheet();
mountMap();
mountSwarm();
mountHospitalTables();
