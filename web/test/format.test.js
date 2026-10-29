import { test } from 'node:test';
import assert from 'node:assert/strict';
import { capitalize, decimal, dollars, dotList, fractionWord, money, moneyRange, noun, numberWord, ordinal, pct, pctFloor, placeText, roundedDollars, signed, spelled, unbroken } from '../render/format.js';

test('money shortens dollars as Thirty Day Readmissions does, a true minus for a negative', () => {
  const cases = [
    [0, '$0'], [640, '$640'], [999.4, '$999'], [999.5, '$1K'], [48_210, '$48K'], [999_499, '$999K'], [999_500, '$1.0M'],
    [1_234_567, '$1.2M'], [99_949_999, '$99.9M'], [99_950_000, '$100M'], [342_400_000, '$342M'], [999_499_999, '$999M'],
    [999_500_000, '$1.0B'], [1_049_999_999, '$1.0B'], [-280_437_699, '−$280M'], [-614_565, '−$615K'], [-0.4, '$0'],
  ];
  for (const [x, want] of cases) assert.equal(money(x), want, String(x));
  assert.throws(() => money(NaN), RangeError);
  assert.throws(() => money(null), RangeError);
});

test('noun puts a count before its noun, singular for exactly one', () => {
  assert.equal(noun(1, 'hospital'), '1 hospital');
  assert.equal(noun(0, 'hospital'), '0 hospitals');
  assert.equal(noun(1234, 'cut hospital'), '1,234 cut hospitals');
  assert.equal(noun(2, 'mile'), '2 miles');
  assert.equal(noun(1, 'child', 'children'), '1 child');
  assert.equal(noun(3, 'child', 'children'), '3 children');
});

test('money and pct take a sign on request: + before a positive amount, never before one that reads as zero', () => {
  assert.equal(money(1_234_567, { sign: true }), '+$1.2M');
  assert.equal(money(-614_565, { sign: true }), '−$615K');
  assert.equal(money(0.4, { sign: true }), '$0');
  assert.equal(money(0, { sign: true }), '$0');
  assert.equal(money(640), '$640', 'no sign unless asked');
  assert.equal(pct(0.0301, 1, { sign: true }), '+3.0%');
  assert.equal(pct(-0.0155, 1, { sign: true }), '−1.6%');
  assert.equal(pct(0.0001, 1, { sign: true }), '0.0%');
  assert.equal(pct(-0.0001, 1), '0.0%', 'a negative share that reads zero has no minus');
  assert.equal(pct(-0.0001, 1, { sign: true }), '0.0%');
  assert.equal(pct(0.5, 0), '50%');
});

test('roundedDollars writes the nearest whole dollar', () => {
  assert.equal(roundedDollars(1234.5), '$1,235');
  assert.equal(roundedDollars(1234.49), '$1,234');
  assert.equal(roundedDollars(-0.4), '$0');
  assert.equal(roundedDollars(615.6, { sign: true }), '+$616');
});

test('moneyRange says a shared unit once and never uses a dash beside a minus', () => {
  assert.equal(moneyRange(1_000_000, 1_400_000), '$1.0–1.4M');
  assert.equal(moneyRange(850_000, 1_200_000), '$850K–$1.2M');
  assert.equal(moneyRange(400, 900), '$400–$900');
  assert.equal(moneyRange(12_000, 12_400), '$12–12K');
  assert.equal(moneyRange(-12_000, 40_000), '−$12K to $40K');
  assert.equal(moneyRange(-1_400_000, -1_000_000), '−$1.4M to −$1.0M');
  assert.throws(() => moneyRange(2, 1), RangeError);
  assert.throws(() => moneyRange(NaN, 1), RangeError);
});

test('dollars writes whole dollars with separators; a sign on request', () => {
  assert.equal(dollars(48_691_794), '$48,691,794');
  assert.equal(dollars(-58_430), '−$58,430');
  assert.equal(dollars(106_253, { sign: true }), '+$106,253');
  assert.equal(dollars(0, { sign: true }), '$0');
  assert.throws(() => dollars(1.5), RangeError);
});

