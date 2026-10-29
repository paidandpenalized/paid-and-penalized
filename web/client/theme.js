// The head's one classic script (layout.js page()): it runs before the stylesheets and the body, so a page opened after
// the reader chose light or dark this visit paints in that theme from its first frame (theme-store.js). Built as one
// self-contained function call (pipeline/site/build.js CLASSIC_ENTRIES), so it leaves no global name behind.
import { applySavedTheme, sessionStore } from './theme-store.js';

applySavedTheme(document.documentElement, sessionStore(window));
