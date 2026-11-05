// Step 2's condition switch (figures/swarm.js): the buttons show one condition's swarm at a time and put its takeaway in the
// figure's caption. Without this script heart failure's swarm shows with its own takeaway and the switch stays hidden.

import { mountSwitch } from './switch.js';

// The caption's words are the text after the figure number's span; each panel keeps its takeaway in data-takeaway.
function setTakeaway(figure, text) {
  const words = [...figure.querySelector('.fig__cap').childNodes].filter((n) => n.nodeType === 3).pop();
  if (words) words.nodeValue = ` ${text}`;
}

export function mountSwarm() {
  for (const box of document.querySelectorAll('.swarm')) {
    const controls = box.querySelector('.swarm__controls');
    if (!controls) continue;
    mountSwitch({ box, controls, attr: 'cond', panels: box.querySelectorAll('.swarm__m'), onPick: (p) => setTakeaway(box.closest('figure'), p.dataset.takeaway) });
  }
}
