// The work-requirement program page's script. Each step is drawn whole at build time; once the strips' asset arrives
// (the asset step 1's stage names, data-strips) this sets up the page's shared state (client/state.js: the case shown,
// the use rate, the page's hospital and the totals) and has every step redraw from it with the build's own code:
//   step 1: the strips (web/program/strips.js), the page's hospital threaded through its three dots, the Find's matches
//           lit, a group from the chips over the gray outline of every hospital, the ranges and the counts line
//           (web/program/ranges.js), the chips' readout, and the live line a screen reader hears;
//   step 2: the chain and its worksheets (client/how.js);
//   step 3: the states' figure, the selected state's headline and card, and the state table's numbers (client/states.js);
//   step 4: the page's hospital's record card and Figure 4 (client/hospital.js);
//   step 5: Figure 5, the corner's range and dollars, where the page's hospital sits and the named table (client/both.js);
//   the stage head: the scenario switch and the use-rate what-if (client/whatif.js);
//   Figure 1's table: its bins' counts and medians at the use rate (rebin).
// Steps 3 and 5 draw from assets of their own (the strips asset's src), fetched as each step nears the screen (whenNear),
// so step 1 is ready on the strips' asset alone; until its asset comes, a step stays as the server drew it.
// From 900px the steps run as a scroll story (client/stage.js, mounted at once: it needs no data), and once the data has
// come its field (client/field.js) flies the dots between the dot steps.
// A later step joins the same way: store.subscribe((state, changed) => …), redrawing when the keys it reads change.
// Without the script, or without the asset, the page stays as the server drew it (the middle case at the default use
// rate), and the chips, the Find and the controls stay hidden.
import { setFollowed } from '../../../web/client/follow.js';
import { DEFAULT_SCENARIO, SCENARIOS } from '../web/constants.js';
import { count, pct } from '../../../web/render/format.js';
import { fill } from '../web/copy.js';
import { bothModel, decodeBoth } from '../web/program/both.js';
import { awayRows, randomPick } from '../web/program/hospital.js';
import { byCase, countsText, rangesInner, statusText } from '../web/program/ranges.js';
import { decodeStates } from '../web/program/states.js';
import { binsOf, decodeStrips, drawn, stripsAlt, stripsBody, stripsLayout } from '../web/program/strips.js';
import { mountBoth } from './both.js';
import { mountChips } from './chips.js';
import { mountField } from './field.js';
import { defaultPool, mountFind, pageHospital } from './find.js';
import { mountHospital } from './hospital.js';
import { mountHow } from './how.js';
import { createStore } from './state.js';
import { mountStage } from './stage.js';
import { mountStates } from './states.js';
import { mountWhatif } from './whatif.js';

const DRAWINGS = ['narrow', 'wide'];
// The width from which the wide drawing shows and the phone's hides (web/styles/charts.css .chart[data-fit]).
export const WIDE_MEDIA = '(min-width: 560px)';

// Step 1's strips, redrawn for the state and for what only this step shows: the Find's matches (lit, item indexes) and
// the chips' group ({ name, test } or null). Only the drawing on show is drawn (each is some 150 KB of markup); the other
// is drawn when the width brings it on. A page's hospital the strips don't draw gets a line under the figure saying so,
// pointing to step 4's reason.
function mountStrips(stage, { data, store }) {
  const items = drawn(data.rows);
  const at = new Map(items.map((r, i) => [r.ccn, i]));
  const svgs = new Map(DRAWINGS.map((drawing) => [drawing, stage.querySelector(`svg[data-fit="${drawing}"]`)]).filter(([, svg]) => svg));
  const undrawn = stage.querySelector('.wr-thread-none');
  const sayUndrawn = (hospital) => {
    if (!undrawn) return;
    const off = Boolean(hospital) && !at.has(hospital.ccn);
    undrawn.hidden = !off;
    undrawn.querySelector('a').textContent = off ? fill('hThreadNone', { name: hospital.name }) : '';
  };
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
  const bins = [...stage.querySelectorAll('[data-bin]')].map((cell) => [cell, ...cell.dataset.bin.split(' ')]);
  store.subscribe((state, changed) => {
    if (changed.has('use')) {
      for (const svg of svgs.values()) svg.setAttribute('aria-label', stripsAlt(items, state.use));
      rebin(bins, binsOf(items, data.top, state.use));
    }
    if (changed.has('scenario') || changed.has('use')) layouts = new Map();
    if (changed.has('hospital')) sayUndrawn(state.hospital);
    if (changed.has('scenario') || changed.has('use') || changed.has('hospital') || changed.has('totals')) draw();
  });
  sayUndrawn(store.get().hospital);
  return {
    items,
    at,
    draw,
    only: () => local.group?.test ?? null,
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

// Figure 1's table at the use rate: each cell (data-bin "<bin> <case index>", "m" for the median) gets its count or
// median, its text as the build writes it and its raw value for the sort and the CSV.
export function rebin(cells, { counts, medians }) {
  for (const [cell, b, k] of cells) {
    const v = b === 'm' ? medians[Number(k)] : counts[Number(k)][Number(b)];
    cell.textContent = b === 'm' ? pct(v, 2) : count(v);
    cell.dataset.value = String(v);
  }
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

const getJson = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
};

// A step's own asset (url), fetched once its section first comes within a window's height of the screen, and handed to
// use(json). A fetch that fails leaves the step as the server drew it and is tried again the next time the step comes
// near. Where there's no IntersectionObserver it is fetched at once, and a failure is tried again on the reader's next
// scroll (one try at a time), until one succeeds. Returns the first try's promise there (undefined with an observer).
export function whenNear(section, url, use, { get = getJson, win = window } = {}) {
  let busy = false;
  const go = async (done) => {
    if (busy) return;
    busy = true;
    try {
      use(await get(url));
      done();
    } catch {
      busy = false;
    }
  };
  if (!('IntersectionObserver' in win)) {
    const again = () => go(() => win.removeEventListener('scroll', again));
    win.addEventListener('scroll', again, { passive: true });
    return again();
  }
  const io = new win.IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) go(() => io.disconnect());
  }, { rootMargin: '100% 0px' });
  io.observe(section);
  return undefined;
}

