// The colors and fonts a canvas paints with, read from the family's tokens (web/styles/tokens.css, the one file that holds
// color values) as the page has them now, light or dark; the codes its dots carry for an ink; and the one signal to paint
// again when the theme changes. Shared by the hub's canvases (the home story, the hospital page's swarm).

// Each color's name here and its custom property.
const TOKENS = {
  ink: '--ink', ink2: '--ink-2', ink3: '--ink-3', line: '--line', pen: '--pen', penInk: '--pen-ink', rew: '--rew',
  neutral: '--neutral', paper: '--paper', paper2: '--paper-2',
};

// The body face's and the mono face's font-family.
const FONTS = { body: '--font-body', type: '--font-type' };

// Each name's custom property (props) as root has it now.
function read(props, root) {
  const style = getComputedStyle(root);
  return Object.fromEntries(Object.entries(props).map(([name, prop]) => [name, style.getPropertyValue(prop).trim()]));
}

// { ink, ink2, ink3, line, pen, penInk, rew, neutral, paper, paper2 }: each token's computed value on root (by default
// the document's root element); and { body, type }, the two faces, as root has them.
export const readColors = (root = document.documentElement) => read(TOKENS, root);
export const readFonts = (root = document.documentElement) => read(FONTS, root);

// A dot's ink, as a code (a typed array holds it): no change, a cut, a bonus, the scale bar's ink; a value's code by its
// sign; and a code's color among colors (readColors').
export const NEUTRAL = 0;
export const PEN = 1;
export const REW = 2;
export const INK = 3;
export const signCode = (v) => (v < 0 ? PEN : v > 0 ? REW : NEUTRAL);
export const inkColor = (colors, code) => (code === PEN ? colors.pen : code === REW ? colors.rew : code === INK ? colors.ink2 : colors.neutral);

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
