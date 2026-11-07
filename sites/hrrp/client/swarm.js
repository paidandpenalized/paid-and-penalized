// Step 2's condition switch (figures/swarm.js): the buttons show one condition's swarm at a time and put its takeaway in the
// figure's caption. Heart failure's swarm is in the page; the other five are in an asset (data-src), fetched when one is first
// picked and inserted as the build drew them. Without this script heart failure's swarm shows with its own takeaway and the
// switch stays hidden.

import { mountCharts } from '../../../web/client/figure.js';
import { once } from '../../../web/client/once.js';
import { t } from '../web/program/copy.js';
import { fetchAsset } from './fetch-asset.js';
import { mountSwitch } from './switch.js';

// The caption's words are the text after the figure number's span; each panel keeps its takeaway in data-takeaway.
function setTakeaway(figure, text) {
  const words = [...figure.querySelector('.fig__cap').childNodes].filter((n) => n.nodeType === 3).pop();
  if (words) words.nodeValue = ` ${text}`;
}

const loadRest = once((src) => fetchAsset(src, 'swarm panels'));

export function mountSwarm() {
  for (const box of document.querySelectorAll('.swarm')) {
    const controls = box.querySelector('.swarm__controls');
    if (!controls) continue;
    const figure = box.closest('figure');
    const panels = () => [...box.querySelectorAll('.swarm__m')];
    // Heard before the switch's own handler: a condition whose panel has not arrived is fetched first, then the press is made again.
    const status = document.createElement('p');
    status.className = 'swarm__status small muted';
    status.hidden = true;
    status.setAttribute('role', 'status');
    controls.after(status);
    controls.addEventListener('click', async (e) => {
      const picked = e.target.closest('button[data-cond]');
      if (!picked || !box.dataset.src || panels().some((p) => p.dataset.cond === picked.dataset.cond)) return;
      e.stopPropagation();
      try {
        const rest = await loadRest(box.dataset.src);
        if (!panels().some((p) => p.dataset.cond === picked.dataset.cond)) {
          const before = new Set(panels());
          for (const markup of Object.values(rest)) box.insertAdjacentHTML('beforeend', markup); // the build's own markup, as swarm.js drew it
          for (const p of panels()) if (!before.has(p)) mountCharts(figure, p);
        }
        status.hidden = true;
        picked.click();
      } catch {
        status.textContent = t('swarmLoadFailed');
        status.hidden = false;
      }
    }, true);
    mountSwitch({ box, controls, attr: 'cond', panels, onPick: (p) => setTakeaway(figure, p.dataset.takeaway) });
  }
}
