import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hubYear, shownYear } from '../years.js';

const A = 2026;
const B = A + 1;

test('shownYear: the newest year a program has results for, whatever the order; null when it has none', () => {
  assert.equal(shownYear({ years: [A, B] }), B);
  assert.equal(shownYear({ years: [B, A] }), B);
  assert.equal(shownYear({ years: [A] }), A);
  assert.equal(shownYear({ years: [] }), null);
});

test('hubYear: the year most programs have results for', () => {
  const programs = [{ years: [A] }, { years: [A] }, { years: [A] }, { years: [B] }];
  assert.equal(hubYear(programs), A);
});

test('hubYear: a tie goes to the later year, in any input order', () => {
  const programs = [{ years: [A] }, { years: [B] }, { years: [A] }, { years: [B] }];
  assert.equal(hubYear(programs), B);
  assert.equal(hubYear([...programs].reverse()), B);
});

test('hubYear: a year repeated inside one program counts once', () => {
  assert.equal(hubYear([{ years: [A, A, A] }, { years: [B] }, { years: [B] }]), B);
});

test('hubYear: unsorted years, programs with several years', () => {
  assert.equal(hubYear([{ years: [B, A] }, { years: [A] }, { years: [B, A] }]), A);
});

test('hubYear: null when no program has a year', () => {
  assert.equal(hubYear([]), null);
  assert.equal(hubYear([{ years: [] }, { years: [] }]), null);
});
