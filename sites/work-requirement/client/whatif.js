// The stage head's controls (web/program/controls.js draws them hidden): the scenario switch and the use-rate what-if,
// wired to the page's state (client/state.js), which every step draws from. At the default use rate the totals are the
// file's own, as the server printed them; another rate runs every scenario hospital through the engine
// (engine/js/medicaid, by way of web/program/model.js totalsAt), from the what-if's asset, fetched the first time the
// reader reaches for the slider. Coming back to the default gives the file's own totals again, not a recomputation.
import { decodeBase, totalsAt } from '../web/program/model.js';
import { pct } from '../../../web/render/format.js';
import { t } from '../web/copy.js';

// The use rate's arithmetic, apart from the page: setUse(use) finds the totals (server's, the file's, at the default;
// else the engine's over the asset fetchBase() gives, kept once computed) and hands them to apply(use, totals), unless a
// newer move came first; when the asset fails, fail() is called (for the newest move only) and the next move fetches
// again. load() starts the fetch early. fetchBase: () => a promise of the asset's JSON.
export function useControl({ server, fetchBase, apply, fail }) {
  const cache = new Map();
  let base = null;
  let latest = 0;
  const load = () => {
    base ??= Promise.resolve().then(fetchBase).then(decodeBase).catch((err) => {
      base = null;
      throw err;
    });
    return base;
  };
  async function setUse(use) {
    const ticket = ++latest;
    let totals = use === 1 ? server : cache.get(use);
    if (!totals) {
      try {
        totals = totalsAt(await load(), use);
      } catch {
        if (ticket === latest) fail();
        return;
      }
      cache.set(use, totals);
    }
    if (ticket === latest) apply(use, totals);
  }
  return { setUse, load };
}

// head: the stage head; store: the page's state; server: the file's totals; baseUrl: the what-if's asset.
export function mountWhatif(head, { store, server, baseUrl }) {
  const radios = [...head.querySelectorAll('input[name="wr-scen"]')];
  const slider = head.querySelector('#wr-use');
  const out = head.querySelector('.wr-use__v');
  const reset = head.querySelector('.wr-use__reset');
  const note = head.querySelector('.wr-use__note');
  const hint = note.textContent;
  const describedBy = slider.getAttribute('aria-describedby');

  const showNote = (text, shown) => {
    note.textContent = text;
    note.hidden = !shown;
    // The slider is described by the note only while the note shows.
    if (shown) slider.setAttribute('aria-describedby', describedBy);
    else slider.removeAttribute('aria-describedby');
  };
  // Off the default, the way back takes the note's place (the tick on the track still marks the default).
  const showUse = (use) => {
    const text = pct(use, 0);
    slider.value = String(Math.round(use * 100));
    slider.setAttribute('aria-valuetext', text);
    out.textContent = text;
    reset.hidden = use === 1;
    showNote(hint, use === 1);
  };
  const control = useControl({
    server,
    fetchBase: async () => {
      const res = await fetch(baseUrl);
      if (!res.ok) throw new Error(String(res.status));
      return res.json();
    },
    apply: (use, totals) => store.set({ use, totals }),
    fail: () => {
      showUse(store.get().use);
      showNote(t('useFailed'), true);
    },
  });
  const setUse = (use) => {
    showUse(use);
    control.setUse(use);
  };

  for (const radio of radios) radio.addEventListener('change', () => radio.checked && store.set({ scenario: radio.value }));
  slider.addEventListener('input', () => setUse(Number(slider.value) / 100));
  // The asset starts loading as the reader reaches for the slider, so its first move redraws at once.
  for (const type of ['pointerenter', 'focus']) slider.addEventListener(type, () => control.load().catch(() => {}), { once: true });
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
