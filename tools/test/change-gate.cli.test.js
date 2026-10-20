// The change gate's CLI against a throwaway git repo, so the git plumbing is tested, not just the rule.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { REPO_ROOT } from '../../pipeline/files.js';
import { sourceManifestHash } from '../../pipeline/contract.js';

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
  const mv = (from, to) => git('mv', from, to);
  const rm = (path) => git('rm', '-q', path);
  const commit = (msg) => {
    git('add', '-A');
    git('commit', '-q', '-m', msg);
    return git('rev-parse', 'HEAD');
  };
  const gate = (base) => spawnSync('node', [GATE], { cwd: dir, encoding: 'utf8', env: { ...process.env, GATE_BASE: base } });
  return { dir, write, mv, rm, commit, gate };
}

const hashOf = (sha256) => sourceManifestHash([{ id: 'pin-a', sha256 }]);
const manifest = (sha256, retrieved) => JSON.stringify([{ id: 'pin-a', sha256, retrieved }]);
const emitted = (version, rows, sha256 = 'aa') =>
  `{\n"methods_version": ${version},\n"source_manifest": "${hashOf(sha256)}",\n"sources": ["pin-a"],\n"hospitals": [\n${rows.join(',\n')}\n]\n}\n`;
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
  r.commit('a heading date edit and a manifest metadata edit are not reasons');
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

  r.write('data/pinned/manifest.json', manifest('bb', '2026-11-03'));
  r.write(OLDER, emitted(1, ['{"v":0}'], 'bb'));
  r.write(FILE, emitted(3, ['{"v":5}'], 'bb'));
  const repinned = r.commit('re-pin both years (a shared input changed)');
  assert.equal(r.gate(bumped).status, 0, 'a bump and a re-pin explain the newest year');
  assert.equal(r.gate('0'.repeat(40)).status, 0, 'a branch\'s first push compares with HEAD~1');

  r.write('data/pinned/manifest.json', manifest('cc', '2026-11-04'));
  const pinOnly = r.commit('push 1: the re-pin alone');
  r.write(FILE, emitted(3, ['{"v":6}'], 'cc'));
  r.commit('push 2: make emit');
  assert.equal(r.gate(pinOnly).status, 1, 'pin and re-emit belong in the same change');
  assert.equal(r.gate(repinned).status, 0, 'together they pass');

  r.write('corrections/2026-11-01-old.md', 'an old correction\n');
  r.write('data/emitted/hacrp/fy2024/hacrp.json', emitted(1, ['{"v":0}'], 'cc'));
  const withOld = r.commit('an old correction, and a first emission of fy2024');
  r.mv(OLDER, 'data/emitted/hacrp/fy2025/hacrp-final.json');
  const renamed = r.commit('a rename is a delete plus an add');
  assert.equal(r.gate(withOld).status, 1, 'the delete half needs a corrections entry');
  r.write('corrections/2026-11-02-copy.md', 'an old correction\n');
  r.write('corrections/2026-11-03-empty.md', '');
  r.commit('a copy of an old correction, and an empty one');
  assert.equal(r.gate(withOld).status, 1, 'old or empty content under a new name is not a new correction');
  r.write('corrections/2026-11-04-hacrp.md', 'renamed fy2025\n');
  r.write('data/emitted/hacrp/notes.txt', 'not json\n');
  const corrected = r.commit('a real correction, plus a stray non-JSON file');
  assert.equal(r.gate(withOld).status, 0, 'a new corrections entry covers it all, and a stray file does not crash the gate');
  const fromData = spawnSync('node', [GATE], { cwd: join(r.dir, 'data'), encoding: 'utf8', env: { ...process.env, GATE_BASE: withOld } });
  assert.equal(fromData.status, 0, 'the same verdict from a subdirectory (paths are repo-relative)');

  r.rm('data/emitted/hacrp/fy2024/hacrp.json');
  r.commit('delete an emitted file, no entry');
  assert.equal(r.gate(corrected).status, 1, 'a deletion alone needs an entry');
  r.write('corrections/2026-11-05-fy2024.md', 'withdrew fy2024\n');
  r.commit('the entry for it');
  assert.equal(r.gate(corrected).status, 0, 'a deletion with a new entry passes');

  r.write('corrections/2026-11-01-old.md', 'an old correction, rewritten\n');
  r.write(FILE, emitted(3, ['{"v":7}'], 'cc'));
  r.write('corrections/2026-11-06-hacrp.md', 'another\n');
  const rewritten = r.commit('a new entry while rewriting an old one');
  assert.equal(r.gate(`${rewritten}~1`).status, 1, 'the log is append-only');

  const lost = r.gate('f'.repeat(40));
  assert.equal(lost.status, 1, 'an unreachable base (force-push) fails closed');
  assert.match(lost.stderr, /not in this history/);
});
