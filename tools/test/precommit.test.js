// Pre-commit checks on staged files: size limit, text scan, and where the blocklist may live.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkStaged, assertOutsideRepo, blocklistPath, MAX_BYTES } from '../hygiene/precommit-checks.js';

const entries = ['Jane Placeholder'];

test('the size limit is 10 MiB: a file of exactly 10 MiB is refused, one byte less passes', () => {
  assert.equal(MAX_BYTES, 10 * 1024 * 1024);
  const at = { path: 'big.csv', bytes: Buffer.alloc(MAX_BYTES, 0x61) };
  const under = { path: 'ok.csv', bytes: Buffer.alloc(MAX_BYTES - 1, 0x61) };
  assert.equal(checkStaged({ files: [at], entries }).length, 1);
  assert.deepEqual(checkStaged({ files: [under], entries }), []);
});

test('a text hit names the file, line and entry number, not the entry', () => {
  const problems = checkStaged({ files: [{ path: 'docs/a.md', bytes: Buffer.from('ok\nby Jane Placeholder\n') }], entries });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /docs\/a\.md:2/);
  assert.match(problems[0], /entry 1/);
  assert.doesNotMatch(problems[0], /Placeholder/);
});

test('a binary file skips the text scan but not the size check', () => {
  const bin = Buffer.concat([Buffer.from([0]), Buffer.from('Jane Placeholder')]);
  assert.deepEqual(checkStaged({ files: [{ path: 'a.png', bytes: bin }], entries }), []);
  const bigBin = Buffer.alloc(MAX_BYTES);
  assert.equal(checkStaged({ files: [{ path: 'b.png', bytes: bigBin }], entries }).length, 1);
});

test('the blocklist must live outside the repo', () => {
  assert.throws(() => assertOutsideRepo('/r/repo/list.txt', '/r/repo'), RangeError);
  assert.throws(() => assertOutsideRepo('/r/repo/a/../b/list.txt', '/r/repo'), RangeError);
  assert.throws(() => assertOutsideRepo('/r/other/../repo/list.txt', '/r/repo'), RangeError);
  assert.doesNotThrow(() => assertOutsideRepo('/r/repo-lists/list.txt', '/r/repo'));
  assert.doesNotThrow(() => assertOutsideRepo('/home/u/.config/x/list.txt', '/r/repo'));
});

test('blocklist path: PP_BLOCKLIST wins, else the config default', () => {
  assert.equal(blocklistPath({ PP_BLOCKLIST: '/tmp/l.txt' }, '/home/u'), '/tmp/l.txt');
  assert.equal(blocklistPath({}, '/home/u'), '/home/u/.config/paid-and-penalized/blocklist.txt');
});
