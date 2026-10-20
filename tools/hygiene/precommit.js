// pre-commit hook: staged files must be under the size limit and free of blocklisted strings, and gitleaks must
// find no secrets in the staged changes.
import { execFileSync } from 'node:child_process';
import { checkStaged, MAX_BYTES } from './precommit-checks.js';
import { loadBlocklist, runHook } from './load.js';

function git(args, encoding = 'utf8') {
  return execFileSync('git', args, { encoding, maxBuffer: MAX_BYTES * 2 });
}

function stagedFiles() {
  const paths = git(['diff', '--cached', '--name-only', '--diff-filter=ACMRT', '-z']).split('\0').filter(Boolean);
  return paths.map((path) => {
    const size = Number(git(['cat-file', '-s', `:${path}`]).trim());
    return { path, size, bytes: size >= MAX_BYTES ? undefined : git(['cat-file', 'blob', `:${path}`], 'buffer') };
  });
}

function gitleaks() {
  try {
    execFileSync('gitleaks', ['git', '--staged', '--redact', '--no-banner', '--log-level', 'warn'], { stdio: 'inherit' });
    return [];
  } catch (err) {
    if (err.code === 'ENOENT') return ['gitleaks is not installed (brew install gitleaks)'];
    return ['gitleaks found a possible secret in the staged changes (see above)'];
  }
}

runHook('pre-commit', () => {
  const entries = loadBlocklist();
  const problems = checkStaged({ files: stagedFiles(), entries });
  return problems.length > 0 ? problems : gitleaks();
});
