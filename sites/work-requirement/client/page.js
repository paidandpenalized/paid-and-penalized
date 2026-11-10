// The work-requirement program page's script. Each step is drawn whole at build time; once the strips' asset arrives
// (the asset step 1's stage names, data-strips) this sets up the page's shared state (client/state.js: the case shown,
// the use rate, the page's hospital and the totals) and has every step redraw from it with the build's own code:
//   step 1: the strips (web/program/strips.js), the page's hospital threaded through its three dots, the Find's matches
//           lit, a group from the chips over the gray outline of every hospital, the ranges and the counts line
//           (web/program/ranges.js), the chips' readout, and the live line a screen reader hears;
//   step 2: the chain and its worksheets (client/how.js);
//   the stage head: the scenario switch and the use-rate what-if (client/whatif.js).
// A later step joins the same way: store.subscribe((state, changed) => …), redrawing when the keys it reads change.
// Without the script, or without the asset, the page stays as the server drew it (the middle case at the default use
// rate), and the chips, the Find and the controls stay hidden.
import { setFollowed } from '../../../web/client/follow.js';
import { DEFAULT_SCENARIO, SCENARIOS } from '../web/constants.js';
import { byCase, countsText, rangesInner, statusText } from '../web/program/ranges.js';
import { decodeStrips, drawn, stripsBody, stripsLayout } from '../web/program/strips.js';
import { mountChips } from './chips.js';
import { defaultPool, mountFind, pageHospital } from './find.js';
import { mountHow } from './how.js';
import { createStore } from './state.js';
import { mountWhatif } from './whatif.js';

const DRAWINGS = ['narrow', 'wide'];
// The width from which the wide drawing shows and the phone's hides (web/styles/charts.css .chart[data-fit]).
export const WIDE_MEDIA = '(min-width: 560px)';

// Step 1's strips, redrawn for the state and for what only this step shows: the Find's matches (lit, item indexes) and
// the chips' group ({ name, test } or null). Only the drawing on show is drawn (each is some 150 KB of markup); the other
// is drawn when the width brings it on.
function mountStrips(stage, { data, store }) {
  const items = drawn(data.rows);
  const at = new Map(items.map((r, i) => [r.ccn, i]));
  const svgs = new Map(DRAWINGS.map((drawing) => [drawing, stage.querySelector(`svg[data-fit="${drawing}"]`)]).filter(([, svg]) => svg));
  const wide = window.matchMedia(WIDE_MEDIA);
  const local = { lit: null, group: null };
  // The layouts change only with the case shown, the use rate or the group; the hospital and the matches only redraw
  // over them. stale: the drawings not redrawn since the state last changed.
  let layouts = new Map();
  const stale = new Set();
  const shown = () => (wide.matches && svgs.has('wide') ? 'wide' : 'narrow');
  const drawOne = (drawing) => {
    const svg = svgs.get(drawing);
    if (!svg) return;
    const { scenario, use, hospital, totals } = store.get();
    if (!layouts.has(drawing)) layouts.set(drawing, stripsLayout({ items, drawing, top: data.top, selected: scenario, use, only: local.group?.test ?? null }));
    const i = at.get(hospital?.ccn);
    const thread = i === undefined ? null : { i, name: hospital.name };
    const words = { ...data.words, lost: byCase(totals, 'lost') };
    svg.innerHTML = stripsBody(layouts.get(drawing), { words, group: local.group && { name: local.group.name }, lit: local.lit, hospital: thread }).text;
    stale.delete(drawing);
  };
  const draw = () => {
    for (const drawing of svgs.keys()) stale.add(drawing);
    drawOne(shown());
  };
  wide.addEventListener('change', () => stale.has(shown()) && drawOne(shown()));
  store.subscribe((state, changed) => {
    if (changed.has('scenario') || changed.has('use')) layouts = new Map();
    if (changed.has('scenario') || changed.has('use') || changed.has('hospital') || changed.has('totals')) draw();
  });
  return {
    items,
    at,
    draw,
    setGroup(group) {
      local.group = group;
      layouts = new Map();
      draw();
    },
    setLit(ccns) {
      local.lit = ccns ? [...ccns].map((c) => at.get(c)).filter((i) => i !== undefined) : null;
      draw();
    },
  };
}

// Step 1's ranges and counts line, rewritten when the case or the totals move.
function mountRanges(section, { store }) {
  const box = section.querySelector('.wr-ranges');
  const counts = section.querySelector('.wr-counts');
  if (!box || !counts) return;
  store.subscribe((state, changed) => {
    if (changed.has('scenario') || changed.has('totals')) box.innerHTML = rangesInner(state.totals, state.scenario).text;
    if (changed.has('totals')) counts.textContent = countsText(state.totals);
  });
}

// The page's one live line (ranges.js draws it empty): what changed, said once a reader has stopped moving (a slider
// dragged across a dozen stops says only the last), so the ranges, the counts and the chips' readout can change without
// a sound of their own.
export const SETTLE_MS = 400;
function liveLine(el) {
  let timer = 0;
  return (text) => {
    if (!el) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      el.textContent = text;
    }, SETTLE_MS);
  };
}

async function start(stage) {
  let data;
  try {
    const res = await fetch(stage.dataset.strips);
    if (!res.ok) return;
    data = decodeStrips(await res.json());
  } catch {
    return;
  }
  const byCcn = new Map(data.rows.map((r) => [r.ccn, r]));
  const pool = defaultPool(data.rows);
  const store = createStore({
    scenario: DEFAULT_SCENARIO,
    use: 1,
    hospital: pageHospital(window.location.search, byCcn) ?? pool[Math.floor(Math.random() * pool.length)],
    totals: data.totals,
  });

  const section = stage.closest('section');
  const strips = mountStrips(stage, { data, store });
  mountRanges(section, { store });
  const say = liveLine(section?.querySelector('.wr-status'));
  const chips = section?.querySelector('.wr-chips');
  // The chips' readout for the state (its text while a group is lit, else ''); none without the chips.
  let readout = () => '';
  if (chips) {
    const refresh = mountChips(chips, { items: strips.items, onGroup: (group) => strips.setGroup(group), say });
    readout = (state) => refresh(SCENARIOS.indexOf(state.scenario), state.use);
    readout(store.get());
  }
  store.subscribe((state, changed) => {
    if (!changed.has('scenario') && !changed.has('use') && !changed.has('totals')) return;
    say([statusText(state.totals, state.scenario, state.use), readout(state)].filter(Boolean).join(' '));
  });
  const form = document.querySelector('header.fam form#omni');
  if (form) {
    mountFind(form, {
      rows: data.rows,
      onLit: (ccns) => strips.setLit(ccns),
      onPick: (row) => {
        setFollowed(row.ccn);
        store.set({ hospital: row });
      },
    });
  }
  const howSection = document.getElementById('how');
  if (howSection) mountHow(howSection, { store, how: data.how });
  const head = stage.querySelector('[data-stage-head]');
  if (head && stage.dataset.base) mountWhatif(head, { store, server: data.totals, baseUrl: stage.dataset.base });
  strips.draw();
}

const stage = typeof document === 'undefined' ? null : document.querySelector('[data-strips]');
if (stage) start(stage);
