// A program site's top bar in the browser (layout.js programHeader). While the bar sticks (641px and up), its height
// is --sticky-top on <html>, so what sticks under it (the hospital table's head, the what-if's result) and an
// in-page jump clear it; on a phone, where it scrolls away, 0. A keyboard-focused element the browser left under the
// bar is brought down to the bar's edge (not one focused by a click or a touch). On a page holding the sections its
// nav links to, the item for the section in view is marked aria-current as the reader scrolls. Program-neutral; no
// words of its own.
const bar = typeof document === 'undefined' ? null : document.querySelector('.topbar');

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
  // end clears it a task later: a label's click focuses its field after the click event, and a tap's focus comes after
  // its pointerup.
  let pressed = false;
  const listen = (types, fn) => { for (const type of types) document.addEventListener(type, fn, { capture: true, passive: true }); };
  listen(['pointerdown', 'touchstart'], () => { pressed = true; });
  listen(['click', 'contextmenu', 'pointercancel'], () => setTimeout(() => { pressed = false; }));
  listen(['keydown'], () => { pressed = false; });
  document.addEventListener('focusin', ({ target }) => {
    const byPress = pressed;
    pressed = false;
    if (height <= 0 || byPress || bar.contains(target) || !target.matches(':focus-visible')) return;
    requestAnimationFrame(() => {
      const under = height - target.getBoundingClientRect().top;
      if (under > 1) window.scrollBy(0, -under);
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
