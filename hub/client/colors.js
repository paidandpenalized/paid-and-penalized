// The colors a canvas paints with, read from the family's tokens (web/styles/tokens.css, the one file that holds color
// values) as the page has them now, light or dark; and the one signal to paint again when the theme changes. Shared by
// the hub's canvases (the home story, the hospital page's swarm).

// Each color's name here and its custom property.
const TOKENS = {
  ink: '--ink', ink2: '--ink-2', ink3: '--ink-3', line: '--line', pen: '--pen', penInk: '--pen-ink', rew: '--rew',
  neutral: '--neutral', paper: '--paper', paper2: '--paper-2',
};

// { ink, ink2, ink3, line, pen, penInk, rew, neutral, paper, paper2 }: each token's computed value on root (by default
// the document's root element).
export function readColors(root = document.documentElement) {
  const style = getComputedStyle(root);
  return Object.fromEntries(Object.entries(TOKENS).map(([name, prop]) => [name, style.getPropertyValue(prop).trim()]));
}

// Calls fn once after the theme changes, however it changed: the shell's toggle says so on the document ('pp-theme',
// detail { dark }); the device's color scheme can change; and a toggle that flips data-theme on the root without saying
// so is seen there. Several signals for one change make one call (the next frame). Returns a function that stops it.
export function onThemeChange(fn, { doc = document, win = window } = {}) {
  let queued = false;
  const fire = () => {
    if (queued) return;
    queued = true;
    win.requestAnimationFrame(() => {
      queued = false;
      fn();
    });
  };
  const query = win.matchMedia('(prefers-color-scheme: dark)');
  doc.addEventListener('pp-theme', fire);
  query.addEventListener('change', fire);
  const watch = new win.MutationObserver(fire);
  watch.observe(doc.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => {
    doc.removeEventListener('pp-theme', fire);
    query.removeEventListener('change', fire);
    watch.disconnect();
  };
}
