// The Readmissions pages promise no program, page or date to come (pipeline/test/helpers.js FUTURE_WORDS), as the hub's
// pages don't (hub/test/promises.test.js): this reads what every built page shows and says, shell included: the program
// page, Methods, every place page and every hospital page. The data's own words (a hospital's or a place's name, which may
// hold such a word as a proper name) are taken out first. A failure names the page's address and the word, never a hospital's name.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createContext } from '../../../pipeline/site/context.js';
import { ASSETS, FUTURE_WORDS, readerWords, withTemp } from '../../../pipeline/test/helpers.js';
import { generateHrrp } from '../web/generate.js';
import { loadHrrpOnce } from './fixtures.js';

const DATA = loadHrrpOnce();

// The data's names (hospitals, their other names, cities, counties, metro areas, states) that hold a future word, longest first.
const NAMES = [...new Set([
  ...DATA.hospitals.flatMap((h) => [h.name, h.alias, h.city, h.county, h.cbsaName]),
  ...Object.values(DATA.meta.states),
  ...[...DATA.master.values()].flatMap((r) => [r.name, r.alias, r.city, r.county, r.cbsaName]),
])].filter((n) => typeof n === 'string' && FUTURE_WORDS.test(n)).sort((a, b) => b.length - a.length);

test('every built page promises nothing', () =>
  withTemp('pp-hrrp-', async (dir) => {
    const pages = [];
    const ctx = createContext({ outDir: dir, env: 'production', assets: ASSETS });
    const emit = ctx.emit.bind(ctx);
    ctx.emit = (page) => { pages.push(page.path); return emit(page); };
    generateHrrp(ctx, { data: DATA, released: false, log: () => {} });
    assert.ok(pages.length > DATA.hospitals.length, 'the pages were built');
    assert.ok(readerWords(readFileSync(join(dir, pages[0], 'index.html'), 'utf8')).length > 500, 'the words are read');
    const hits = [];
    for (const path of pages) {
      let words = readerWords(readFileSync(join(dir, path, 'index.html'), 'utf8'));
      for (const name of NAMES) words = words.split(name).join(' ');
      const m = FUTURE_WORDS.exec(words);
      if (m) hits.push(`${path}: "${m[0]}"`);
    }
    assert.deepEqual(hits, [], 'a word that promises a program, page or date');
  }));
