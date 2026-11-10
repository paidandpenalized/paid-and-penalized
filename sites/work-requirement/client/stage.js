// The scroll story: from 900px wide, with the script, each step's words scroll on the left while its figure holds still
// in a sticky stage on the right, under the stage's head (the scenario switch and the use-rate what-if, which step 1's
// stage carries in the markup). Without the script, or narrower, nothing here runs or applies: the steps stack, each
// with its figure, as the build wrote them (styles.css rules for the story all sit under .wr-scrolly--on, which only
// this sets).
//
// Nothing is moved between steps: each figure stays in its own step's markup (its reading order, its section's
// landmark). The script wraps each step's stage in two boxes, a pin (sticky) and the figure part (.wr-step__fig: what
// shows, fades and scales); the stage itself spans the whole story beside the words, so every pin sticks from the first
// step to the last, and only the step in view shows its figure. The step in view is the section menu's rule: the last
// whose top has passed just under the sticky header (or the step a keyboard's focus is in, while its words are on
// screen). A figure that is not shown is hidden from the pointer, the keyboard and a screen reader; when focus is inside
// one as it goes, the focus is let go. Each figure is scaled down (CSS zoom) just enough to fit the window under the
// head, never below MIN_ZOOM; an open table scrolls inside the pin.
//
// Between two steps the figures crossfade; between two steps whose figures are fields of dots, the field
// (client/field.js) flies the dots first. With reduced motion the steps cut (base.css drops every transition) and there is
// no field.
import { FIELD_STEPS } from './field.js';

export const STAGE_MEDIA = '(min-width: 900px)';
export const MOTION_MEDIA = '(prefers-reduced-motion: no-preference)';
// The step's line: this far under the sticky header (topbar.js marks the section menu by the same).
export const LINE_PX = 48;
// The least a figure is scaled to fit, and the room kept under it.
export const MIN_ZOOM = 0.8;
const FOOT_PX = 10;

// 'off' (the stacked page), 'cut' (the stage, no motion) or 'field' (the stage and the field).
export const stageMode = ({ wide, motion }) => (!wide ? 'off' : motion ? 'field' : 'cut');

// The step in view: the last whose top is at or above the line, else the first (topbar.js sectionInView's rule; that
// module runs on import, so its copy isn't shared into this bundle).
export function stepAt(tops, line) {
  let at = 0;
  tops.forEach((top, i) => { if (top <= line) at = i; });
  return at;
}

// The scale that fits a figure of natural height into room: never above 1, never below least.
export const zoomFor = (natural, room, least = MIN_ZOOM) => (natural > 0 && room > 0 ? Math.max(least, Math.min(1, room / natural)) : 1);

