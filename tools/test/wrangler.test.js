// The deploy config: a static-assets Worker for dist/ on workers.dev and preview URLs, with no route or custom domain
// (that is a go-live step), and the Node version Workers Builds uses. Its build command is npm run build, which make
// build runs too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REPO_ROOT } from '../../pipeline/files.js';
import { NOT_FOUND_PATH, fileFor } from '../../pipeline/site/address.js';

const read = (path) => readFileSync(REPO_ROOT + path, 'utf8');
// JSONC to JSON: drop the comments, keeping any "//" inside a string.
const stripComments = (text) => text.replace(/"(?:[^"\\]|\\.)*"|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (m) => (m[0] === '"' ? m : ''));
const configText = stripComments(read('wrangler.jsonc'));
const config = JSON.parse(configText);

test('the config is a Worker named for the site, serving dist/ as static assets with no Worker script', () => {
  assert.equal(config.name, 'paid-and-penalized');
  assert.equal(config.compatibility_date, '2026-09-01');
  assert.deepEqual(config.assets, { directory: './dist', not_found_handling: '404-page', html_handling: 'auto-trailing-slash' });
  assert.ok(!('main' in config), 'a main entry would add a Worker script');
});

test('a path with no file gets the not-found page the build writes: "404-page" serves the root 404.html', () => {
  assert.equal(config.assets.not_found_handling, '404-page');
  assert.equal(fileFor(NOT_FOUND_PATH), '404.html');
});

test('it serves on workers.dev and preview URLs, with no route or custom domain', () => {
  assert.equal(config.workers_dev, true);
  assert.equal(config.preview_urls, true);
  // `wrangler preview` stops without a previews block; an empty one makes previews take the top-level settings.
  assert.deepEqual(config.previews, {});
  // Every key, so a route, a custom domain, a trigger or any other setting cannot arrive unnoticed.
  assert.deepEqual(Object.keys(config).sort(), ['assets', 'compatibility_date', 'name', 'preview_urls', 'previews', 'workers_dev']);
  assert.doesNotMatch(configText, /routes?"|custom_domain|zone_(id|name)/);
});

test('the Node version Workers Builds reads is pinned to the one CI uses', () => {
  assert.equal(read('.node-version'), '24\n');
  const ci = [...read('.github/workflows/ci.yml').matchAll(/node-version: (\S+)/g)].map((m) => m[1]);
  assert.ok(ci.length > 0);
  for (const version of ci) assert.match(version, /^24\./, `CI runs Node ${version}, not the pinned 24`);
});
