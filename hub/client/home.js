// The home page's story, live (entry hub-home): the stage becomes one sticky chart beside the steps (on a phone, pinned
// in the lower part of the window under the words), and once the hub's data arrives its canvas takes over from the
// server's scale bar, drawing every hospital as one dot that moves from step to step as the reader scrolls. Without the
// data the page stays as the server wrote it (every step's words, the bar and the shaded map), which is also what it is
// without scripts.
//
// The last two steps answer to the reader. By state (map.js): pointing at, tapping or tabbing to a state reads out its
// line, and an address's #state=<code> (the family search's state pick, from any page or this one) scrolls here and pins
// that state. Find yours (find.js): the step's own search (a family search box over the hospitals only, which
// hub/client/search.js mounts) follows the hospital found in place, where the bar's opens its page; an address's
// ?h=<CCN> (web/client/follow.js) follows that hospital from the start. A followed hospital is ringed at every step, and
// the last step shows it among its peers, in the group the peer toggle picks, with its card. The worksheet in "Methods, in
// brief" (story/worksheet.js) fills in for the same hospital.
import { followedCcn } from '../../web/client/follow.js';
import { loadHubAsset } from '../../web/client/hub-asset.js';
import { storyFacts } from '../model.js';
import { shareDomain } from './scale.js';
import { mountDock } from './story/dock.js';
import { mountFind } from './story/find.js';
import { storyRows } from './story/layouts.js';
import { mountMap, stateFromHash } from './story/map.js';
import { createStage } from './story/stage.js';
import { mountSteps } from './story/steps.js';
import { mountWorksheet } from './story/worksheet.js';

// The masthead docks into the header as the page scrolls (story/dock.js); it needs nothing from the data. The worksheet
// below the story listens for a found hospital before the story can announce one (story/worksheet.js).
mountDock();
mountWorksheet(document.querySelector('[data-worksheet]'));
const story = document.querySelector('[data-story]');
if (story) start(story);

function start(root) {
  const stageEl = root.querySelector('[data-stage]');
  const canvas = stageEl.querySelector('.stage__cv');
  const card = root.querySelector('[data-card]');
  const form = root.querySelector('form.omni[data-src]');
  const src = form?.dataset.src ?? document.querySelector('[data-hub-src]')?.dataset.hubSrc;
  if (!canvas || !card || !src || !canvas.getContext) return;
  const phone = window.matchMedia('(max-width: 760px)');
  const still = window.matchMedia('(prefers-reduced-motion: reduce)');
  const wide = window.matchMedia('(min-width: 1080px)');
  const nowstep = stageEl.querySelector('.nowstep');
  const statesStep = root.querySelector('#step-states');

  // The last step's search (the family search mounts it): once the story is drawn, a hospital it finds is followed here
  // instead of opened; until then, or for a hospital without an estimate, the pick opens its page as the bar's does.
  let find = null;
  if (form) form.addEventListener('hub:pick', (e) => {
    if (find && find.follow(e.detail.href)) e.preventDefault();
  });

  // The live layout at once (one sticky stage), so the page does not shift again when the data arrives; until then the
  // stage shows the server's scale bar.
  root.classList.add('story--live');
  if (nowstep) nowstep.hidden = false;
  let stage = null;
  let map = null;
  let at = 0;
  const steps = mountSteps({
    story: root, phone, still,
    onStep(i) {
      at = i;
      if (stage) stage.show(i, { instant: still.matches });
      if (map) map.active(i === 7);
    },
  });

  // A state named in the address: the story scrolls to the states (at once on arrival; gliding when picked on this page,
  // so the chart moves through the steps between) and, once the map answers, pins it.
  const named = () => stateFromHash(window.location.hash);
  const goToState = (smooth) => {
    const code = named();
    if (!code || !statesStep) return;
    statesStep.scrollIntoView({ block: 'start', behavior: smooth && !still.matches ? 'smooth' : 'auto' });
    if (map) map.pin(code);
  };
  window.addEventListener('hashchange', () => goToState(true));
  goToState(false);
  // A state picked in the bar's search while on this page: the same state again changes no fragment (no hashchange),
  // so the pick is taken here and the story goes to the state either way.
  for (const bar of document.querySelectorAll('form.omni[data-hub]')) {
    if (bar === form) continue;
    bar.addEventListener('hub:pick', (e) => {
      const to = new URL(e.detail.href, window.location.href);
      if (to.origin !== window.location.origin || to.pathname !== window.location.pathname || !stateFromHash(to.hash)) return;
      e.preventDefault();
      if (window.location.hash === to.hash) goToState(true);
      else window.location.hash = to.hash;
    });
  }

  loadHubAsset(src).then(({ hospitals, fy, mapW, mapH, byCcn }) => {
    const rows = storyRows(hospitals);
    const panels = {
      bar: stageEl.querySelector('.stage__panel--bar'),
      barSvg: stageEl.querySelector('.sbar__svg'),
      map: stageEl.querySelector('.stage__panel--map'),
      mapSvg: stageEl.querySelector('.smap'),
      mapFoot: stageEl.querySelector('.mapfoot'),
    };
    const example = byCcn.get(card.dataset.ccn);
    if (Object.values(panels).some((el) => !el) || !example?.est || !root.querySelector('.peers') || !stageEl.querySelector('.readout')) {
      throw new Error('home story: the page is missing a part of its stage');
    }
    canvas.hidden = false;
    // The map's readout and buttons take their room before the stage measures the drawings it registers to.
    map = mountMap(stageEl);
    stage = createStage(canvas, {
      stage: stageEl, rows, facts: storyFacts(hospitals), fy, domain: shareDomain(hospitals), mapW, mapH, panels, example,
      peersOf: (h) => find.groupOf(h),
      railHidden: () => !wide.matches,
      still,
    });
    find = mountFind({ story: root, hospitals, fy, example, stage });
    const followed = followedCcn(window.location.search, (ccn) => Boolean(byCcn.get(ccn)?.est));
    if (followed) find.select(byCcn.get(followed));
    stage.show(at, { instant: true });
    map.active(at === 7);
    const code = named();
    if (code) map.pin(code);
    root.classList.add('story--drawn');
    const again = () => {
      stage.resize();
      steps.refresh();
    };
    if ('ResizeObserver' in window) new ResizeObserver(again).observe(stageEl);
    if (document.fonts) document.fonts.ready.then(again);
  }).catch(() => {
    // No data: the page as the server wrote it.
    steps.stop();
    root.classList.remove('story--live', 'story--drawn');
    root.classList.add('story--static');
    if (nowstep) nowstep.hidden = true;
    canvas.hidden = true;
    for (const el of stageEl.querySelectorAll('.readout, .smalls, .peers')) el.hidden = true;
    find = null;
  });
}
