// web/client/live-status.js: a live region's words are said at once, or, while the reader types, once they pause; a
// later call (typing or not) replaces a waiting one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SETTLE_MS, liveStatus } from '../client/live-status.js';

test('typing waits for a pause; anything else is said at once and cancels a waiting count', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const status = { textContent: '' };
  const say = liveStatus(status);
  say('3 shown.');
  assert.equal(status.textContent, '3 shown.', 'at once');
  say('2 shown.', true);
  say('1 shown.', true);
  t.mock.timers.tick(SETTLE_MS - 1);
  assert.equal(status.textContent, '3 shown.', 'nothing said mid-word');
  t.mock.timers.tick(1);
  assert.equal(status.textContent, '1 shown.', 'only the last count, after the pause');
  say('4 shown.', true);
  say('Sorted. 4 shown.');
  t.mock.timers.tick(SETTLE_MS);
  assert.equal(status.textContent, 'Sorted. 4 shown.', 'an immediate message replaces a waiting one');
});
