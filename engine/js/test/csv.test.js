import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, toCsv } from '../csv.js';

test('header-keyed rows from a simple file', () => {
  assert.deepEqual(parseCsv('a,b\n1,2\n3,4\n'), [{ a: '1', b: '2' }, { a: '3', b: '4' }]);
});

test('quoted field keeps its comma', () => {
  assert.deepEqual(parseCsv('name,state\n"SMITH, JONES HOSPITAL",AL\n'), [{ name: 'SMITH, JONES HOSPITAL', state: 'AL' }]);
});

test('doubled quote inside a quoted field becomes one quote', () => {
  assert.deepEqual(parseCsv('x\n"say ""hi"""\n'), [{ x: 'say "hi"' }]);
});

test('CRLF and LF line endings parse the same', () => {
  assert.deepEqual(parseCsv('a,b\r\n1,2\r\n'), parseCsv('a,b\n1,2\n'));
});

test('quoted field may contain a newline', () => {
  assert.deepEqual(parseCsv('a,b\n"line1\nline2",2\n'), [{ a: 'line1\nline2', b: '2' }]);
});

test('empty fields are empty strings', () => {
  assert.deepEqual(parseCsv('a,b,c\n,,\n'), [{ a: '', b: '', c: '' }]);
});

test('no trailing newline still yields the last row; trailing newline adds no empty row', () => {
  assert.deepEqual(parseCsv('a\n1'), [{ a: '1' }]);
  assert.equal(parseCsv('a\n1\n').length, 1);
});

test('a row with the wrong field count throws', () => {
  assert.throws(() => parseCsv('a,b\n1,2,3\n'), /field count/);
  assert.throws(() => parseCsv('a,b\n1\n'), /field count/);
});

test('an unterminated quote throws', () => {
  assert.throws(() => parseCsv('a\n"open\n'), /unterminated/);
});

test('a leading byte-order mark is ignored', () => {
  assert.deepEqual(parseCsv('﻿a\n1\n'), [{ a: '1' }]);
});

test('a repeated header name throws instead of silently dropping a column', () => {
  assert.throws(() => parseCsv('a,a\n1,2\n'), /duplicate header/);
});

test('a quote inside an unquoted field, or text after a closing quote, throws', () => {
  assert.throws(() => parseCsv('a,b\nab"c,1\n'), /quote/);
  assert.throws(() => parseCsv('a,b\n"ab"x,1\n'), /quote/);
});

const COLS = [{ name: 'name', numeric: false }, { name: 'score', numeric: true }];

test('toCsv writes a header from the column names, CRLF line ends, and round-trips through parseCsv', () => {
  const rows = [['Hospital A', '-0.2580'], ['Smith, Jones "North"', '1.5'], ['Line\nbreak', '']];
  const text = toCsv(COLS, rows);
  assert.equal(text, 'name,score\r\nHospital A,-0.2580\r\n"Smith, Jones ""North""",1.5\r\n"Line\nbreak",\r\n');
  assert.deepEqual(parseCsv(text), rows.map(([name, score]) => ({ name, score })));
});

test('toCsv guards text cells that a spreadsheet would read as a formula; numbers keep their sign', () => {
  const rows = [['=SUM(A1)', '-1'], ['+cmd', '+2'], ['-x', '-0.5e-3'], ['@a', '3'], ['\tb', '4'], ['\rc', '5']];
  const out = parseCsv(toCsv(COLS, rows));
  assert.deepEqual(out.map((r) => r.name), ["'=SUM(A1)", "'+cmd", "'-x", "'@a", "'\tb", "'\rc"]);
  assert.deepEqual(out.map((r) => r.score), ['-1', '+2', '-0.5e-3', '3', '4', '5']);
});

test('toCsv guards a numeric cell that is not a number, and writes null and undefined as empty', () => {
  const out = parseCsv(toCsv(COLS, [['a', '=1+1'], [null, 'N/A'], [undefined, null]]));
  assert.deepEqual(out, [{ name: 'a', score: "'=1+1" }, { name: '', score: 'N/A' }, { name: '', score: '' }]);
  assert.equal(toCsv([{ name: '=h', numeric: false }], []), "'=h\r\n");
});

test('toCsv refuses a row whose length differs from the columns', () => {
  assert.throws(() => toCsv(COLS, [['a']]), /row 1 has 1 cells/);
});
