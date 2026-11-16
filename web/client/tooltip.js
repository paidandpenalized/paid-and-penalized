// A pointer tooltip that can be hovered (WCAG 1.4.13): leaving its mark hides it a moment later (HIDE_MS), time to cross
// onto the tooltip, which keeps it. Used by the chart kit's tooltips (figure.js) and the hub's swarm.

// How long a tooltip stays after the pointer leaves its mark.
export const HIDE_MS = 150;

// fn, run ms after the last soon(), unless keep() comes first. pending(): a run is waiting.
export function delayedHide(fn, ms = HIDE_MS) {
  let timer = 0;
  const keep = () => {
    clearTimeout(timer);
    timer = 0;
  };
  const soon = () => {
    keep();
    timer = setTimeout(() => {
      timer = 0;
      fn();
    }, ms);
  };
  return { keep, soon, pending: () => timer !== 0 };
}

// The tooltip's own pointer: on it, the hide waits; a mouse or pen leaving it hides it soon (a tap's leave does not).
// Returns pressing(): true while a press on the tooltip is being handled, so the chart's blur (the press takes the focus
// from it) can leave the tooltip up.
export function bindTip(tip, { keep, soon }) {
  let pressed = false;
  tip.addEventListener('pointerenter', keep);
  tip.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch') soon(); });
  tip.addEventListener('pointerdown', () => {
    pressed = true;
    setTimeout(() => { pressed = false; });
  });
  return () => pressed;
}
