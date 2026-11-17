// Step 1's group chips (web/program/finding.js draws them hidden): a press lights one group, so the strips keep only its
// hospitals over a gray outline of all of them, with both medians marked, and the readout says how the group compares;
// the state picker does the same for a state. One at a time: a second press on the lit chip, or Clear, puts every
// hospital back.
import { groupReadout, inGroup } from '../web/program/strips.js';

// root: the chips' block; items: the hospitals drawn; onGroup(group or null): a group lit ({ key, name, test }) or none;
// say(text): the page's live line, which speaks the readout when a press changes it (the readout itself is silent).
// Returns refresh(k, use), which writes the readout again for the case shown (index k in SCENARIOS) and the use rate and
// returns it while a group is lit ('' when none is), for the page's live line to say with the case's numbers.
export function mountChips(root, { items, onGroup, say = () => {} }) {
  const buttons = [...root.querySelectorAll('button[data-group]')];
  const select = root.querySelector('select');
  const clear = root.querySelector('.wr-chips__clear');
  const out = root.querySelector('.wr-chips__out');
  const hint = out.textContent;
  let group = null;
  let shown = { k: 1, use: 1 };

  const readout = () => {
    if (!group) {
      out.textContent = hint;
      return;
    }
    const members = items.filter(group.test);
    out.textContent = groupReadout({ name: group.name, members, all: items, k: shown.k, use: shown.use });
  };
  const set = (next) => {
    group = next;
    for (const b of buttons) b.setAttribute('aria-pressed', String(group?.key === b.dataset.group));
    const state = group?.key.startsWith('st:');
    select.classList.toggle('wr-chip--on', Boolean(state));
    if (!state) select.value = '';
    clear.hidden = !group;
    readout();
    say(out.textContent);
    onGroup(group);
  };

  for (const b of buttons) {
    const key = b.dataset.group;
    b.addEventListener('click', () => set(group?.key === key ? null : { key, name: b.dataset.name, test: (r) => inGroup(r, key) }));
  }
  select.addEventListener('change', () => {
    const code = select.value;
    set(code ? { key: `st:${code}`, name: select.selectedOptions[0].textContent, test: (r) => r.state === code } : null);
  });
  clear.addEventListener('click', () => {
    set(null);
    (buttons[0] ?? select).focus();
  });
  root.hidden = false;
  return (k, use = 1) => {
    shown = { k, use };
    readout();
    return group ? out.textContent : '';
  };
}
