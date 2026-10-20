// make emit: rebuild the HACRP emitted data from the pinned inputs, validate it, and write it. A rebuild that
// changes nothing keeps the committed built_at, so git stays clean.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseCsv } from '../../../engine/js/csv.js';
import { validate } from '../../../engine/js/schema.js';
import { formatEmitted, keepBuiltAt } from '../../../pipeline/contract.js';
import { REPO_ROOT, loadSchemas, readManifest, readPinned } from '../../../pipeline/files.js';
import { SOURCES, buildHacrp, emittedPath } from './build.js';

const builtAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
const next = buildHacrp({ rows: parseCsv(readPinned(SOURCES[0])), manifest: readManifest(), builtAt });

const schemas = loadSchemas();
const errors = validate(schemas['hacrp.schema.json'], next, { schemas });
if (errors.length > 0) {
  console.error(`HACRP emitted data fails its schema:\n  ${errors.slice(0, 20).join('\n  ')}`);
  process.exit(1);
}

const out = REPO_ROOT + emittedPath(next.fy);
const previous = existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : null;
const data = keepBuiltAt(previous, next);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, formatEmitted(data));
console.log(`${emittedPath(next.fy)}: ${data.hospitals.length} hospitals, built_at ${data.built_at}${data === next ? '' : ' (unchanged)'}`);
