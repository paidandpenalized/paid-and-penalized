// Step 4 in the browser (web/program/hospital.js drew it for the hospital with the median middle-case loss, at the default
// use rate): the record card, Figure 4's caption, drawings, factor rows, reason panel, note and table, redrawn with the
// same code for the page's hospital, case and use rate. A hospital's numbers come from its state's asset (the strips
// asset names each, hosp), fetched once per state and kept; a hub hospital the file leaves out needs none. "Show another
// at random" draws from the hospitals step 1 draws, outside DEFAULT_SKIP_STATE, and follows the pick as the Find does.
import { setFollowed } from '../../../web/client/follow.js';
import { SCENARIOS } from '../web/constants.js';
import { t } from '../web/copy.js';
import { cardHtml, decodeChunk, defaultPool, figureParts, randomPick, sayOf, subjectOf } from '../web/program/hospital.js';

// Fetches each state's asset once (a failed fetch is forgotten, so the next pick tries again). urls: the strips asset's
// hosp; get: (url) => a promise of the JSON.
export function chunkLoader(urls, get) {
  const kept = new Map();
  return (code) => {
    if (!kept.has(code)) {
      const url = urls[code];
      const p = url ? Promise.resolve(url).then(get).then(decodeChunk) : Promise.reject(new RangeError(`no hospital asset for ${code}`));
      kept.set(code, p.catch((err) => {
        kept.delete(code);
        throw err;
      }));
    }
    return kept.get(code);
  };
}

const getJson = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
};

// section: the step; store: the page's state; rows: the strips' rows; urls: the strips asset's hosp; say(text): the
// page's live line.
export function mountHospital(section, { store, rows, urls, say = () => {} }) {
  const card = section.querySelector('[data-h-card]');
  const fig = section.querySelector('#figure-4');
  if (!card || !fig) return;
  const cap = fig.querySelector('.fig__cap');
  const capN = cap.querySelector('.fig__n');
  const drawn = fig.querySelector('[data-h-fig]');
  const svgs = [...fig.querySelectorAll('svg[data-fit]')];
  const facs = fig.querySelector('[data-h-facs]');
  const none = fig.querySelector('[data-h-none]');
  const note = fig.querySelector('[data-h-note]');
  const table = fig.querySelector('.fig__table');
  const cells = [...fig.querySelectorAll('td[data-h]')].map((td) => [td, ...td.dataset.h.split(' ')]);
  const load = chunkLoader(urls, getJson);
  const view = (state) => ({ k: SCENARIOS.indexOf(state.scenario), use: state.use });

  const render = (s, state) => {
    const v = view(state);
    const parts = figureParts(s, v);
    card.innerHTML = cardHtml(s, v).text;
    card.removeAttribute('aria-busy');
    capN.nextSibling?.remove();
    cap.append(` ${parts.cap}`);
    drawn.hidden = Boolean(parts.reason);
    none.hidden = !parts.reason;
    none.innerHTML = parts.none ? parts.none.text : '';
    facs.innerHTML = parts.facs ? parts.facs.text : '';
    for (const svg of svgs) {
      svg.innerHTML = parts[svg.dataset.fit]?.text ?? '';
      svg.setAttribute('aria-label', parts.alt);
    }
    table.hidden = !parts.table;
    note.textContent = parts.note;
    note.parentElement.hidden = !parts.note;
    for (const [td, row, j] of cells) {
      const [, , cell] = parts.cells.find(([r, k]) => r === row && String(k) === j);
      td.textContent = cell.text;
      if (cell.value === null) td.removeAttribute('data-value');
      else td.dataset.value = String(cell.value);
    }
  };

  // A state's asset that didn't load: the card and the figure say so, with no stale figure or table left beside them.
  const failed = () => {
    const message = () => Object.assign(document.createElement('p'), { className: 'small', textContent: t('hFailed') });
    card.replaceChildren(message());
    card.removeAttribute('aria-busy');
    capN.nextSibling?.remove();
    cap.append(` ${t('hFailed')}`);
    drawn.hidden = true;
    table.hidden = true;
    note.parentElement.hidden = true;
    none.replaceChildren(message());
    none.hidden = false;
  };

  // The newest change wins: a slow state asset never draws over a hospital picked after it.
  let ticket = 0;
  async function draw(state, { speak = false } = {}) {
    const mine = ++ticket;
    const row = state.hospital;
    if (!row) return;
    let chunk = null;
    if (!row.away) {
      card.setAttribute('aria-busy', 'true');
      try {
        chunk = await load(row.state);
      } catch {
        if (mine === ticket) failed();
        return;
      }
    }
    if (mine !== ticket) return;
    const s = subjectOf(row, chunk);
    render(s, store.get());
    if (speak) say(sayOf(s, view(store.get())));
  }

  store.subscribe((state, changed) => {
    if (changed.has('hospital')) draw(state, { speak: true });
    else if (changed.has('scenario') || changed.has('use') || changed.has('totals')) draw(state);
  });

  const pick = section.querySelector('[data-h-pick]');
  const pool = defaultPool(rows);
  pick.querySelector('button').addEventListener('click', () => {
    const next = randomPick(pool, Math.random, store.get().hospital?.ccn);
    if (!next) return;
    setFollowed(next.ccn);
    store.set({ hospital: next });
  });
  pick.hidden = false;
  section.querySelector('[data-h-noscript]').hidden = true;
  draw(store.get());
}
