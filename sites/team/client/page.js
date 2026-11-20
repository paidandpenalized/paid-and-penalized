// The TEAM program page's script (the page loads it after the figures' own, web/client/figure.js). Each Part that acts
// in the browser mounts here: Part 1's lookup (lookup.js), Part 4's picker of episode types (bar.js) and Part 5's
// calculator (calc.js), mounted last, since a link it arrives with tells Part 4 its hospital's region. Without this
// script every Part shows what the build drew.
import { mountBar } from './bar.js';
import { mountCalc } from './calc.js';
import { mountLookup } from './lookup.js';

mountLookup(document.querySelector('[data-team-lookup]'));
mountBar();
mountCalc(document.getElementById('calc'));
