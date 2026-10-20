// RFC 4180 CSV parser: quoted fields, doubled quotes, CRLF or LF, newlines inside quotes.
// Returns one object per data row, keyed by the header row. Throws on malformed input
// rather than guessing, so a changed upstream file fails loudly.

function parseRecords(text) {
  const records = [];
  let record = [];
  let field = '';
  let inQuotes = false;
  let quoted = false; // the current field was a quoted field that has closed
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;

  for (; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
          quoted = true;
        }
      } else {
        field += c;
      }
    } else if (c === ',') {
      record.push(field);
      field = '';
      quoted = false;
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      record.push(field);
      records.push(record);
      record = [];
      field = '';
      quoted = false;
    } else if (quoted) {
      throw new SyntaxError('CSV: text after a closing quote');
    } else if (c === '"') {
      if (field !== '') throw new SyntaxError('CSV: quote inside an unquoted field');
      inQuotes = true;
    } else {
      field += c;
    }
  }
  if (inQuotes) throw new SyntaxError('CSV: unterminated quoted field');
  if (field !== '' || quoted || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  return records;
}

export function parseCsv(text) {
  const [header, ...body] = parseRecords(text);
  if (!header) return [];
  if (new Set(header).size !== header.length) throw new RangeError('CSV: duplicate header name');
  return body.map((values, index) => {
    if (values.length !== header.length) {
      throw new RangeError(`CSV: field count ${values.length} != header ${header.length} at data row ${index + 1}`);
    }
    return Object.fromEntries(header.map((name, j) => [name, values[j]]));
  });
}
