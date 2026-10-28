// The home story's scroll: which step is being read, the steps' words fading in as they near the reading line, the rail
// marking the current step, the phone's "n/9 Step name" label, the thin progress line under the header, and the call
// that moves the chart. activeStep and stepOpacity are pure; mountSteps wires them to the page.

// The step being read: the last whose top (stepTops, in window pixels, in order) has reached the focus line; the first
// before any has.
export function activeStep(stepTops, focusLine) {
  let at = 0;
  stepTops.forEach((top, i) => {
    if (top <= focusLine) at = i;
  });
  return at;
}

// A step's words' opacity at `dist` pixels from where they are read (the step being read is 1): full within `slack`,
// then fading over `span` pixels, between floor and ceil.
export function stepOpacity(dist, { span, floor, ceil, slack = 40 }) {
  return Math.max(floor, Math.min(ceil, 1 - (dist - slack) / span));
}

// The fades: a desktop's (the words beside the chart) and a phone's (the words above it), and the one value every step
// but the current takes when the reader asks for less motion (it switches with the step, never fades).
const WIDE_FADE = { floor: 0.16, ceil: 0.85 };
const PHONE_FADE = { floor: 0.14, ceil: 0.5, slack: 0 };
const STILL = 0.4;

// Wires the story (the .story element): steps (section.step, in order) with their words (.step__in), the rail's links, the
// phone label's items ([data-now]), the progress line, the stage. onStep(i) is called when the step being read changes
// (and once at the start). phone and still: media queries for the phone layout and reduced motion. Returns { refresh,
// stop }: measure again (after a resize or once fonts load); undo it all.
export function mountSteps({ story, onStep, phone, still }) {
  const steps = [...story.querySelectorAll('.step')];
  const words = steps.map((s) => s.querySelector('.step__in'));
  const links = [...story.querySelectorAll('.rail a')];
  const now = [...story.querySelectorAll('[data-now]')];
  const progress = story.querySelector('.story__progress');
  const stage = story.querySelector('.stage');
  const bar = document.querySelector('.topbar');
  let current = -1;
  let queued = false;

  const headerBottom = () => (bar ? Math.max(0, bar.getBoundingClientRect().bottom) : 0);

  // On a phone each step's words hold under the header while read, unless they are taller than the window between the
  // header and the chart: those scroll with the page, so none of them hides behind the chart.
  function measure() {
    // The room between the header and the chart pinned at the window's bottom, wherever the page is scrolled.
    const room = window.innerHeight - stage.getBoundingClientRect().height - headerBottom() - 24;
    steps.forEach((s, i) => s.classList.toggle('step--tall', phone.matches && words[i].offsetHeight > room));
  }

  function update() {
    queued = false;
    const vh = window.innerHeight;
    const narrow = phone.matches;
    const top = headerBottom();
    // A phone reads between the header and the pinned chart; a desktop a little above the window's middle.
    const stageTop = narrow ? stage.getBoundingClientRect().top : vh;
    const focus = narrow ? stageTop - Math.min(110, (stageTop - top) * 0.4) : vh * 0.58;
    const tops = steps.map((s) => s.getBoundingClientRect().top + (narrow ? 0 : vh * 0.2));
    const at = activeStep(tops, focus);
    steps.forEach((s, i) => {
      const box = words[i].getBoundingClientRect();
      // Only the words on screen fade (as the scroll moves them, never on a timer); the rest keep their full ink.
      if (box.bottom < top || box.top > vh) {
        words[i].style.removeProperty('opacity');
        return;
      }
      let o = 1;
      if (i !== at) {
        if (still.matches) o = STILL;
        else if (narrow) o = stepOpacity(Math.abs(box.top - top - 12), { ...PHONE_FADE, span: (stageTop - top) * 0.9 });
        else o = stepOpacity(Math.abs(box.top + Math.min(box.height, 220) / 2 - focus * 0.82), { ...WIDE_FADE, span: vh * 0.42 });
      }
      words[i].style.opacity = o.toFixed(3);
    });
    const r = story.getBoundingClientRect();
    if (progress) {
      progress.style.transform = `scaleX(${Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - vh))).toFixed(4)})`;
      progress.classList.toggle('is-on', r.top < vh && r.bottom > top);
    }
    if (at !== current) {
      current = at;
      story.dataset.step = String(at);
      links.forEach((a, i) => (i === at ? a.setAttribute('aria-current', 'step') : a.removeAttribute('aria-current')));
      now.forEach((li, i) => li.classList.toggle('is-now', i === at));
      onStep(at);
    }
  }
  const queue = () => {
    if (!queued) {
      queued = true;
      window.requestAnimationFrame(update);
    }
  };

  // A pointer's click on the rail glides to its step, so the chart moves through the steps between. A keyboard's (a click
  // with no pointer, detail 0) and any click when the reader asks for less motion keep the link's own jump, which also
  // moves the keyboard's place in the page to the step.
  for (const a of links) {
    a.addEventListener('click', (event) => {
      const target = document.getElementById(a.hash.slice(1));
      if (!target || still.matches || event.detail === 0 || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  const resized = () => {
    measure();
    queue();
  };
  window.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('resize', resized, { passive: true });
  measure();
  update();
  return {
    refresh: resized,
    // Back to the page as the server wrote it: no fading, no current step.
    stop() {
      window.removeEventListener('scroll', queue);
      window.removeEventListener('resize', resized);
      for (const w of words) w.style.removeProperty('opacity');
      for (const s of steps) s.classList.remove('step--tall');
      for (const a of links) a.removeAttribute('aria-current');
      for (const li of now) li.classList.remove('is-now');
      if (progress) progress.classList.remove('is-on');
      delete story.dataset.step;
    },
  };
}
