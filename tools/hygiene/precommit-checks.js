// Pure checks behind the pre-commit hook: the size limit, the blocklist scan, and where the list may live.
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { findHits } from './blocklist.js';

// Pinned inputs under 10 MiB live in git; anything larger goes to a release or object storage instead.
export const MAX_BYTES = 10 * 1024 * 1024;
const BINARY_SNIFF = 8000;

export function blocklistPath(env, home) {
  return env.PP_BLOCKLIST || join(home, '.config', 'paid-and-penalized', 'blocklist.txt');
}

// A list inside the repo could be committed, which would publish the names it protects.
export function assertOutsideRepo(listPath, repoRoot) {
  const rel = relative(resolve(repoRoot), resolve(listPath));
  const outside = rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel);
  if (!outside) {
    throw new RangeError('blocklist: the list must live outside the repository');
  }
}

// Text to scan, or null for a binary file. UTF-16 with a byte-order mark is text (Windows "Unicode" exports).
function textOf(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return bytes.subarray(2).toString('utf16le');
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  return bytes.subarray(0, BINARY_SNIFF).includes(0) ? null : bytes.toString('utf8');
}

// files: { path, size, bytes }, where bytes may be left out of a file at or over the limit. Returns problem
// messages; empty = OK. A hit names the file, line and entry number, never the entry itself.
export function checkStaged({ files, entries, maxBytes = MAX_BYTES }) {
  const problems = [];
  for (const { path, size, bytes } of files) {
    for (const { entry } of findHits(path, entries)) problems.push(`staged file path matches blocklist entry ${entry}`);
    if (size >= maxBytes) {
      problems.push(`${path}: ${size} bytes is at or over the ${maxBytes}-byte limit for files in git`);
      continue;
    }
    const text = textOf(bytes);
    if (text === null) continue;
    for (const { entry, line } of findHits(text, entries)) {
      problems.push(`${path}:${line}: matches blocklist entry ${entry}`);
    }
  }
  return problems;
}
