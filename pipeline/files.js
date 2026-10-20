// Repo file access for pipeline CLIs and tests. The engine itself never reads files.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url));
export const PINNED_DIR = REPO_ROOT + 'data/pinned/';
export const SCHEMAS_DIR = REPO_ROOT + 'schemas/';

export const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

export function readManifest() {
  return readJson(PINNED_DIR + 'manifest.json');
}

export function readPinned(id, encoding = 'utf8') {
  const entry = readManifest().find((e) => e.id === id);
  if (!entry) throw new RangeError(`no pinned input "${id}" in the manifest`);
  return readFileSync(PINNED_DIR + entry.path, encoding);
}

// Every schemas/*.schema.json, keyed by file name (which is also its $id).
export function loadSchemas() {
  return Object.fromEntries(
    readdirSync(SCHEMAS_DIR)
      .filter((f) => f.endsWith('.schema.json'))
      .map((f) => [f, readJson(SCHEMAS_DIR + f)]),
  );
}
