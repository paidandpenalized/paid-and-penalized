// Test-only loaders for pinned CMS inputs. Engine modules never read files.
import { readFileSync } from 'node:fs';
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
