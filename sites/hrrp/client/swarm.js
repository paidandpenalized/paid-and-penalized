// Step 2's condition switch (figures/swarm.js): the buttons show one condition's swarm at a time and put its takeaway in the
// figure's caption. Without this script heart failure's swarm shows with its own takeaway and the switch stays hidden.

// The caption's words are the text after the figure number's span; each panel keeps its takeaway in data-takeaway.
function setTakeaway(figure, text) {
  const words = [...figure.querySelector('.fig__cap').childNodes].filter((n) => n.nodeType === 3).pop();
  if (words) words.nodeValue = ` ${text}`;
}

export function mountSwarm() {
  for (const box of document.querySelectorAll('.swarm')) {
    const controls = box.querySelector('.swarm__controls');
    if (!controls) continue;
    controls.hidden = false;
    const buttons = [...controls.querySelectorAll('button[data-cond]')];
    const panels = [...box.querySelectorAll('.swarm__m')];
    controls.addEventListener('click', (e) => {
      const picked = e.target.closest('button[data-cond]');
      if (!picked) return;
      for (const b of buttons) b.setAttribute('aria-pressed', String(b === picked));
      for (const p of panels) {
        p.hidden = p.dataset.cond !== picked.dataset.cond;
        if (!p.hidden) setTakeaway(box.closest('figure'), p.dataset.takeaway);
      }
      box.dataset.cond = picked.dataset.cond;
    });
  }
}
