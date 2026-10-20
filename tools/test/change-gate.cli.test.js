// The change gate's CLI against a throwaway git repo, so the git plumbing is tested, not just the rule.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { REPO_ROOT } from '../../pipeline/files.js';

const GATE = join(REPO_ROOT, 'tools/ci/change-gate.js');

function repo() {
  const dir = mkdtempSync(join(tmpdir(), 'gate-'));
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'test@example.test');
  git('config', 'user.name', 'test');
  git('config', 'commit.gpgsign', 'false');
  git('config', 'core.hooksPath', '/dev/null');
  const write = (path, text) => {
    mkdirSync(join(dir, path, '..'), { recursive: true });
    writeFileSync(join(dir, path), text);
  };
  const commit = (msg) => {
    git('add', '-A');
    git('commit', '-q', '-m', msg);
    return git('rev-parse', 'HEAD');
  };
  const gate = (base, labels) =>
    spawnSync('node', [GATE], { cwd: dir, encoding: 'utf8', env: { ...process.env, GATE_BASE: base, PR_LABELS: labels ?? '' } });
  return { dir, write, commit, gate };
}

const emitted = (source, rows) => `{\n"source_manifest": "${source}",\n"hospitals": [\n${rows.join(',\n')}\n]\n}\n`;
const FILE = 'data/emitted/hacrp/fy2026/hacrp.json';

test('CLI: the gate reads git correctly for each reason, and fails without one', (t) => {
  const r = repo();
  t.after(() => rmSync(r.dir, { recursive: true, force: true }));
  r.write('docs/METHODS-LOG.md', '# Methods log\n\n## hacrp methods_version 1 (2026-10-20)\n- first\n');
  r.write(FILE, emitted('aa', ['{"v":1}']));
  const base = r.commit('base');

  r.write(FILE, emitted('aa', ['{"v":2}']));
  const silent = r.commit('numbers move, no reason');
  assert.equal(r.gate(base).status, 1);
  assert.equal(r.gate(base, '["new-cms-release"]').status, 0);
  assert.equal(r.gate(base, 'null').status, 1);

  r.write('docs/METHODS-LOG.md', '# Methods log\n\n## hacrp methods_version 1 (2026-10-20)\n- first (typo fixed)\n');
  r.commit('log typo only');
  assert.equal(r.gate(base).status, 1);

  r.write('docs/METHODS-LOG.md', '# Methods log\n\n## hacrp methods_version 1 (2026-10-20)\n- first (typo fixed)\n\n## hacrp methods_version 2 (2026-11-02)\n- why\n');
  const bumped = r.commit('new methods version');
  assert.equal(r.gate(base).status, 0);

  r.write(FILE, emitted('bb', ['{"v":3}']));
  const repinned = r.commit('re-pin');
  assert.equal(r.gate(bumped).status, 0, 'a source_manifest change is a reason on its own');
  assert.equal(r.gate(silent).status, 0);
  assert.equal(r.gate('0'.repeat(40)).status, 0, 'a new branch push compares with HEAD~1');
  assert.equal(r.gate(repinned).status, 0, 'nothing changed');
});
