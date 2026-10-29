// The home story's scroll logic (hub/client/story/steps.js): which step is being read.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standIn } from '../../web/test/dom.js';
import { activeStep, mountSteps } from '../client/story/steps.js';

test('activeStep picks the last step whose top has passed the focus line, the first before any has', () => {
  assert.equal(activeStep([100, 900, 1700], 500), 0);
  assert.equal(activeStep([-800, 0, 800], 500), 1);
  assert.equal(activeStep([-1700, -900, -100], 500), 2);
  // Exactly on the line counts as passed.
  assert.equal(activeStep([-300, 500, 1300], 500), 1);
  // None passed yet (the story still below): the first.
  assert.equal(activeStep([600, 1400], 500), 0);
  assert.equal(activeStep([], 500), 0);
});

// A listener added with an abort signal comes off when the signal aborts, as a browser's does (drop takes it off).
const keep = (options, drop) => options?.signal?.addEventListener('abort', drop);

// A stand-in story for mountSteps (no DOM in node:test): three steps whose tops the test sets, the rail's links (which
// keep their click listeners), the phone label's items, the progress line and the stage, on a desktop-wide window whose
// frames run only when the test says. The page's own window and document come back after the test (standIn).
function storyPage(t) {
  const listeners = new Map();
  const frames = new Map();
  let id = 0;
  standIn(t, {
    window: {
      innerHeight: 800,
      addEventListener: (type, fn, options) => {
        listeners.set(type, fn);
        keep(options, () => listeners.get(type) === fn && listeners.delete(type));
      },
      requestAnimationFrame: (fn) => (frames.set(++id, fn), id),
      cancelAnimationFrame: (n) => frames.delete(n),
    },
    document: { querySelector: () => null, getElementById: () => null },
  });
  const classes = () => {
    const on = new Set();
    return { toggle: (c, yes) => (yes ? on.add(c) : on.delete(c)), remove: (...cs) => cs.forEach((c) => on.delete(c)), contains: (c) => on.has(c) };
  };
  let tops = [100, 900, 1700];
  const steps = tops.map((_, i) => ({ classList: classes(), querySelector: () => ({ offsetHeight: 100 }), getBoundingClientRect: () => ({ top: tops[i] }) }));
  const links = steps.map((_, i) => {
    const a = { hash: `#step-${i}`, attrs: {}, clicks: new Set() };
    a.setAttribute = (k, v) => { a.attrs[k] = v; };
    a.removeAttribute = (k) => { delete a.attrs[k]; };
    a.addEventListener = (type, fn, options) => {
      if (type !== 'click') return;
      a.clicks.add(fn);
      keep(options, () => a.clicks.delete(fn));
    };
    return a;
  });
  const now = steps.map(() => ({ classList: classes() }));
  const progress = { style: {}, classList: classes() };
  const stage = { getBoundingClientRect: () => ({ top: 500, height: 300 }) };
  const parts = { '.step': steps, '.rail a': links, '[data-now]': now, '.story__progress': progress, '.stage': stage };
  const story = { dataset: {}, querySelectorAll: (sel) => parts[sel], querySelector: (sel) => parts[sel], getBoundingClientRect: () => ({ top: -100, bottom: 2900, height: 3000 }) };
  return {
    story, steps, links, now, progress, listeners,
    // The reader scrolls: the steps' tops move and the page hears it.
    scroll(next) {
      tops = next;
      listeners.get('scroll')?.();
    },
    runFrames() {
      const queued = [...frames.values()];
      frames.clear();
      for (const fn of queued) fn();
    },
  };
}

test('stop puts the story back as the server wrote it, even with a frame already queued, and takes the rail\'s glide off', (t) => {
  const page = storyPage(t);
  const read = [];
  const media = { matches: false };
  const steps = mountSteps({ story: page.story, onStep: (i) => read.push(i), phone: media, still: media });
  assert.equal(page.story.dataset.step, '0');
  assert.ok(page.steps[0].classList.contains('is-current'));
  assert.ok(page.links.every((a) => a.clicks.size === 1), 'each rail link glides');
  // The reader scrolls to the second step, and the data fails before its frame runs.
  page.scroll([-800, 0, 800]);
  steps.stop();
  page.runFrames();
  assert.equal(page.story.dataset.step, undefined, 'no step marked on the story');
  assert.ok(page.steps.every((s) => !s.classList.contains('is-current')), 'no step faded or current');
  assert.ok(page.links.every((a) => !('aria-current' in a.attrs)), 'no rail link current');
  assert.ok(page.now.every((li) => !li.classList.contains('is-now')));
  assert.ok(!page.progress.classList.contains('is-on'), 'no progress line');
  assert.deepEqual(read, [0], 'the chart is never asked for another step');
  assert.ok(page.links.every((a) => a.clicks.size === 0), 'the rail\'s links keep their own jump');
  assert.equal(page.listeners.size, 0, 'no scroll or resize listener left');
});
