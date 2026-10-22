// make emit: rebuild the HACRP emitted data from the pinned inputs, validate it, and write it. A rebuild that
// changes nothing keeps the committed built_at, so git stays clean.
import { existsSync } from 'node:fs';
import { parseCsv } from '../../../engine/js/csv.js';
import { validate } from '../../../engine/js/schema.js';
import { formatEmitted, keepBuiltAt } from '../../../pipeline/contract.js';
import { REPO_ROOT, loadSchemas, readJson, readManifest, readPinned, writeFileMkdir } from '../../../pipeline/files.js';
import { SOURCES, buildHacrp, emittedPath } from './build.js';
import { buildHistory, historyFilesFrom, historyPath, infectionFilesFrom } from './history.js';

const builtAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
const next = buildHacrp({ rows: parseCsv(readPinned(SOURCES[0])), manifest: readManifest(), builtAt });

const schemas = loadSchemas();
const errors = validate(schemas['hacrp.schema.json'], next, { schemas });
if (errors.length > 0) {
  console.error(`HACRP emitted data fails its schema:\n  ${errors.slice(0, 20).join('\n  ')}`);
  process.exit(1);
}

const out = REPO_ROOT + emittedPath(next.fy);
const previous = existsSync(out) ? readJson(out) : null;
const data = keepBuiltAt(previous, next);
writeFileMkdir(out, formatEmitted(data));
console.log(`${emittedPath(next.fy)}: ${data.hospitals.length} hospitals, built_at ${data.built_at}${data.built_at === next.built_at ? '' : ' (unchanged)'}`);

// The history: every program year's pinned file, in one emitted file.
const history = buildHistory({ files: historyFilesFrom(readPinned, parseCsv), infections: infectionFilesFrom(readPinned, parseCsv), manifest: readManifest(), builtAt });
const historyErrors = validate(schemas['hacrp-history.schema.json'], history, { schemas });
if (historyErrors.length > 0) {
  console.error(`HACRP history fails its schema:\n  ${historyErrors.slice(0, 20).join('\n  ')}`);
  process.exit(1);
}
const historyOut = REPO_ROOT + historyPath(history.fy);
const historyKept = keepBuiltAt(existsSync(historyOut) ? readJson(historyOut) : null, history);
writeFileMkdir(historyOut, formatEmitted(historyKept));
console.log(`${historyPath(history.fy)}: ${history.years.length} years, built_at ${historyKept.built_at}${historyKept.built_at === history.built_at ? '' : ' (unchanged)'}`);
