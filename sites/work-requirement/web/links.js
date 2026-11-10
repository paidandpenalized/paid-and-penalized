// Where the work-requirement site's pages live. No dependencies beyond the site's settings, so the browser's scripts can
// build a link with it.
import { programById } from '../../../web/site.js';

export const PROGRAM_PATH = programById('work-requirement').path;
export const METHODS_PATH = `${PROGRAM_PATH}methods/`;
