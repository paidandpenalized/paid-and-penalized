// The hub's code takes a shared name from the module that owns it, never through another module's re-export (the
// states' table is engine/js/states.js's; web/charts/geo.js re-exports it for the program sites' maps).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REPO_ROOT, repoFiles } from '../../pipeline/files.js';

// The names geo.js re-exports ("export { A, B };"), read from the file so a new one is covered too.
const GEO = readFileSync(REPO_ROOT + 'web/charts/geo.js', 'utf8');
const REEXPORTS = [...GEO.matchAll(/^export \{([^}]+)\};/gm)].flatMap((m) => m[1].split(',').map((n) => n.trim()));

test('no hub file imports a name web/charts/geo.js only re-exports', () => {
  assert.ok(REEXPORTS.includes('STATE_NAMES'), 'geo.js re-exports the states\' names');
  const files = repoFiles('hub/', { untracked: true }).filter((p) => p.endsWith('.js') && !p.startsWith('hub/test/'));
  assert.ok(files.length > 20);
  const strays = [];
  for (const file of files) {
    for (const [, names] of readFileSync(REPO_ROOT + file, 'utf8').matchAll(/import \{([^}]+)\} from '[^']*\/charts\/geo\.js'/g)) {
      for (const name of names.split(',').map((n) => n.trim())) if (REEXPORTS.includes(name)) strays.push(`${file}: ${name}`);
    }
  }
  assert.deepEqual(strays, [], 'import these from engine/js/states.js');
});
