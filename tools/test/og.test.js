// The share cards (web/share-card.js, tools/og/): each committed card is the one its HTML draws today, 1200 by 630, small
// enough to fetch, and the HTML holds no numbers in its words.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REPO_ROOT, readJson } from '../../pipeline/files.js';
import { CARD_SIZE, CARD_STAMP, SHARE_CARDS, cardFile } from '../../web/share-card.js';
import { sha256 } from '../../pipeline/site/assets.js';
import { cardDots, cardHtml, cardInputs } from '../og/card.js';

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
    // A mismatch means the card's data (the hub's hospitals), the tokens, the fonts or its design changed since the PNG was drawn.
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
    const placed = INPUTS.hub.rows.filter((r) => r[INPUTS.hub.cols.indexOf('x')] !== null).length;
    assert.equal(body.match(/<circle /g).length, placed);
  });
}

// A synthetic asset: three columns, rows [x, y, net, hac].
const HUB = { cols: ['x', 'y', 'net', 'hac'], rows: [[1, 1, -5, -5], [2, 2, 5, 0], [3, 3, 0, 0], [4, 4, null, null], [null, null, -1, -1], [5, 5, -2, 0]] };

test('cardDots: the family card colors a net cut red and a net bonus green, the rest gray, gray first; no place, no dot', () => {
  assert.deepEqual(cardDots('family', HUB), [[3, 3, null], [4, 4, null], [1, 1, 'pen'], [2, 2, 'rew'], [5, 5, 'pen']]);
});

test('cardDots: the HACRP card colors a HACRP cut red and every other hospital gray, never green', () => {
  assert.deepEqual(cardDots('hacrp', HUB), [[2, 2, null], [3, 3, null], [4, 4, null], [5, 5, null], [1, 1, 'pen']]);
  assert.throws(() => cardDots('hacrp', { cols: ['x', 'y', 'net'], rows: [] }), /"hac"/);
  assert.throws(() => cardHtml('nope', INPUTS), RangeError);
});
