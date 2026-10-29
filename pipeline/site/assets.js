// The page build's shared assets: the shared stylesheet, a stylesheet of its own for each site, and one ES module per JS
// entry, each named by a hash of its content so a changed file gets a new URL, plus the fonts (fixed names), their
// licenses and the favicon.
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { build as esbuild, transform } from 'esbuild';
import { REPO_ROOT, writeFileMkdir } from '../files.js';

const WEB = REPO_ROOT + 'web/';
const STYLES = WEB + 'styles/';
// Cascade order: these first, then any other shared stylesheet in name order; a page's sheets of their own (buildAssets'
// siteStyles: its site's) link after the whole bundle (layout.js page()).
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

// The shared stylesheet, every page's: tokens.css as the bundle carries it (its print block written out, printBlock;
// the theme toggle reuses the dark media block's declarations verbatim under :root[data-theme="dark"], after it), then
// the other shared stylesheets.
export function stylesheet() {
  const files = readdirSync(STYLES).filter((f) => f.endsWith('.css') && !FIRST.includes(f)).sort();
  const [tokens, ...rest] = [...FIRST, ...files].map((f) => readFileSync(STYLES + f, 'utf8'));
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

const minifyCss = async (text) => (await transform(text, { loader: 'css', minify: true })).code;
// An entry's or a sheet's name, which becomes its file's: a plain lowercase name, never the shared bundle's ("site").
const assetName = (name) => /^[a-z0-9][a-z0-9-]*$/.test(name) && name !== 'site';

// The shared stylesheet (stylesheet()) is /assets/site.<hash>.css. siteStyles: the sheets of their own, { name:
// [stylesheet paths] }, each its files in order as /assets/<name>.<hash>.css (returned as sheets[name]), for a page to
// link after the shared one (layout.js page()'s `sheets`). A sheet of its own gets no dark copy or print block: those are
// the tokens', in the shared bundle, and its rules read the tokens' custom properties.
// entries: the JS entries, { name: path }, each /assets/<name>.<hash>.js (returned as js[name]).
export async function buildAssets({ outDir, entries = {}, siteStyles = {} }) {
  const dir = join(outDir, 'assets');
  mkdirSync(join(dir, 'fonts'), { recursive: true });

  const css = await minifyCss(stylesheet());
  const sheets = {};
  for (const [name, files] of Object.entries(siteStyles)) {
    if (!assetName(name)) throw new RangeError(`bad stylesheet name "${name}"`);
    sheets[name] = writeHashed(dir, name, 'css', await minifyCss(files.map((f) => readFileSync(repoPath(f), 'utf8')).join('\n')));
  }
  const js = {};
  for (const [name, path] of Object.entries(entries)) {
    if (!assetName(name)) throw new RangeError(`bad JS entry name "${name}"`);
    const result = await esbuild({
      entryPoints: [repoPath(path)],
      bundle: true, format: 'esm', minify: true, target: 'es2020', write: false, logLevel: 'silent',
    });
    js[name] = writeHashed(dir, name, 'js', result.outputFiles[0].text);
  }

  for (const f of readdirSync(WEB + 'fonts')) copyFileSync(WEB + 'fonts/' + f, join(dir, 'fonts', f));
  copyFileSync(WEB + 'favicon.svg', join(outDir, 'favicon.svg'));
  return { css: writeHashed(dir, 'site', 'css', css), js, sheets };
}
