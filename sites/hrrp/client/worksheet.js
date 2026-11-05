// Worksheet R's hospital box (Step 5): pick a hospital and the sheet below is worked out again in the browser, by the
// same code as the server's (worksheet.js), from the worksheet asset (figures/worksheet-data.js), which is fetched when
// the first hospital is picked. Without this script the example hospital's sheet stays as the page was built.
import { buildIndex } from '../../../web/client/search.js';
import { mountOmnibox } from '../../../web/client/omnibox.js';
import { once } from '../../../web/client/once.js';
import { CCN } from '../../../engine/js/ccn.js';
import { fill } from '../web/program/copy.js';
import { hospitalOf } from '../web/figures/worksheet-data.js';
import { estimateTag } from '../web/pages/parts.js';
import { worksheetHtml, worksheetRows } from '../web/worksheet.js';
import { hospitalEntries, searchWords } from './search.js';
import { loadHospitals } from './hospitals.js';

const loadSheets = once(async (src) => {
  const res = await fetch(src);
  if (!res.ok) throw new Error(`worksheet data: HTTP ${res.status}`);
  const { meta, rows } = await res.json();
  return { meta, rows: new Map(rows.filter((r) => CCN.test(r[0])).map((r) => [r[0].toLowerCase(), r])) };
});

// The sheet for the hospital with this CCN, as markup: worksheetHtml over worksheetRows, the sheet the page was built with.
// The title bar's right side and the dollars line's words are read from the sheet already on the page.
export function sheetFor(data, ccn, { edition, conditions, payShort }) {
  const row = data.rows.get(ccn.toLowerCase());
  if (!row) return null;
  const rows = worksheetRows(hospitalOf(row), data.meta);
  return worksheetHtml(rows, { edition, conditions, dollars: { payShort, tag: estimateTag } }).text;
}

export function mountWorksheet() {
  const form = document.querySelector('form.omni#ws-pick');
  const holder = document.querySelector('.wsr-holder[data-src]');
  if (!form || !holder) return;
  const context = JSON.parse(holder.dataset.context);
  const status = document.createElement('p');
  status.className = 'wsr-pick__status small muted';
  status.hidden = true;
  status.setAttribute('role', 'status');
  form.after(status);
  const load = once((src) => loadHospitals(src).then((data) => buildIndex(hospitalEntries(data))));
  const pick = async (href) => {
    const ccn = href.replace(/\/$/, '').split('/').pop();
    try {
      const html = sheetFor(await loadSheets(holder.dataset.src), ccn, context);
      if (html) {
        holder.innerHTML = html; // markup from worksheetHtml, which escapes every value it writes
        status.hidden = true;
      }
    } catch {
      status.textContent = fill('wsPickFailed');
      status.hidden = false;
    }
  };
  mountOmnibox(form, { load: () => load(form.dataset.src), words: searchWords(), open: pick });
}