async function start(stage, story) {
  let data;
  try {
    data = decodeStrips(await getJson(stage.dataset.strips));
  } catch {
    return;
  }
  // Steps 3 and 5's models, once their assets come (whenNear below); the field flies to a step only once it has its.
  const models = { states: null, both: null };
  // A ?h= may name a hospital in the file or a hub hospital the file leaves out (step 4 gives its reason), so the page and
  // the shell's followed-hospital chip name the same hospital.
  const byCcn = new Map([...data.rows, ...awayRows(data.away)].map((r) => [r.ccn, r]));
  const store = createStore({
    scenario: DEFAULT_SCENARIO,
    use: 1,
    hospital: pageHospital(window.location.search, byCcn) ?? randomPick(defaultPool(data.rows)),
    totals: data.totals,
    // Step 3's selected state comes with its asset (the most exposed, as the server drew it).
    stateCode: null,
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
    const showing = mountFind(form, {
      rows: data.rows,
      onLit: (ccns) => strips.setLit(ccns),
      onPick: (row) => {
        setFollowed(row.ccn);
        store.set({ hospital: row });
      },
    });
    // Another hospital made the page's (step 4's random pick): the box no longer names the one picked in it.
    store.subscribe((state, changed) => changed.has('hospital') && showing(state.hospital));
  }
  const howSection = document.getElementById('how');
  if (howSection) mountHow(howSection, { store, how: data.how });
  // What the server drew steps 3 and 5 at, for a step mounted late to catch up from.
  const server = { scenario: DEFAULT_SCENARIO, use: 1, totals: data.totals };
  const statesSection = document.getElementById('states');
  if (statesSection) {
    whenNear(statesSection, data.src.states, (json) => {
      const model = decodeStates(json);
      if (store.get().stateCode === null) store.set({ stateCode: model.selected });
      models.states = model;
      mountStates(statesSection, { store, model, wide: window.matchMedia(WIDE_MEDIA), say, server: { ...server, stateCode: model.selected } });
    });
  }
  const hospitalSection = document.getElementById('hospital');
  if (hospitalSection) mountHospital(hospitalSection, { store, rows: data.rows, urls: data.hosp, say });
  const bothSection = document.getElementById('both');
  if (bothSection) {
    whenNear(bothSection, data.src.both, (json) => {
      const model = bothModel(data.rows, decodeBoth(json));
      models.both = model;
      mountBoth(bothSection, { store, model, wide: window.matchMedia(WIDE_MEDIA), say, server });
    });
  }
  const head = stage.querySelector('[data-stage-head]');
  if (head && stage.dataset.base) mountWhatif(head, { store, server: data.totals, baseUrl: stage.dataset.base });
  strips.draw();
  // The field flies the dots between the dot steps, drawn inside the stage's column under its head.
  if (story) {
    story.useField(mountField(stage.closest('.wr-scrolly'), {
      store, items: strips.items, top: data.top, models: () => models, only: strips.only,
      clip: () => {
        const box = stage.getBoundingClientRect();
        const pin = head && !head.hidden ? head.getBoundingClientRect().bottom : 0;
        return { left: box.left - 8, top: Math.max(pin, 0), right: box.right + 8, bottom: window.innerHeight };
      },
    }));
  }
}

// The scroll story's stage comes first (it needs no data); the steps' redraws and the field once the asset arrives.
const scrolly = typeof document === 'undefined' ? null : document.querySelector('.wr-scrolly');
const story = scrolly ? mountStage(scrolly) : null;
const stage = typeof document === 'undefined' ? null : document.querySelector('[data-strips]');
if (stage) start(stage, story);
