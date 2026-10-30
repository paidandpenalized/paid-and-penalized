// The share cards (web/share-card.js, tools/og/): each committed card is the one its HTML draws today, 1200 by 630, small
// enough to fetch, and the HTML holds no numbers in its words.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REPO_ROOT, readJson } from '../../pipeline/files.js';
import { CARD_SIZE, CARD_STAMP, SHARE_CARDS, cardFile } from '../../web/share-card.js';
import { sha256 } from '../../pipeline/site/assets.js';
import { RENDER, cardDots, cardHtml, cardInputs } from '../og/card.js';

const INPUTS = cardInputs();
const STAMP = readJson(REPO_ROOT + CARD_STAMP);
const RERUN = 'run `npm run og` and commit web/og/';

// A PNG's width and height from its IHDR chunk, the first after the eight-byte signature.
function pngSize(png) {
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'a PNG signature');
  assert.equal(png.toString('ascii', 12, 16), 'IHDR');
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

test('every share card is stamped, and the stamp holds no card that is not one', () => {
  assert.deepEqual(Object.keys(STAMP).sort(), Object.keys(SHARE_CARDS).sort(), RERUN);
});

for (const id of Object.keys(SHARE_CARDS)) {
  test(`the ${id} card is current: its HTML is the one the stamp records, and its PNG the one drawn from it`, () => {
    // A mismatch means the card's data (the hub's hospitals, HACRP's cuts), the tokens it reads, the fonts, its design or
    // RENDER changed since the PNG was drawn.
    assert.ok(STAMP[id].html === sha256(cardHtml(id, INPUTS)), `the ${id} share card is stale: ${RERUN}`);
    assert.ok(STAMP[id].png === sha256(readFileSync(REPO_ROOT + cardFile(id))), `${cardFile(id)} is not the PNG the stamp records: ${RERUN}`);
  });

  test(`the ${id} card is a ${CARD_SIZE.width} by ${CARD_SIZE.height} PNG under 300 KB`, () => {
    const png = readFileSync(REPO_ROOT + cardFile(id));
    assert.deepEqual(pngSize(png), CARD_SIZE);
    assert.ok(png.length < 300 * 1024, `${cardFile(id)}: ${png.length} bytes`);
  });

  test(`the ${id} card's words hold no digit and no byline; it draws a dot for every hospital on the map`, () => {
    const page = cardHtml(id, INPUTS);
    const body = page.slice(page.indexOf('<body>'));
    const words = body.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, ' ');
    assert.doesNotMatch(words, /\d/);
    assert.doesNotMatch(words, /built by/i);
    assert.equal(circles(page).length, placedRows().length);
  });
}

const col = (name) => INPUTS.hub.cols.indexOf(name);
// The hub asset's rows with a place on the map (both x and y), as cardDots keeps them.
const placedRows = () => INPUTS.hub.rows.filter((r) => r[col('x')] !== null && r[col('y')] !== null);
// A card's dots by class, from its HTML ([] for none, so a card with no map fails an assertion, not a TypeError).
const circles = (page) => [...page.matchAll(/<circle class="(\w+)"/g)].map((m) => m[1]);
const count = (list, tone) => list.filter((t) => t === tone).length;

test('the HACRP card is red for every hospital CMS cut (payment reduction "Yes" in the newest emitted HACRP file), each on the map, and gray for the rest', () => {
  const tones = circles(cardHtml('hacrp', INPUTS));
  assert.ok(INPUTS.cut.size > 0);
  assert.equal(count(tones, 'pen'), INPUTS.cut.size);
  assert.equal(count(tones, 'pen') + count(tones, 'none'), tones.length);
  // CMS's flag, not the dollar estimates: a cut hospital the hub has no estimate for is red too.
  const placed = new Set(placedRows().map((r) => r[col('ccn')]));
  for (const ccn of INPUTS.cut) assert.ok(placed.has(ccn), `a cut hospital (${ccn}) has no place on the map`);
});

test('the family card is red for a net cut, green for a net bonus and gray for no net change or no estimate', () => {
  const tones = circles(cardHtml('family', INPUTS));
  const nets = placedRows().map((r) => r[col('net')]);
  assert.equal(count(tones, 'pen'), nets.filter((n) => n !== null && n < 0).length);
  assert.equal(count(tones, 'rew'), nets.filter((n) => n !== null && n > 0).length);
  assert.equal(count(tones, 'none'), nets.filter((n) => n === null || n === 0).length);
});

test('a card holds only the tokens it reads, and how it is drawn: another token\'s edit leaves it current, its own or RENDER\'s does not', () => {
  const page = cardHtml('family', INPUTS);
  const other = new Map(INPUTS.tokens).set('--pen-tint', 'none');
  assert.ok(!page.includes('--pen-tint'));
  assert.equal(cardHtml('family', { ...INPUTS, tokens: other }), page);
  assert.notEqual(cardHtml('family', { ...INPUTS, tokens: new Map(INPUTS.tokens).set('--rew', 'none') }), page);
  assert.ok(page.includes(`<!-- drawn with ${JSON.stringify(RENDER)} -->`));
  assert.deepEqual(RENDER.viewport, CARD_SIZE);
  assert.throws(() => cardHtml('family', { ...INPUTS, tokens: new Map() }), /no token --/);
});

// A synthetic asset, rows [ccn, x, y, net], and the CCNs HACRP cut.
const HUB = { cols: ['ccn', 'x', 'y', 'net'], rows: [['A1', 1, 1, -5], ['A2', 2, 2, 5], ['A3', 3, 3, 0], ['A4', 4, 4, null], ['A5', null, null, -1], ['A6', 5, 5, -2], ['A7', 6, null, -1]] };
const CUT = new Set(['A1', 'A4', 'A5']);

test('cardDots: the family card colors a net cut red and a net bonus green, the rest gray, gray first; no place, no dot', () => {
  assert.deepEqual(cardDots('family', { hub: HUB, cut: CUT }), [[3, 3, null], [4, 4, null], [1, 1, 'pen'], [2, 2, 'rew'], [5, 5, 'pen']]);
});

test('cardDots: the HACRP card colors a hospital CMS cut red, with or without an estimate, and every other hospital gray, never green', () => {
  assert.deepEqual(cardDots('hacrp', { hub: HUB, cut: CUT }), [[2, 2, null], [3, 3, null], [5, 5, null], [1, 1, 'pen'], [4, 4, 'pen']]);
  assert.throws(() => cardDots('hacrp', { hub: { cols: ['x', 'y', 'net'], rows: [] }, cut: CUT }), /"ccn"/);
  assert.throws(() => cardHtml('nope', INPUTS), RangeError);
});
