// The page build's shared assets: one stylesheet and one ES module per JS entry, each named by a hash of its
// content so a changed file gets a new URL, plus the fonts (fixed names), their licenses and the favicon.
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { build as esbuild, transform } from 'esbuild';
import { REPO_ROOT } from '../files.js';

const WEB = REPO_ROOT + 'web/';
const STYLES = WEB + 'styles/';
// Cascade order: these first, then any other stylesheet in name order.
const FIRST = ['tokens.css', 'base.css', 'components.css'];

const hash8 = (text) => createHash('sha256').update(text).digest('hex').slice(0, 8);

// The theme toggle reuses the dark media block's declarations verbatim under :root[data-theme="dark"].
export function stylesheet() {
  const files = readdirSync(STYLES).filter((f) => f.endsWith('.css') && !FIRST.includes(f)).sort();
  const [tokens, ...rest] = [...FIRST, ...files].map((f) => readFileSync(STYLES + f, 'utf8'));
  const dark = /:root:not\(\[data-theme="light"\]\)\s*\{([^}]*)\}/.exec(tokens)?.[1];
  if (!dark) throw new Error('web/styles/tokens.css: dark media block not found');
  return [tokens, `:root[data-theme="dark"] {${dark}}`, ...rest].join('\n');
}

function write(dir, name, ext, text) {
  const file = `${name}.${hash8(text)}.${ext}`;
  writeFileSync(join(dir, file), text);
  return `/assets/${file}`;
}

export async function buildAssets({ outDir, entries = {} }) {
  const dir = join(outDir, 'assets');
  mkdirSync(join(dir, 'fonts'), { recursive: true });

  const css = (await transform(stylesheet(), { loader: 'css', minify: true })).code;
  const js = {};
  for (const [name, path] of Object.entries(entries)) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(name) || name === 'site') throw new RangeError(`bad JS entry name "${name}"`);
    const result = await esbuild({
      entryPoints: [isAbsolute(path) ? path : REPO_ROOT + path],
      bundle: true, format: 'esm', minify: true, target: 'es2020', write: false, logLevel: 'silent',
    });
    js[name] = write(dir, name, 'js', result.outputFiles[0].text);
  }

  for (const f of readdirSync(WEB + 'fonts')) copyFileSync(WEB + 'fonts/' + f, join(dir, 'fonts', f));
  copyFileSync(WEB + 'favicon.svg', join(outDir, 'favicon.svg'));
  return { css: write(dir, 'site', 'css', css), js };
}
