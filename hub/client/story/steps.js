// The home story's scroll: which step is being read (its words in full ink, the others in the faintest text ink, which
// still reads at 4.5:1; hub/styles.css), the rail marking the current step, the phone's "n/9 Step name" label, the thin
// progress line under the header, and the call that moves the chart. activeStep is pure; mountSteps wires it to the page.

// The step being read: the last whose top (stepTops, in window pixels, in order) has reached the focus line; the first
// before any has.
export function activeStep(stepTops, focusLine) {
  let at = 0;
  stepTops.forEach((top, i) => {
    if (top <= focusLine) at = i;
  });
  return at;
}

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
  // The frame an update waits for (0: none).
  let frame = 0;

  const headerBottom = () => (bar ? Math.max(0, bar.getBoundingClientRect().bottom) : 0);

  // On a phone each step's words hold under the header while read, unless they are taller than the window between the
  // header and the chart: those scroll with the page, so none of them hides behind the chart.
  function measure() {
    // The room between the header and the chart pinned at the window's bottom, wherever the page is scrolled.
    const room = window.innerHeight - stage.getBoundingClientRect().height - headerBottom() - 24;
    // Every height read before any class is written, so the page lays out once.
    const tall = words.map((w) => phone.matches && w.offsetHeight > room);
    steps.forEach((s, i) => s.classList.toggle('step--tall', tall[i]));
  }

  function update() {
    frame = 0;
    const vh = window.innerHeight;
    const narrow = phone.matches;
    const top = headerBottom();
    // A phone reads between the header and the pinned chart; a desktop a little above the window's middle.
    const stageTop = narrow ? stage.getBoundingClientRect().top : vh;
    const focus = narrow ? stageTop - Math.min(110, (stageTop - top) * 0.4) : vh * 0.58;
    const tops = steps.map((s) => s.getBoundingClientRect().top + (narrow ? 0 : vh * 0.2));
    const at = activeStep(tops, focus);
    const r = story.getBoundingClientRect();
    if (progress) {
      progress.style.transform = `scaleX(${Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - vh))).toFixed(4)})`;
      progress.classList.toggle('is-on', r.top < vh && r.bottom > top);
    }
    if (at !== current) {
      current = at;
      story.dataset.step = String(at);
      steps.forEach((s, i) => s.classList.toggle('is-current', i === at));
      links.forEach((a, i) => (i === at ? a.setAttribute('aria-current', 'step') : a.removeAttribute('aria-current')));
      now.forEach((li, i) => li.classList.toggle('is-now', i === at));
      onStep(at);
    }
  }
  const queue = () => {
    if (!frame) frame = window.requestAnimationFrame(update);
  };

  // A pointer's click on the rail glides to its step, so the chart moves through the steps between. A keyboard's (a click
  // with no pointer, detail 0) and any click when the reader asks for less motion keep the link's own jump, which also
  // moves the keyboard's place in the page to the step.
  const glides = links.map((a) => {
    const glide = (event) => {
      const target = document.getElementById(a.hash.slice(1));
      if (!target || still.matches || event.detail === 0 || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    a.addEventListener('click', glide);
    return glide;
  });

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
    // Back to the page as the server wrote it: no fading, no current step, no update still to come, the rail's links
    // their own jumps.
    stop() {
      window.removeEventListener('scroll', queue);
      window.removeEventListener('resize', resized);
      window.cancelAnimationFrame(frame);
      frame = 0;
      links.forEach((a, i) => a.removeEventListener('click', glides[i]));
      for (const s of steps) s.classList.remove('step--tall', 'is-current');
      for (const a of links) a.removeAttribute('aria-current');
      for (const li of now) li.classList.remove('is-now');
      if (progress) progress.classList.remove('is-on');
      delete story.dataset.step;
    },
  };
}
