// Shared test helpers for the page build.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Runs fn(dir) in a fresh folder under the system temp directory and removes it afterwards, pass or fail.
export function withTemp(prefix, fn) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  return Promise.resolve().then(() => fn(dir)).finally(() => rmSync(dir, { recursive: true, force: true }));
}
