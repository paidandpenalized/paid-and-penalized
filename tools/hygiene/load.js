// Reads the local blocklist for the hooks. Fails closed: no list, an empty list, or a list inside the repo
// stops the commit.
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { parseBlocklist } from './blocklist.js';
import { assertOutsideRepo, blocklistPath } from './precommit-checks.js';

export function repoRoot() {
  return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
}

export function loadBlocklist(root = repoRoot()) {
  const path = blocklistPath(process.env, homedir());
  if (!existsSync(path)) {
    throw new Error(`blocklist not found at ${path}. Create it (one private name or string per line) or set PP_BLOCKLIST.`);
  }
  assertOutsideRepo(realpathSync(path), realpathSync(root));
  return parseBlocklist(readFileSync(path, 'utf8'));
}

// Runs a hook body; any thrown error or problem list ends the commit with exit 1.
export function runHook(name, body) {
  try {
    const problems = body();
    if (problems.length === 0) return;
    console.error(`${name}: commit blocked`);
    for (const p of problems) console.error(`  ${p}`);
  } catch (err) {
    console.error(`${name}: ${err.message}`);
  }
  process.exit(1);
}
