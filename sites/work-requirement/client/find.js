// The masthead's Find on the program page, and the page's hospital. The bar's search box (web/render/shell.js searchForm,
// over the strips' asset) lists the file's hospitals by name, city, state or CCN; typing lights the matches' dots in the
// strips, and a pick makes the hospital the page's, in place of opening its page. A ?h=<CCN> on arrival sets it too, when
// it is a well-formed CCN the file has, or one the hub has a page for that the file leaves out (step 4 says why it has no
// scenario); anything else is ignored, and the page opens on a random hospital drawn in the strips outside
// DEFAULT_SKIP_STATE. The pure parts are exported for the tests.
import { followedCcn } from '../../../web/client/follow.js';
import { mountOmnibox } from '../../../web/client/omnibox.js';
import { buildIndex, search } from '../../../web/client/search.js';
import { count, placeText } from '../../../web/render/format.js';
import { fill, t } from '../web/copy.js';
import { PROGRAM_PATH } from '../web/links.js';

// The hospital a query string names (?h=, as the family reads it: the first h, six digits or letters, either case) when
// the file has it, else null. byCcn: the rows by CCN.
export const pageHospital = (query, byCcn) => {
  const ccn = followedCcn(query, (c) => byCcn.has(c));
  return ccn === null ? null : byCcn.get(ccn);
};

// The hospitals a page may open on: drawn in the strips, outside DEFAULT_SKIP_STATE (web/program/hospital.js, which step
// 4's random pick shares).
export { defaultPool } from '../web/program/hospital.js';

// The search entries: every hospital in the file, its href this page with it as ?h= (what a pick sets).
export const findEntries = (rows) => rows.map(({ ccn, name, city, state }) => ({
  type: 'hospital', key: ccn, label: name, sub: placeText({ city, state }), extra: [city, state].filter(Boolean).join(' '), href: `${PROGRAM_PATH}?h=${ccn}`,
}));

const words = {
  empty: t('searchEmpty'),
  kind: { hospital: t('searchKindHospital') },
  count: (n) => (n === 0 ? t('searchEmpty') : n === 1 ? t('searchCountOne') : fill('searchCount', { n: count(n) })),
  failed: t('searchFailed'),
  more: null,
};

// Mounts the Find on form. rows: the strips' rows; onLit(ccns or null): the hospitals the words typed match (null when
// the box is empty or a hospital was picked); onPick(row): a hospital picked. The box then shows its name.
export function mountFind(form, { rows, onLit, onPick }) {
  const byCcn = new Map(rows.map((r) => [r.ccn, r]));
  const index = buildIndex(findEntries(rows));
  const input = form.querySelector('[role="combobox"]');
  mountOmnibox(form, {
    load: () => Promise.resolve(index),
    words,
    types: ['hospital'],
    open: (href) => {
      const row = pageHospital(new URL(href, window.location.href).search, byCcn);
      if (!row) return;
      input.value = row.name;
      onLit(null);
      onPick(row);
    },
  });
  let queued = false;
  input.addEventListener('input', () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      const q = input.value.trim();
      onLit(q ? new Set(search(q, index, { limit: Infinity, types: ['hospital'] }).results.map((e) => e.key)) : null);
    });
  });
}
