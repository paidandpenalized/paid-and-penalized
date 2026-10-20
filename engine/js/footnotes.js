// CMS's footnote crosswalk (Provider Data Catalog y9us-9xdf) as a lookup: footnote code -> CMS's text, verbatim.
import { parseCsv } from './csv.js';

export function parseFootnotes(csvText) {
  const map = new Map();
  for (const row of parseCsv(csvText)) {
    const code = row['Footnote'];
    const text = row['Footnote Text'];
    if (code === undefined || text === undefined) throw new RangeError('footnote crosswalk: missing column');
    if (map.has(code)) throw new RangeError(`footnote crosswalk: duplicate code "${code}"`);
    map.set(code, text);
  }
  return map;
}

export function footnoteText(map, code) {
  if (!map.has(code)) throw new RangeError(`no CMS footnote text for code "${code}"`);
  return map.get(code);
}
