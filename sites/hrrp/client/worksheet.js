// Worksheet R's hospital box (Step 5): pick a hospital and the sheet below is worked out again in the browser, by the
// same code as the server's (worksheet.js), from the worksheet asset (figures/worksheet-data.js), which is fetched when
// the first hospital is picked; Step 5's waterfall, beside the step's words above the sheet (figures/waterfall.js), is drawn again
// from the same rows.
// Without this script the example hospital's sheet and waterfall stay as the page was built.
import { mountFigure, mountScroll, unmountScroll } from '../../../web/client/figure.js';
import { mountOmnibox } from '../../../web/client/omnibox.js';
import { once } from '../../../web/client/once.js';
import { CCN } from '../../../engine/js/ccn.js';
import { fill, t } from '../web/program/copy.js';
import { hospitalOf } from '../web/figures/worksheet-data.js';
import { estimateTag } from '../web/estimate-tag.js';
import { waterfallFigure } from '../web/figures/waterfall.js';
import { worksheetHtml, worksheetRows } from '../web/worksheet.js';
import { loadIndex, searchWords } from './search.js';

const loadSheets = once(async (src) => {
  const res = await fetch(src);
  if (!res.ok) throw new Error(`worksheet data: HTTP ${res.status}`);
  const { meta, rows } = await res.json();
  return { meta, rows: new Map(rows.filter((r) => CCN.test(r[0])).map((r) => [r[0].toLowerCase(), r])) };
});

// The sheet and the waterfall for the hospital with this CCN, as markup: worksheetHtml and waterfallFigure over worksheetRows, the
// ones the page was built with (n: the waterfall's figure number). The title bar's right side and the dollars line's words are read
// from the sheet already on the page. null for a CCN not in the asset.
function sheetFor(data, ccn, { edition, conditions, payShort }, n) {
  const row = data.rows.get(ccn.toLowerCase());
  if (!row) return null;
  const rows = worksheetRows(hospitalOf(row), data.meta);
  return {
    sheet: worksheetHtml(rows, { edition, conditions, dollars: { payShort, tag: estimateTag } }).text,
    waterfall: waterfallFigure({ rows, conditions, n, edition }).text,
  };
}

export function mountWorksheet() {
  const form = document.querySelector('form.omni#ws-pick');
  const holder = document.querySelector('.wsr-holder[data-src]');
  if (!form || !holder) return;
  const context = JSON.parse(holder.dataset.context);
  const waterfall = document.querySelector('.wf-holder');
  const status = document.createElement('p');
  status.className = 'wsr-pick__status small muted';
  status.setAttribute('role', 'status'); // present (and empty) from the start, so a screen reader hears the words put in it
  form.after(status);
  // Cleared first, so the same words said again are announced again.
  const say = (words) => { status.textContent = ''; status.textContent = words; };
  let latest = 0;
  const pick = async (href) => {
    const ccn = href.replace(/\/$/, '').split('/').pop();
    const mine = ++latest;
    try {
      const data = await loadSheets(holder.dataset.src);
      if (mine !== latest) return; // a later pick has come in since: its answer is the one that shows
      const next = sheetFor(data, ccn, context, Number(waterfall?.dataset.figureN));
      if (next) {
        // The scroll boxes about to be replaced stop being watched; the new ones are wired the way the page's were.
        for (const root of [holder, waterfall]) root?.querySelectorAll('.printout__scroll').forEach(unmountScroll);
        holder.innerHTML = next.sheet; // markup from worksheetHtml and figure(), which escape every value they write
        if (waterfall) {
          waterfall.innerHTML = next.waterfall;
          // The figure client wires a figure once at load: wire the new one the same way (tooltips, sort, CSV, scroll box).
          for (const fig of waterfall.querySelectorAll('figure[data-figure]')) mountFigure(fig);
        }
        for (const root of [holder, waterfall]) root?.querySelectorAll('.printout__scroll').forEach(mountScroll);
        say(t('wsPickDone'));
      } else {
        // A CCN the asset does not hold: the example stays, and the status says so (a stale failure message is replaced).
        say(t('wsPickMissing'));
      }
    } catch {
      if (mine === latest) say(fill('wsPickFailed'));
    }
  };
  mountOmnibox(form, { load: () => loadIndex(form.dataset.src), words: searchWords(), open: pick, types: ['hospital'] });
}
