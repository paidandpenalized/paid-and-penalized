// The page build's shared assets: one stylesheet and one ES module per JS entry, each named by a hash of its
// content so a changed file gets a new URL, plus the fonts (fixed names), their licenses and the favicon.
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { build as esbuild, transform } from 'esbuild';
import { REPO_ROOT, writeFileMkdir } from '../files.js';

const WEB = REPO_ROOT + 'web/';
const STYLES = WEB + 'styles/';
// Cascade order: these first, then any other shared stylesheet in name order, then each site's own.
const FIRST = ['tokens.css', 'base.css', 'components.css'];

export const hash8 = (text) => createHash('sha256').update(text).digest('hex').slice(0, 8);

const repoPath = (path) => (isAbsolute(path) ? path : REPO_ROOT + path);

// A CSS block's declarations, [name, value], in order, its comments left out.
const declarations = (block) => [...block.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([\w-]+)\s*:\s*([^;]+?)\s*;/g)].map(([, name, value]) => [name, value]);
// A color value: hex, rgb() or rgba(), the forms tokens.css writes.
const COLOR = /^(?:#[0-9a-f]{3,8}|rgba?\([^)]*\))$/i;
// The print block: every color custom property the light block sets, then the print block's own declarations (what
// print alone sets), each !important. A print value for a light color takes that color's place.
export function printBlock(light, print) {
  const own = new Map(declarations(print));
  const colors = declarations(light).filter(([name, value]) => name.startsWith('--') && COLOR.test(value));
  const all = new Map([...colors.map(([name, value]) => [name, own.get(name) ?? value]), ...own]);
  return `@media print {\n  :root {\n${[...all].map(([name, value]) => `    ${name}: ${value} !important;\n`).join('')}  }\n}`;
}

const PRINT = /@media print \{\s*:root \{([^}]*)\}\s*\}/;

// tokens.css as the bundle carries it: its print block written out (printBlock). The theme toggle reuses the dark
// media block's declarations verbatim under :root[data-theme="dark"], after it. siteStyles: each site's stylesheet
// (repo-relative), bundled after the shared ones.
export function stylesheet(siteStyles = []) {
  const files = readdirSync(STYLES).filter((f) => f.endsWith('.css') && !FIRST.includes(f)).sort();
  const [tokens, ...rest] = [...[...FIRST, ...files].map((f) => STYLES + f), ...siteStyles.map(repoPath)]
    .map((f) => readFileSync(f, 'utf8'));
  const light = /^:root \{([^}]*)\}/m.exec(tokens)?.[1];
  const dark = /:root:not\(\[data-theme="light"\]\)\s*\{([^}]*)\}/.exec(tokens)?.[1];
  const print = PRINT.exec(tokens);
  if (!light || !dark || !print) throw new Error('web/styles/tokens.css: the light block, the dark media block or the print block not found');
  return [tokens.replace(PRINT, () => printBlock(light, print[1])), `:root[data-theme="dark"] {${dark}}`, ...rest].join('\n');
}

// Writes <dir>/<name>.<hash>.<ext> and returns its public path under /assets/.
export function writeHashed(dir, name, ext, text) {
  const file = `${name}.${hash8(text)}.${ext}`;
  writeFileMkdir(join(dir, file), text);
  return `/assets/${file}`;
}

export async function buildAssets({ outDir, entries = {}, styles = [] }) {
  const dir = join(outDir, 'assets');
  mkdirSync(join(dir, 'fonts'), { recursive: true });

  const css = (await transform(stylesheet(styles), { loader: 'css', minify: true })).code;
  const js = {};
  for (const [name, path] of Object.entries(entries)) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(name) || name === 'site') throw new RangeError(`bad JS entry name "${name}"`);
    const result = await esbuild({
      entryPoints: [repoPath(path)],
      bundle: true, format: 'esm', minify: true, target: 'es2020', write: false, logLevel: 'silent',
    });
    js[name] = writeHashed(dir, name, 'js', result.outputFiles[0].text);
  }

  for (const f of readdirSync(WEB + 'fonts')) copyFileSync(WEB + 'fonts/' + f, join(dir, 'fonts', f));
  copyFileSync(WEB + 'favicon.svg', join(outDir, 'favicon.svg'));
  return { css: writeHashed(dir, 'site', 'css', css), js };
}