test('decimal keeps the given decimals, a true minus and no plus sign', () => {
  assert.equal(decimal(0.38, 4), '0.3800');
  assert.equal(decimal(-0.00123, 4), '−0.0012');
  assert.equal(decimal(0.0007000000000000339, 4), '0.0007');
  assert.equal(decimal(1234.5, 1), '1,234.5');
  assert.equal(decimal(-0.00001, 4), '0.0000');
});

test('ordinal: st, nd, rd and th, with the teens all th', () => {
  const got = [1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 75, 101, 111, 112].map(ordinal);
  assert.deepEqual(got, ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '75th', '101st', '111th', '112th']);
});

test('cached formatters keep each call\'s style and decimals apart', () => {
  assert.deepEqual([decimal(0.5, 1), pct(0.5, 1), decimal(0.5, 2), pct(0.5, 0), signed(0.5, 1)], ['0.5', '50.0%', '0.50', '50%', '+0.5']);
});

test('spelled writes a whole number from 0 to 99 in words, for a rule\'s number in a sentence', () => {
  assert.deepEqual([0, 1, 5, 11, 19, 20, 21, 30, 45, 99].map(spelled),
    ['zero', 'one', 'five', 'eleven', 'nineteen', 'twenty', 'twenty-one', 'thirty', 'forty-five', 'ninety-nine']);
  for (const bad of [-1, 100, 2.5, NaN, '30', null, undefined]) assert.throws(() => spelled(bad), RangeError, String(bad));
});

test('fractionWord writes a share as a quarter or three-quarters, with the determiner a singular fraction takes, and throws on a share it has no word for', () => {
  assert.equal(fractionWord(0.25), 'a quarter');
  assert.equal(fractionWord(0.25, 'the'), 'the quarter');
  assert.equal(fractionWord(0.75), 'three-quarters');
  assert.equal(fractionWord(0.75, 'the'), 'three-quarters', 'a plural fraction takes none');
  for (const bad of [0, 0.3, 1, 25, NaN, '0.25', undefined]) assert.throws(() => fractionWord(bad), RangeError, String(bad));
});

test('numberWord spells a small count and leaves a larger one in digits', () => {
  assert.deepEqual([0, 1, 5, 10].map(numberWord), ['none', 'one', 'five', 'ten']);
  assert.equal(numberWord(11), '11');
  assert.equal(numberWord(1234), '1,234');
});

test('placeText: "City, ST", or as much of it as a record has', () => {
  assert.equal(placeText({ city: 'Springfield', state: 'ZZ' }), 'Springfield, ZZ');
  assert.equal(placeText({ city: null, state: 'ZZ' }), 'ZZ');
  assert.equal(placeText({ city: 'Springfield', state: undefined }), 'Springfield');
  assert.equal(placeText({}), '');
});

test('dotList joins items with middle dots, each held to the item before it, so no wrapped line starts with one; unbroken keeps words on one line', () => {
  assert.equal(dotList(['Major teaching', '120 beds', 'Urban']), 'Major teaching\u00a0· 120 beds\u00a0· Urban');
  assert.equal(dotList(['Urban']), 'Urban');
  assert.doesNotMatch(dotList(['a', 'b', 'c']), / ·/, 'never a breakable space before a dot');
  assert.equal(unbroken('1,234 beds'), '1,234\u00a0beds', 'a count never parts from its noun');
});

test('capitalize upper-cases the first letter only, and leaves an empty string empty', () => {
  assert.equal(capitalize('fewer than ten'), 'Fewer than ten');
  assert.equal(capitalize('Already'), 'Already');
  assert.equal(capitalize(''), '');
});

test('pctFloor rounds a share down, never across a step: higher-than sentences stay true', () => {
  assert.equal(pctFloor(2195 / 2928), '74%', '74.97% is not higher than 75%');
  assert.equal(pct(2195 / 2928, 0), '75%', 'which rounding would claim');
  assert.equal(pctFloor(2196 / 2928), '75%', 'exactly 75%');
  assert.equal(pctFloor(0.7499999999999), '75%', 'a float a hair under a step');
  assert.equal(pctFloor(0.12345, 1), '12.3%');
  assert.equal(pctFloor(0), '0%');
  assert.equal(pctFloor(1), '100%');
});
