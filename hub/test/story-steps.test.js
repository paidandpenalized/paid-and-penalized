// The home story's scroll logic (hub/client/story/steps.js): which step is being read, and how far the others fade.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeStep, stepOpacity } from '../client/story/steps.js';

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

test('stepOpacity: full near the focus, fading with distance to the floor, never past the ceiling', () => {
  const o = { span: 400, floor: 0.16, ceil: 0.85 };
  assert.equal(stepOpacity(0, o), 0.85);
  assert.equal(stepOpacity(40, o), 0.85);
  assert.ok(Math.abs(stepOpacity(240, o) - 0.5) < 1e-9);
  assert.equal(stepOpacity(10_000, o), 0.16);
  // Further is never darker.
  let last = 1;
  for (let d = 0; d < 1000; d += 25) {
    const v = stepOpacity(d, o);
    assert.ok(v <= last + 1e-12);
    last = v;
  }
});
