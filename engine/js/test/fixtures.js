// Test-only loaders for pinned CMS inputs. Engine modules never read files.
import { parseCsv } from '../csv.js';
import { readPinned } from '../../../pipeline/files.js';

export { PINNED_DIR, SCHEMAS_DIR, readManifest, loadSchemas } from '../../../pipeline/files.js';

export function loadHacrpFy2026() {
  const text = readPinned('yq43-i98g');
  return { text, rows: parseCsv(text) };
}
