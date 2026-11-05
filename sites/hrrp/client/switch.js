// A segmented switch's browser behavior, shared by the Map Part's measures (client/map.js) and Step 2's conditions
// (client/swarm.js): the controls (hidden in the page, so unhiding them is what offers them) press one button at a time, the
// panel whose data-<attr> matches the picked button's shows and the others hide, and the box takes the pick as its data-<attr>.
//   box: the element that holds panels and controls; controls: the hidden element to unhide; attr: the data attribute buttons and
//   panels share (data-measure, data-cond); panels: the elements to show one of (or a function returning them, for a box whose panels arrive later); group: where clicks are heard (default controls);
//   onPick(panel): called with the panel just shown.
export function mountSwitch({ box, controls, attr, panels, group = controls, onPick }) {
  controls.hidden = false;
  const selector = `button[data-${attr}]`;
  const buttons = [...controls.querySelectorAll(selector)];
  group?.addEventListener('click', (e) => {
    const picked = e.target.closest(selector);
    if (!picked) return;
    for (const b of buttons) b.setAttribute('aria-pressed', String(b === picked));
    for (const p of typeof panels === 'function' ? panels() : panels) {
      p.hidden = p.dataset[attr] !== picked.dataset[attr];
      if (!p.hidden) onPick?.(p);
    }
    box.dataset[attr] = picked.dataset[attr];
  });
}
