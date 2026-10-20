// Test-only loaders for pinned CMS inputs. Engine modules never read files.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseCsv } from '../csv.js';

export const PINNED_DIR = fileURLToPath(new URL('../../../data/pinned/', import.meta.url));

export function readManifest() {
  return JSON.parse(readFileSync(PINNED_DIR + 'manifest.json', 'utf8'));
}

export function loadHacrpFy2026() {
  const entry = readManifest().find((e) => e.id === 'yq43-i98g');
  const text = readFileSync(PINNED_DIR + entry.path, 'utf8');
  return { text, rows: parseCsv(text) };
}

export const SCHEMAS_DIR = fileURLToPath(new URL('../../../schemas/', import.meta.url));

// Every schemas/*.schema.json, keyed by file name (which is also its $id).
export function loadSchemas() {
  return Object.fromEntries(
    readdirSync(SCHEMAS_DIR)
      .filter((f) => f.endsWith('.schema.json'))
      .map((f) => [f, JSON.parse(readFileSync(SCHEMAS_DIR + f, 'utf8'))]),
  );
}
