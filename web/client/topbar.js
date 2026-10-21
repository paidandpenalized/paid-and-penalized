// A program site's top bar in the browser (layout.js programHeader). While the bar sticks (641px and up), its height
// is --sticky-top on <html>, so what sticks under it (the hospital table's head, the what-if's result) and an
// in-page jump clear it; on a phone, where it scrolls away, 0. On a page holding the sections its nav links to, the
// item for the section in view is marked aria-current as the reader scrolls. Program-neutral; no words of its own.
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
    const next = getComputedStyle(bar).position === 'sticky' ? bar.offsetHeight : 0;
    if (next !== height) root.style.setProperty('--sticky-top', `${(height = next)}px`);
  };
  measure();
  if ('ResizeObserver' in window) new ResizeObserver(measure).observe(bar);
  window.addEventListener('resize', measure, { passive: true });

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
