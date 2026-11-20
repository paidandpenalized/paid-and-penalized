// The work-requirement pages' shared parts: the family shell's fields (the site's stylesheet, the Work requirement tab
// and the section menu: the program page's five steps, then Methods), the program page's Find in the bar, and the as-of
// line both pages close on.
import { COPY as SHARED } from '../../../../web/copy.js';
import { asofBar } from '../../../../web/render/components.js';
import { isoDate, pct } from '../../../../web/render/format.js';
import { searchForm } from '../../../../web/render/shell.js';
import { FORM_NAMES, SECTIONS } from '../constants.js';
import { fill, fillKeep, t } from '../copy.js';
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

// The pinned inputs the as-of line dates, found among the scenario file's pins (data.js loadMedicaid's pins): the cost
// reports' cells (their CMS file's date is the HCRIS zip's Last-Modified), CMS-64's new adult group spending (the
// dataset's modified date) and Urban's state table (the day it was copied: the report carries a month, not a date).
// Throws when one is missing, so a renamed pin can't drop a line silently. table: the appendix table Urban's pin title
// names (the as-of line and Methods' cases section both give it); throws when the title names none.
export function asOfPins(data) {
  const find = (what, test) => {
    const pin = data.pins.find(test);
    if (!pin) throw new RangeError(`work requirement: no ${what} among the scenario file's pins`);
    return pin;
  };
  const declines = find('Urban table', (p) => p.id.startsWith('urban-'));
  const table = /Appendix Table (A\.\d+)/.exec(declines.title)?.[1];
  if (!table) throw new RangeError(`work requirement: the Urban pin's title names no appendix table: ${declines.title}`);
  return {
    cells: find('cost report cells', (p) => p.id === `hcris-fy${data.meta.fy}-cells`),
    spend: find('CMS-64 new adult group file', (p) => p.id.startsWith('cms64-viii')),
    declines,
    table,
  };
}

// The as-of line (the family's as-of bar, components.js asofBar): each data source and its date (the Medicare penalty
// estimates': the day their file last changed). data: loadMedicaid()'s.
export function asOf(data) {
  const { cells, spend, declines, table } = asOfPins(data);
  return asofBar({
    label: t('asofHeading'),
    grid: true,
    items: [
      { label: t('asofCostLabel'), value: fillKeep('asofCost', { fy: String(data.meta.fy), date: isoDate(cells.derivedFrom.lastModified), settled: pct(data.meta.hcris.settled_share, 0) }, ['date']) },
      { label: t('asofSpendLabel'), value: fillKeep('asofSpend', { form: FORM_NAMES.spendForm, fy: String(data.meta.fy), date: isoDate(spend.datasetModified) }, ['date']) },
      { label: t('asofDeclinesLabel'), value: fillKeep('asofDeclines', { table, date: isoDate(declines.retrieved) }, ['date']) },
      { label: t('asofPenaltiesLabel'), value: fillKeep('asofPenalties', { fy: String(data.meta.penaltyFy), date: isoDate(data.meta.penaltiesChanged) }, ['date']) },
      { label: t('asofChangedLabel'), value: fillKeep('asofChanged', { date: isoDate(data.meta.changed) }, ['date']) },
    ],
  });
}
