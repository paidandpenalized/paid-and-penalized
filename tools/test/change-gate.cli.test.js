// The change gate's CLI against a throwaway git repo, so the git plumbing is tested, not just the rule.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
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
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  };
  const commit = (msg) => {
    git('add', '-A');
    git('commit', '-q', '-m', msg);
    return git('rev-parse', 'HEAD');
  };
  const gate = (base) => spawnSync('node', [GATE], { cwd: dir, encoding: 'utf8', env: { ...process.env, GATE_BASE: base } });
  return { dir, write, commit, gate };
}

const emitted = (version, rows) => `{\n"methods_version": ${version},\n"sources": ["pin-a"],\n"hospitals": [\n${rows.join(',\n')}\n]\n}\n`;
const manifest = (sha256, retrieved) => JSON.stringify([{ id: 'pin-a', sha256, retrieved }]);
const FILE = 'data/emitted/hacrp/fy2026/hacrp.json';
const OLDER = 'data/emitted/hacrp/fy2025/hacrp.json';
const LOG_V1 = '# Methods log\n\n## hacrp methods_version 1 (2026-10-20)\n- first\n';
const LOG_V2 = LOG_V1 + '\n## hacrp methods_version 2 (2026-11-02)\n- why\n';

test('CLI: the gate reads git correctly for each reason, and fails without one', (t) => {
  const r = repo();
  t.after(() => rmSync(r.dir, { recursive: true, force: true }));
  r.write('data/pinned/manifest.json', manifest('aa', '2026-10-20'));
  r.write('docs/METHODS-LOG.md', LOG_V1);
  r.write(FILE, emitted(1, ['{"v":1}']));
  r.write(OLDER, emitted(1, ['{"v":0}']));
  const base = r.commit('base');

  r.write('data/emitted/hvbp/fy2026/hvbp.json', emitted(1, ['{"v":9}']));
  const start = r.commit('a new emitted file');
  assert.equal(r.gate(base).status, 0, 'a first emission needs no reason');

  r.write(FILE, emitted(1, ['{"v":2}']));
  const silent = r.commit('numbers move, no reason');
  assert.equal(r.gate(start).status, 1);

  r.write('docs/METHODS-LOG.md', LOG_V1.replace('2026-10-20', '2026-10-21'));
  r.write('data/pinned/manifest.json', manifest('aa', '2026-10-21'));
  r.commit('heading date edit and manifest metadata edit: neither is a reason');
  assert.equal(r.gate(start).status, 1);

  r.write('docs/METHODS-LOG.md', LOG_V2);
  r.write(FILE, emitted(2, ['{"v":3}']));
  const bumped = r.commit('methods_version 2 for the newest year');
  assert.equal(r.gate(silent).status, 0);

  r.write('docs/METHODS-LOG.md', LOG_V2 + '\n## hacrp methods_version 3 (2026-11-03)\n');
  r.write(FILE, emitted(3, ['{"v":4}']));
  r.write(OLDER, emitted(1, ['{"v":-1}']));
  r.commit('a bump does not excuse an older year whose version stayed');
  assert.equal(r.gate(bumped).status, 1);

  r.write(OLDER, emitted(1, ['{"v":0}']));
  r.write('data/pinned/manifest.json', manifest('bb', '2026-11-03'));
  r.write(FILE, emitted(3, ['{"v":5}']));
  r.commit('restore the older year; re-pin');
  assert.equal(r.gate(bumped).status, 0, 'a bump and a re-pin explain the newest year');
  assert.equal(r.gate('0'.repeat(40)).status, 0, 'a branch\'s first push compares with HEAD~1');
  const lost = r.gate('f'.repeat(40));
  assert.equal(lost.status, 1, 'an unreachable base (force-push) fails closed');
  assert.match(lost.stderr, /not in this history/);
});
