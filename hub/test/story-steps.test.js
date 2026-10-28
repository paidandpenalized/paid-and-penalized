// The home story's scroll logic (hub/client/story/steps.js): which step is being read.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeStep } from '../client/story/steps.js';

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
