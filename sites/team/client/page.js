// The TEAM program page's script (the page loads it after the figures' own, web/client/figure.js). Each Part that acts
// in the browser mounts here: Part 1's lookup (lookup.js) and Part 4's picker of episode types (bar.js). Without this
// script every Part shows what the build drew.
import { mountBar } from './bar.js';
import { mountLookup } from './lookup.js';

mountLookup(document.querySelector('[data-team-lookup]'));
mountBar();
