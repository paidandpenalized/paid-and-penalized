// The header's dark-mode button. It flips data-theme on <html> for this visit only: nothing is saved, so the next
// visit follows the device again. The button is hidden in the markup and shown here, since it does nothing without JS.
const root = document.documentElement;
const button = document.querySelector('.theme-toggle');

if (button) {
  const query = window.matchMedia('(prefers-color-scheme: dark)');
  const isDark = () => (root.dataset.theme ? root.dataset.theme === 'dark' : query.matches);
  const sync = () => button.setAttribute('aria-pressed', String(isDark()));

  button.addEventListener('click', () => {
    root.dataset.theme = isDark() ? 'light' : 'dark';
    sync();
  });
  query.addEventListener('change', sync);
  sync();
  button.hidden = false;
}