// scrolly: the steps' container (.wr-scrolly); wide, motion: media query lists for STAGE_MEDIA and MOTION_MEDIA. Returns
// { useField(field) } for the field, once the data it needs has come.
export function mountStage(scrolly, { wide = window.matchMedia(STAGE_MEDIA), motion = window.matchMedia(MOTION_MEDIA) } = {}) {
  const root = document.documentElement;
  const sections = [...scrolly.querySelectorAll(':scope > section.wr-step')];
  const stages = sections.map((s) => s.querySelector(':scope > .wr-step__stage'));
  if (!sections.length || stages.some((s) => !s)) return { useField() {} };
  const head = scrolly.querySelector('.wr-stage__head');
  const figs = stages.map((stage) => {
    const pin = document.createElement('div');
    pin.className = 'wr-step__pin';
    const fig = document.createElement('div');
    fig.className = 'wr-step__fig';
    const own = stage.contains(head) ? head : null;
    fig.append(...[...stage.children].filter((c) => c !== own));
    if (own) pin.append(own);
    pin.append(fig);
    stage.append(pin);
    return fig;
  });
  const lastWords = sections[sections.length - 1].querySelector(':scope > .wr-step__words');

  let mode = 'off';
  let active = -1;
  let field = null;
  // The last step whose dots were on screen: a field flight starts from there.
  let lastDot = 'finding';

  const stickyTop = () => parseFloat(root.style.getPropertyValue('--sticky-top')) || 0;
  const headPx = () => (head && !head.hidden ? head.getBoundingClientRect().height : 0);

  // The head's height and the room under the last step's words, which the stage stops above (the named table spans both
  // columns there).
  const measure = () => {
    scrolly.style.setProperty('--wr-head', `${headPx()}px`);
    const tail = scrolly.getBoundingClientRect().bottom - lastWords.getBoundingClientRect().bottom;
    scrolly.style.setProperty('--wr-tail', `${Math.max(0, tail)}px`);
  };
  // Each figure at the scale that fits the window under the head, measured at full size with an open table's rows left out
  // (they scroll in the pin). Scaled whole: laid out at the pin's width, then zoomed (its drawings fill their width, so
  // a zoom alone would only shrink the words).
  const fit = () => {
    for (const fig of figs) {
      fig.style.zoom = '';
      fig.style.width = '';
      const pin = fig.parentElement;
      const cs = getComputedStyle(pin);
      const own = pin.contains(head) ? headPx() + parseFloat(cs.rowGap || '0') : 0;
      const room = window.innerHeight - parseFloat(cs.top) - parseFloat(cs.paddingTop) - own - FOOT_PX;
      let natural = fig.getBoundingClientRect().height;
      for (const d of fig.querySelectorAll('details[open]')) natural -= d.getBoundingClientRect().height - (d.querySelector('summary')?.getBoundingClientRect().height ?? 0);
      const z = zoomFor(natural, room);
      if (z < 1) {
        fig.style.width = `${fig.getBoundingClientRect().width}px`;
        fig.style.zoom = String(Math.floor(z * 1000) / 1000);
      }
    }
  };

  // The step shown (data-on); while its dots fly (data-flying) its figure is there for the keyboard and a screen reader
  // but not yet seen.
  const show = (i, flying = false) => stages.forEach((stage, j) => {
    stage.toggleAttribute('data-on', j === i);
    stage.toggleAttribute('data-flying', j === i && flying);
  });
  const setActive = (i, instant = false) => {
    if (i === active) return;
    const from = active;
    active = i;
    const gone = from >= 0 ? figs[from] : null;
    if (gone?.contains(document.activeElement)) document.activeElement.blur();
    const id = sections[i].id;
    field?.cancel();
    if (!instant && mode === 'field' && field && id in FIELD_STEPS && lastDot !== id) {
      show(i, true);
      const flight = field.fly(lastDot, id, { shown: from >= 0 && sections[from].id === lastDot });
      flight.then((landed) => {
        if (active !== i) return;
        show(i);
        if (landed) field.fade();
      });
    } else {
      show(i);
    }
    if (id in FIELD_STEPS) lastDot = id;
  };

  const inView = (el) => {
    const box = el.getBoundingClientRect();
    return box.bottom > stickyTop() && box.top < window.innerHeight;
  };
  const update = (instant = false) => {
    if (mode === 'off') return;
    let at = stepAt(sections.map((s) => s.getBoundingClientRect().top), stickyTop() + LINE_PX);
    const f = document.activeElement;
    if (f && f !== document.body && f.matches(':focus-visible') && !head?.contains(f)) {
      const i = sections.findIndex((s) => s.contains(f));
      if (i >= 0 && inView(sections[i].querySelector(':scope > .wr-step__words'))) at = i;
    }
    setActive(at, instant);
  };

  const apply = () => {
    mode = stageMode({ wide: wide.matches, motion: motion.matches });
    scrolly.classList.toggle('wr-scrolly--on', mode !== 'off');
    field?.cancel();
    if (mode === 'off') {
      for (const fig of figs) Object.assign(fig.style, { zoom: '', width: '' });
      show(-1);
      active = -1;
      return;
    }
    measure();
    fit();
    active = -1;
    update(true);
  };

  let queued = false;
  window.addEventListener('scroll', () => {
    if (queued || mode === 'off') return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      update();
    });
  }, { passive: true });
  document.addEventListener('focusin', () => update());
  window.addEventListener('resize', () => mode !== 'off' && (measure(), fit()), { passive: true });
  if ('ResizeObserver' in window) {
    // A figure's own height moves with the page's state (a hospital with no figure, a longer label), the head shows once
    // the script's data comes, and the named table opens under the last step.
    const ro = new ResizeObserver(() => mode !== 'off' && (measure(), fit()));
    for (const fig of figs) ro.observe(fig);
    if (head) ro.observe(head);
    ro.observe(scrolly);
  }
  wide.addEventListener('change', apply);
  motion.addEventListener('change', apply);
  apply();

  return {
    useField(f) {
      field = f;
    },
  };
}
