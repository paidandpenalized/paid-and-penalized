// The reader's light/dark choice, kept for the visit: the theme buttons (shell.js) write it to the tab's session
// storage under one key, and the head's script (theme.js) puts it back on <html> before the next page paints. The
// browser keeps a tab's session storage to itself and never sends it anywhere. Every access is guarded: a browser that
// blocks storage (or has none) leaves the theme to the device, as if no choice had been made. This is the only browser
// code that reaches storage of any kind (web/test/shell-client.test.js checks).
export const THEME_KEY = 'pp-theme';
const THEMES = ['light', 'dark'];

// The window's session storage, or null where the browser refuses it (reading the property can itself throw).
export function sessionStore(win) {
  try {
    return win.sessionStorage || null;
  } catch {
    return null;
  }
}

// The choice kept for this visit, 'light' or 'dark', or null for none (or anything else found under the key).
export function savedTheme(store) {
  try {
    const theme = store ? store.getItem(THEME_KEY) : null;
    return THEMES.includes(theme) ? theme : null;
  } catch {
    return null;
  }
}

// Keeps theme ('light' or 'dark'; anything else is ignored) for the visit. A refused write keeps it for this page only.
export function saveTheme(store, theme) {
  if (!store || !THEMES.includes(theme)) return;
  try {
    store.setItem(THEME_KEY, theme);
  } catch {
    // Blocked or full: the page still shows the choice; the next page follows the device.
  }
}

// The head's script: the kept choice, if any, on <html> (root) as data-theme, which the tokens' dark copy reads.
export function applySavedTheme(root, store) {
  const theme = savedTheme(store);
  if (theme) root.dataset.theme = theme;
}
