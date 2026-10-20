import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv } from '../csv.js';

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
