// Test-only loader for the pinned HACRP file. Engine modules never read files; repo paths and the manifest
// come from pipeline/files.js.
import { parseCsv } from '../csv.js';
import { readPinned } from '../../../pipeline/files.js';

export function loadHacrpFy2026() {
  const text = readPinned('yq43-i98g');
  return { text, rows: parseCsv(text) };
}
