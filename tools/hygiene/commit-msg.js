// commit-msg hook: the message must be free of blocklisted strings.
import { readFileSync } from 'node:fs';
import { findHits } from './blocklist.js';
import { loadBlocklist, runHook } from './load.js';

runHook('commit-msg', () => {
  const entries = loadBlocklist();
  return findHits(readFileSync(process.argv[2], 'utf8'), entries).map(
    ({ entry, line }) => `commit message line ${line}: matches blocklist entry ${entry}`,
  );
});
