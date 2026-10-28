// The home page's story, live (entry hub-home): the stage becomes one sticky chart beside the steps (on a phone, pinned
// in the lower part of the window under the words), and once the hub's data arrives its canvas takes over from the
// server's scale bar, drawing every hospital as one dot that moves from step to step as the reader scrolls. Without the
// data the page stays as the server wrote it (every step's words, the bar and the shaded map), which is also what it is
// without scripts. The searches are the family search's (hub/client/search.js, which mounts every hub search box); the
// states' readout and the peer toggle are the next script's (they are hidden here).
import { loadHubAsset } from '../../web/client/hub-asset.js';
import { storyFacts } from '../model.js';
import { shareDomain } from './scale.js';
import { storyRows } from './story/layouts.js';
import { createStage } from './story/stage.js';
import { mountSteps } from './story/steps.js';

const story = document.querySelector('[data-story]');
if (story) start(story);

function start(root) {
  const stageEl = root.querySelector('[data-stage]');
  const canvas = stageEl.querySelector('.stage__cv');
  const card = root.querySelector('[data-card]');
  const src = root.querySelector('form.omni[data-hub]')?.dataset.src ?? document.querySelector('[data-hub-src]')?.dataset.hubSrc;
  if (!canvas || !card || !src || !canvas.getContext) return;
  const phone = window.matchMedia('(max-width: 760px)');
  const still = window.matchMedia('(prefers-reduced-motion: reduce)');
  const wide = window.matchMedia('(min-width: 1080px)');
  const nowstep = stageEl.querySelector('.nowstep');

  // The live layout at once (one sticky stage), so the page does not shift again when the data arrives; until then the
  // stage shows the server's scale bar.
  root.classList.add('story--live');
  if (nowstep) nowstep.hidden = false;
  let stage = null;
  let at = 0;
  const steps = mountSteps({
    story: root, phone, still,
    onStep(i) {
      at = i;
      if (stage) stage.show(i, { instant: still.matches });
    },
  });

  loadHubAsset(src).then(({ hospitals, fy, mapW, mapH, byCcn }) => {
    const rows = storyRows(hospitals);
    const estimated = rows.map((r) => r.h);
    const panels = {
      bar: stageEl.querySelector('.stage__panel--bar'),
      barSvg: stageEl.querySelector('.sbar__svg'),
      map: stageEl.querySelector('.stage__panel--map'),
      mapSvg: stageEl.querySelector('.smap'),
      mapFoot: stageEl.querySelector('.mapfoot'),
    };
    const example = byCcn.get(card.dataset.ccn);
    if (Object.values(panels).some((el) => !el) || !example?.est) throw new Error('home story: the page is missing a part of its stage');
    canvas.hidden = false;
    stage = createStage(canvas, {
      stage: stageEl, rows, facts: storyFacts(hospitals), fy, domain: shareDomain(hospitals), mapW, mapH, panels, example,
      peersOf: (h) => estimated.filter((x) => x.state === h.state),
      railHidden: () => !wide.matches,
      still,
    });
    stage.show(at, { instant: true });
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
    if (nowstep) nowstep.hidden = true;
    canvas.hidden = true;
  });
}
