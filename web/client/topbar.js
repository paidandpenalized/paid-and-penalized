// The family's sticky header in the browser (render/shell.js familyHeader, class .topbar). While it sticks (at every
// width), its height is --sticky-top on <html>, so what sticks under it (the hospital table's head, the what-if's
// result) and an in-page jump clear it; 0 when it does not stick. A keyboard-focused element the browser left under the
// bar is brought down to the bar's edge, and one whose scroll margin keeps it clear of something pinned at the window's
// foot is brought up clear of it (not one focused by a click or a touch). On a page holding the sections its section
// menu links to, the item for the section in view is marked aria-current as the reader scrolls. Program-neutral; no
// words of its own.
const bar = typeof document === 'undefined' ? null : document.querySelector('.topbar');
// How long after a press's release with no click its mark is cleared (below).
export const RELEASE_MS = 1000;

// The section in view: the last one whose top has passed the bar's bottom (with a little slack), else the first.
export function sectionInView(tops, line) {
  let at = 0;
  tops.forEach((top, i) => { if (top <= line) at = i; });
  return at;
}

if (bar) {
  const root = document.documentElement;
  let height = -1;
  const measure = () => {
    // Its exact height: offsetHeight rounds (a 100.2px bar reads 100), which would leave what clears it a fraction under it.
    const next = getComputedStyle(bar).position === 'sticky' ? bar.getBoundingClientRect().height : 0;
    if (next !== height) root.style.setProperty('--sticky-top', `${(height = next)}px`);
  };
  measure();
  if ('ResizeObserver' in window) new ResizeObserver(measure).observe(bar);
  window.addEventListener('resize', measure, { passive: true });

  // Where a browser leaves a keyboard-focused element is its own call: Chrome keeps it clear of the bar (scroll-padding)
  // unless it is taller than the window, Firefox leaves one that is partly in view where it is, and Safari ignores the
  // padding. Once the browser has scrolled, bring one that sits under the bar (by more than the pixel a browser's
  // scrolling rounds to) down to the bar's edge. CSS alone can't: a scroll-margin-top of the bar's height on every
  // focusable element still left elements under it in all three engines (tools/e2e/interact.test.js's walk), and it adds
  // to the padding, so Chrome and Safari then stop a focus a whole bar below the bar's edge. The focus a press of a
  // pointer or a touch gives is the reader's own pick and stays where it is: :focus-visible can't tell, since a text
  // field matches it on a click too. The press marks that one focus only: the next focusin takes the mark, and the
  // press's end (its click, a context menu or a cancelled touch) or a key clears a mark no focus took, so a later focus
  // with no key pressed (a screen reader's cursor, switch access, a script) is brought clear as a keyboard's is. The
  // end clears it a task later: a label's click focuses its field after the click event. A press that ends with no
  // click (a middle button's) is cleared by its release, RELEASE_MS later: a tap's focus comes after its pointerup. One
  // clear is pending at a time, and a new press cancels it, so a clear never takes the mark of a press made since.
  let pressed = false;
  let clearing;
  const listen = (types, fn) => { for (const type of types) document.addEventListener(type, fn, { capture: true, passive: true }); };
  const release = (ms) => () => {
    clearTimeout(clearing);
    clearing = setTimeout(() => { pressed = false; }, ms);
  };
  listen(['pointerdown', 'touchstart'], () => { clearTimeout(clearing); pressed = true; });
  listen(['click', 'contextmenu', 'pointercancel'], release(0));
  listen(['pointerup'], release(RELEASE_MS));
  listen(['keydown'], () => { pressed = false; });
  // The same goes for the window's foot, where something stays pinned (the front page's chart on a phone): a control
  // the stylesheet gives a scroll-margin-bottom to clear it (Chrome honors that margin; Safari doesn't) is brought up
  // until the margin is in view.
  document.addEventListener('focusin', ({ target }) => {
    const byPress = pressed;
    pressed = false;
    if (byPress || bar.contains(target) || !target.matches(':focus-visible')) return;
    requestAnimationFrame(() => {
      const box = target.getBoundingClientRect();
      const under = height - box.top;
      const margin = parseFloat(getComputedStyle(target).scrollMarginBottom) || 0;
      const below = box.bottom + margin - window.innerHeight;
      if (height > 0 && under > 1) window.scrollBy(0, -under);
      // Never past the bar's edge: a control taller than the room between the two stops there.
      else if (margin > 0 && below > 1) window.scrollBy(0, Math.min(below, box.top - Math.max(height, 0)));
    });
  });

  const here = [...bar.querySelectorAll('.nav a[data-nav]')].map((a) => {
    const url = new URL(a.href, window.location.href);
    const target = url.pathname === window.location.pathname && url.hash ? document.getElementById(url.hash.slice(1)) : null;
    return target && { a, target };
  }).filter(Boolean);
  if (here.length) {
    let queued = false;
    const mark = () => {
      queued = false;
      const at = sectionInView(here.map(({ target }) => target.getBoundingClientRect().top), Math.max(height, 0) + 48);
      for (const a of bar.querySelectorAll('.nav a[data-nav]')) {
        if (a === here[at].a) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      }
    };
    window.addEventListener('scroll', () => {
      if (!queued) {
        queued = true;
        requestAnimationFrame(mark);
      }
    }, { passive: true });
    mark();
  }
}
