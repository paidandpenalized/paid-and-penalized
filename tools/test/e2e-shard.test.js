// The two CI browser shards together run every tools/e2e/*.test.js exactly once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { SHARD_ONE, shardFiles } from '../e2e/shard.js';

const files = readdirSync(new URL('../e2e/', import.meta.url)).filter((f) => f.endsWith('.test.js')).sort().map((f) => `tools/e2e/${f}`);

test('shard 1 and shard 2 together cover every e2e file exactly once', () => {
  const one = shardFiles(files, { E2E_SHARD: '1/2' });
  const two = shardFiles(files, { E2E_SHARD: '2/2' });
  assert.deepEqual([...one, ...two].sort(), files);
  assert.equal(new Set([...one, ...two]).size, files.length);
  assert.ok(one.length > 0 && two.length > 0);
});

test('shard 1 names only files that exist, and no E2E_SHARD runs every file', () => {
  for (const f of SHARD_ONE) assert.ok(files.includes(`tools/e2e/${f}`), `${f} is not an e2e test file`);
  assert.deepEqual(shardFiles(files, {}), files);
});

test('a malformed E2E_SHARD is refused', () => {
  for (const bad of ['3/2', '1/3', 'x', '1']) assert.throws(() => shardFiles(files, { E2E_SHARD: bad }), RangeError);
});
