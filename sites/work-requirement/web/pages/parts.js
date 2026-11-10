// The work-requirement pages' shared parts: the family shell's fields (the site's stylesheet, the Work requirement tab
// and the section menu: the program page's five steps, then Methods) and the program page's Find in the bar.
import { COPY as SHARED } from '../../../../web/copy.js';
import { searchForm } from '../../../../web/render/shell.js';
import { SECTIONS } from '../constants.js';
import { t } from '../copy.js';
import { METHODS_PATH, PROGRAM_PATH } from '../links.js';

// A step's label (its heading and its entry in the section menu), by its id.
export const labelOf = (id) => t(`nav${id[0].toUpperCase()}${id.slice(1)}`);

const SECTION_MENU = Object.freeze([
  ...SECTIONS.map((id) => ({ id, label: labelOf(id), href: `${PROGRAM_PATH}#${id}` })),
  { id: 'methods', label: SHARED.methods, href: METHODS_PATH },
]);

// The family shell's fields for a work-requirement page (layout.js page()). current: the section to mark (an id), or null.
export const shellOf = ({ current = null } = {}) => ({ sheets: ['work-requirement'], program: 'work-requirement', sections: SECTION_MENU, current });

// The bar's search box (render/shell.js searchForm, id "omni", which the phone's find button opens) over the strips' rows
// (src), which client/find.js mounts: a pick sets the page's hospital.
export const searchBox = (src) => searchForm({
  id: 'omni', src, label: t('searchHeading'), find: t('searchFind'), findRest: t('searchFindRest'), placeholder: t('searchPlaceholder'),
});
