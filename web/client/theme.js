// The dark-mode buttons (render/shell.js: one in the bar, one in the footer; the CSS shows one at a time). Either flips
// data-theme on <html> for this visit only: nothing is saved, so the next visit follows the device again. Each button is
// hidden in the markup and shown here, since it does nothing without JS; both keep aria-pressed in step.
const root = document.documentElement;
const buttons = [...document.querySelectorAll('.theme-toggle')];

if (buttons.length) {
  const query = window.matchMedia('(prefers-color-scheme: dark)');
  const isDark = () => (root.dataset.theme ? root.dataset.theme === 'dark' : query.matches);
  const sync = () => { for (const button of buttons) button.setAttribute('aria-pressed', String(isDark())); };

  for (const button of buttons) {
    button.addEventListener('click', () => {
      root.dataset.theme = isDark() ? 'light' : 'dark';
      sync();
    });
  }
  query.addEventListener('change', sync);
  sync();
  for (const button of buttons) button.hidden = false;
}
