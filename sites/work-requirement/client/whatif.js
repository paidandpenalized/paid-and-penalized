// The stage head's controls (web/program/controls.js draws them hidden): the scenario switch and the use-rate what-if,
// wired to the page's state (client/state.js), which every step draws from. At the default use rate the totals are the
// file's own, as the server printed them; another rate runs every scenario hospital through the engine
// (engine/js/medicaid, by way of web/program/model.js totalsAt), from the what-if's asset, fetched the first time the
// reader reaches for the slider. Coming back to the default gives the file's own totals again, not a recomputation.
import { decodeBase, totalsAt } from '../web/program/model.js';
import { pct } from '../../../web/render/format.js';
import { t } from '../web/copy.js';

// The totals at a use rate: server's (the file's) at the default, else the engine's over base (decodeBase's).
export const totalsFor = (use, { server, base }) => (use === 1 ? server : totalsAt(base, use));

// head: the stage head; store: the page's state; server: the file's totals; baseUrl: the what-if's asset.
export function mountWhatif(head, { store, server, baseUrl }) {
  const radios = [...head.querySelectorAll('input[name="wr-scen"]')];
  const slider = head.querySelector('#wr-use');
  const out = head.querySelector('.wr-use__v');
  const reset = head.querySelector('.wr-use__reset');
  const note = head.querySelector('.wr-use__note');
  const hint = note.textContent;
  const cache = new Map([[1, server]]);
  let base = null;
  let latest = 0;

  const loadBase = () => {
    base ??= fetch(baseUrl).then((res) => {
      if (!res.ok) throw new Error(String(res.status));
      return res.json();
    }).then(decodeBase).catch((err) => {
      base = null;
      throw err;
    });
    return base;
  };
  const showUse = (use) => {
    const text = pct(use, 0);
    slider.value = String(Math.round(use * 100));
    slider.setAttribute('aria-valuetext', text);
    out.textContent = text;
    // Off the default, the way back takes the note's place (the tick on the track still marks the default).
    reset.hidden = use === 1;
    note.hidden = use !== 1;
  };

  async function setUse(use) {
    const ticket = ++latest;
    showUse(use);
    let totals = cache.get(use);
    if (!totals) {
      try {
        totals = totalsFor(use, { server, base: await loadBase() });
      } catch {
        if (ticket === latest) {
          showUse(store.get().use);
          note.textContent = t('useFailed');
          note.hidden = false;
        }
        return;
      }
      cache.set(use, totals);
    }
    if (ticket !== latest) return;
    note.textContent = hint;
    store.set({ use, totals });
  }

  for (const radio of radios) radio.addEventListener('change', () => radio.checked && store.set({ scenario: radio.value }));
  slider.addEventListener('input', () => setUse(Number(slider.value) / 100));
  // The asset starts loading as the reader reaches for the slider, so its first move redraws at once.
  for (const type of ['pointerenter', 'focus']) slider.addEventListener(type, () => loadBase().catch(() => {}), { once: true });
  reset.addEventListener('click', () => {
    setUse(1);
    slider.focus();
  });
  store.subscribe((state, changed) => {
    if (changed.has('scenario')) for (const radio of radios) radio.checked = radio.value === state.scenario;
    if (changed.has('use')) showUse(state.use);
  });
  head.hidden = false;
}
