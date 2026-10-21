// RFC 4180 CSV: a parser and the project's one writer (toCsv, below).
// parseCsv: quoted fields, doubled quotes, CRLF or LF, newlines inside quotes. Returns one object per data row, keyed
// by the header row. Throws on malformed input rather than guessing, so a changed upstream file fails loudly.

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

// RFC 4180 CSV text from columns ({ name, numeric }) and rows (arrays of cells, in column order): a header row, CRLF
// line ends, cells holding a quote, comma, CR or LF quoted with inner quotes doubled; null and undefined are empty.
// A text cell starting with =, +, -, @, a tab or CR gets a leading ' so a spreadsheet reads it as text, not a
// formula. A numeric cell is written as it is when it reads as a number, so -0.2580 stays -0.2580; any other text in
// a numeric column is guarded like a text cell.
const FORMULA = /^[=+\-@\t\r]/;
const NUMBER = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/;
const QUOTE = /[",\r\n]/;

function csvCell(value, numeric) {
  let text = value === null || value === undefined ? '' : String(value);
  if (FORMULA.test(text) && !(numeric && NUMBER.test(text))) text = `'${text}`;
  return QUOTE.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(columns, rows) {
  const lines = [columns.map((c) => csvCell(c.name, false))];
  rows.forEach((row, i) => {
    if (row.length !== columns.length) throw new RangeError(`toCsv: row ${i + 1} has ${row.length} cells, not ${columns.length}`);
    lines.push(row.map((cell, j) => csvCell(cell, columns[j].numeric)));
  });
  return lines.map((cells) => cells.join(',') + '\r\n').join('');
}
