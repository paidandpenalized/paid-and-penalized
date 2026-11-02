// The page build's shared assets: the shared stylesheet, a stylesheet of its own for each site, and one script per JS
// entry (an ES module, or a classic script for the head's theme), each named by a hash of its content so a changed file
// gets a new URL, plus the share cards (content-hashed too), the fonts (fixed names), their licenses and the favicon.
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { build as esbuild, transform } from 'esbuild';
import { REPO_ROOT, writeFileMkdir } from '../files.js';
import { SHARE_CARDS, cardFile } from '../../web/share-card.js';

const WEB = REPO_ROOT + 'web/';
const STYLES = WEB + 'styles/';
// Cascade order: these first, then any other shared stylesheet in name order; a page's sheets of their own (buildAssets'
// siteStyles: its site's) link after the whole bundle (layout.js page()).
const FIRST = ['tokens.css', 'base.css', 'components.css'];
// The program sites' chart and what-if kit (what web/charts/ and web/whatif/ draw): in web/styles/, but out of the shared
// bundle, since only a program site's pages draw them. A program site's own sheet carries them, first (its manifest's
// styles: sites/hacrp/web/generate.js).
export const KIT_STYLES = Object.freeze(['web/styles/charts.css', 'web/styles/whatif.css']);

export const sha256 = (data) => createHash('sha256').update(data).digest('hex');
export const hash8 = (text) => sha256(text).slice(0, 8);
// tokens.css's light block, `:root { ... }` at the start of a line; [1] holds its declarations.
export const LIGHT_BLOCK = /^:root \{([^}]*)\}/m;

const repoPath = (path) => (isAbsolute(path) ? path : REPO_ROOT + path);

// A CSS block's declarations, [name, value], in order, its comments left out.
export const declarations = (block) => [...block.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([\w-]+)\s*:\s*([^;]+?)\s*;/g)].map(([, name, value]) => [name, value]);
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
// the other shared stylesheets (not the kit, KIT_STYLES).
export function stylesheet() {
  const files = readdirSync(STYLES).filter((f) => f.endsWith('.css') && !FIRST.includes(f) && !KIT_STYLES.includes(`web/styles/${f}`)).sort();
  const [tokens, ...rest] = [...FIRST, ...files].map((f) => readFileSync(STYLES + f, 'utf8'));
  const light = LIGHT_BLOCK.exec(tokens)?.[1];
  const dark = /:root:not\(\[data-theme="light"\]\)\s*\{([^}]*)\}/.exec(tokens)?.[1];
  const print = PRINT.exec(tokens);
  if (!light || !dark || !print) throw new Error('web/styles/tokens.css: the light block, the dark media block or the print block not found');
  return [tokens.replace(PRINT, () => printBlock(light, print[1])), `:root[data-theme="dark"] {${dark}}`, ...rest].join('\n');
}

// Writes <dir>/<name>.<hash>.<ext> (text: a string, or a Buffer for a binary file) and returns its public path under
// /assets/.
export function writeHashed(dir, name, ext, text) {
  const file = `${name}.${hash8(text)}.${ext}`;
  writeFileMkdir(join(dir, file), text);
  return `/assets/${file}`;
}

const minifyCss = async (text) => (await transform(text, { loader: 'css', minify: true })).code;
// An entry's or a sheet's name, which becomes its file's: a plain lowercase name, never the shared bundle's ("site").
const assetName = (name) => /^[a-z0-9][a-z0-9-]*$/.test(name) && name !== 'site';

// The licenses of the packages a bundle carries code from (esbuild's metafile: node_modules inputs with bytes in the
// output), as one leading /*! */ comment, each package's name, version and LICENSE file verbatim, in name order; '' for
// a bundle of this repository's code only. The d3 packages' ISC license asks for its notice in every copy, and a
// bundle is one (NOTICE says which bundles carry them).
export function licenseNotice(metafile) {
  const packages = new Map(); // folder, as esbuild names it -> package name
  for (const output of Object.values(metafile.outputs)) {
    for (const [input, { bytesInOutput }] of Object.entries(output.inputs)) {
      // The last node_modules in the path: a nested copy is its own package.
      const m = /^(.*node_modules\/((?:@[^/]+\/)?[^/]+))\//.exec(input);
      if (m && bytesInOutput > 0) packages.set(m[1], m[2]);
    }
  }
  if (!packages.size) return '';
  const parts = [...packages].sort((a, b) => (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0)).map(([folder, pkg]) => {
    const dirOf = `${repoPath(folder)}/`;
    const { version, license } = JSON.parse(readFileSync(dirOf + 'package.json', 'utf8'));
    const file = readdirSync(dirOf).find((f) => /^licen[sc]e(\.(md|txt))?$/i.test(f));
    if (!file) throw new RangeError(`assets: ${pkg} has no LICENSE file to carry`);
    return `${pkg} ${version} (${license}):\n\n${readFileSync(dirOf + file, 'utf8').trim()}`;
  });
  return `/*! This file includes code from these packages, each under its license.\n\n${parts.join('\n\n').replaceAll('*/', '* /')}\n*/\n`;
}

// The shared stylesheet (stylesheet()) is /assets/site.<hash>.css. siteStyles: the sheets of their own, { name:
// [stylesheet paths] }, each its files in order as /assets/<name>.<hash>.css (returned as sheets[name]), for a page to
// link after the shared one (layout.js page()'s `sheets`). A sheet of its own gets no dark copy or print block: those are
// the tokens', in the shared bundle, and its rules read the tokens' custom properties.
// entries: the JS entries, { name: path }, each /assets/<name>.<hash>.js (returned as js[name]): an ES module, or, for
// a name in classic, a classic script, bundled as one self-contained function call (no import, export or global name).
// The share cards (web/share-card.js), each committed PNG web/og/<id>.png, are /assets/og-<id>.<hash>.png (cards[id]).
export async function buildAssets({ outDir, entries = {}, classic = [], siteStyles = {} }) {
  for (const name of classic) if (!Object.hasOwn(entries, name)) throw new RangeError(`no classic entry "${name}" in entries`);
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
      bundle: true, format: classic.includes(name) ? 'iife' : 'esm', minify: true, target: 'es2020', write: false, logLevel: 'silent', metafile: true,
    });
    js[name] = writeHashed(dir, name, 'js', licenseNotice(result.metafile) + result.outputFiles[0].text);
  }

  const cards = Object.fromEntries(Object.keys(SHARE_CARDS).map((id) => [id, writeHashed(dir, `og-${id}`, 'png', readFileSync(REPO_ROOT + cardFile(id)))]));

  for (const f of readdirSync(WEB + 'fonts')) copyFileSync(WEB + 'fonts/' + f, join(dir, 'fonts', f));
  copyFileSync(WEB + 'favicon.svg', join(outDir, 'favicon.svg'));
  return { css: writeHashed(dir, 'site', 'css', css), js, sheets, cards };
}
