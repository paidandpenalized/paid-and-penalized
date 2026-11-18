// A distance in miles as the nearest-hospitals figures print it (HACRP's hospital page and the hub's page of a hospital
// outside the programs): in words, for a caption, takeaway or tooltip, and in a table's column of miles. The words are
// web/copy.js's.
import { COPY } from '../copy.js';
import { fillCopy } from './components.js';
import { count, noun } from './format.js';

// "less than a mile" under one, "about a mile" for one when rounded, whole miles ("3 miles") otherwise.
export const milesText = (x) => (x < 1 ? COPY.milesUnder : Math.round(x) === 1 ? COPY.milesAbout : noun(Math.round(x), 'mile'));

// Whole miles, "under 1" for a place under a mile away (never "0").
export const milesCell = (x) => (x < 1 ? fillCopy(COPY, 'milesUnderCell', { one: count(1) }) : count(Math.round(x)));
