// Shorter path data for the same drawing. The kit's largest markup is path data written with absolute commands (d3-geo's
// outlines, the roll call's rows, the treemap's tiles), where each point repeats its full coordinates. relativeD writes
// the same path with relative commands, which are shorter and repeat more (so they compress better), and the browser
// draws the same shape: the differences are taken in whole units of the path's own last decimal place, so every point
// adds back to exactly the coordinates it had. (A browser adds them in single precision, so a point can land a hair off:
// every ANCHOR-th segment is written absolutely to keep that to a few thousandths of a unit, far under a pixel; an edge
// pixel here and there anti-aliases a step differently.) absoluteD reads a path back as absolute commands (the tests
// read the roll call's runs that way). Shared by the build and the browser.

// A number as path data writes it: JavaScript's shortest digits without the leading zero ("0.5" -> ".5", "-0.5" ->
// "-.5").
export const pathNumber = (x) => String(x).replace(/^(-?)0\./, '$1.');

// What goes between two numbers written in a row (the one before, `last`, and `text`): nothing where the grammar lets
// them touch (before a minus, or before a decimal point that follows a number that has one), else a space.
const gap = (last, text) => (text.startsWith('-') || (text.startsWith('.') && last.includes('.')) ? '' : ' ');

// Numbers as path data writes them (pathNumber), joined as tightly as the grammar allows.
export function pathNumbers(...values) {
  let out = '';
  let last = '';
  for (const v of values) {
    const text = pathNumber(v);
    out += (last ? gap(last, text) : '') + text;
    last = text;
  }
  return out;
}

const COMMAND = /^[MLHVZmlhvz]$/;
// The most decimal places a path may have (the kit writes one or two), and the largest coordinate in whole units, so
// every sum stays exact in a double; anything past them is left as it is.
const MAX_PLACES = 6;
const MAX_UNITS = 2 ** 40;
// Every ANCHOR-th segment is written absolutely. A browser adds relative coordinates in single precision; restarting from
// an absolute point keeps that error to a few thousandths of a unit however long the path (a roll call's row of runs, a
// thousand hospitals' pull lines).
const ANCHOR = 64;
// A command letter (any letter, so one that isn't a command is caught) or a number; "1.5.5" is two numbers, as the path
// grammar reads it.
const TOKEN = /[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)/g;
// A comma the grammar refuses: first or last, two in a row, or next to a command letter.
const MISPLACED_COMMA = /^[\s,]*,|,\s*$|,\s*,|[A-Za-z]\s*,|,\s*[A-Za-z]/;

// A path's d (M, L, H, V and Z, absolute or relative, numbers in plain decimals, separated by commas or spaces) as
// { scale, segments }: each segment [command, x, y], the command as written in capitals (M, L, H, V or Z) and the point
// it ends at, absolute, in whole units of 1/scale (scale: 10 to the most decimal places any number has). null for
// anything else: a curve, an arc, an exponent, a path that does not start with a moveto, numbers short of a command's,
// or numbers after a close.
function readPath(d) {
  const tokens = d.match(TOKEN);
  if (!tokens || !/^[Mm]$/.test(tokens[0])) return null;
  // Nothing but tokens, commas and spaces, a comma only between two numbers; every letter a command. One pass over the
  // tokens checks the letters and finds the most decimal places.
  if (d.replace(TOKEN, '').replace(/[\s,]/g, '') !== '' || MISPLACED_COMMA.test(d)) return null;
  let places = 0;
  for (const t of tokens) {
    if (t.length === 1 && /[A-Za-z]/.test(t)) {
      if (!COMMAND.test(t)) return null;
      continue;
    }
    const point = t.indexOf('.');
    if (point >= 0) places = Math.max(places, t.length - point - 1);
  }
  // An unrounded coordinate: its whole units could pass what a double holds exactly, so the path is left as it is.
  if (places > MAX_PLACES) return null;
  const scale = 10 ** places;
  const segments = [];
  let x = 0;
  let y = 0;
  let x0 = 0;
  let y0 = 0;
  let command = null;
  let i = 0;
  const next = () => {
    const t = tokens[i++];
    const units = t === undefined || COMMAND.test(t) ? NaN : Math.round(Number(t) * scale);
    return Math.abs(units) <= MAX_UNITS ? units : NaN;
  };
  while (i < tokens.length) {
    if (COMMAND.test(tokens[i])) command = tokens[i++];
    else if (command === 'Z' || command === 'z') return null;
    // A relative moveto that starts the path is absolute (the SVG rule).
    const [dx, dy] = command === command.toLowerCase() && segments.length ? [x, y] : [0, 0];
    const upper = command.toUpperCase();
    if (upper === 'Z') [x, y] = [x0, y0];
    else if (upper === 'M' || upper === 'L') [x, y] = [next() + dx, next() + dy];
    else if (upper === 'H') x = next() + dx;
    else y = next() + dy;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    segments.push([upper, x, y]);
    // Numbers after a moveto's pair are linetos, relative after a relative moveto.
    if (upper === 'M') {
      [x0, y0] = [x, y];
      command = command === 'm' ? 'l' : 'L';
    }
  }
  return { scale, segments };
}

// The same path in relative commands: an absolute M to start, so two paths' data joined end to end still draw both, then
// l, h, v (a line along one axis takes the shorter h or v; a line of no length, h0), m for each later moveto, and z;
// every ANCHOR-th segment in its absolute form.
// Bare numbers continue the command before them, and numbers join where the grammar lets them (no space before a minus,
// or before a decimal point that follows a number that has one). Anything readPath can't read is returned as it was, as
// are null and ''.
export function relativeD(d) {
  const path = d ? readPath(d) : null;
  if (!path) return d;
  const { scale, segments } = path;
  let out = '';
  // The command a bare number continues, and the last number written.
  let cmd = '';
  let last = '';
  // A moveto, a close, or a command other than the one in force writes its letter; then its numbers. After a moveto, bare
  // numbers are linetos.
  const put = (c, ...values) => {
    if (c !== cmd || c === 'M' || c === 'm' || c === 'z') {
      out += c;
      last = '';
      cmd = c === 'M' ? 'L' : c === 'm' ? 'l' : c;
    }
    for (const v of values) {
      const text = pathNumber(v / scale);
      out += (last ? gap(last, text) : '') + text;
      last = text;
    }
  };
  let x = 0;
  let y = 0;
  // Segments with a point written since the last absolute one (a close has none): the first, and then every ANCHOR-th,
  // is absolute (measured from 0, 0), so the browser's error can't grow.
  let since = ANCHOR;
  segments.forEach(([c, nx, ny]) => {
    if (c === 'Z') {
      put('z');
      [x, y] = [nx, ny];
      return;
    }
    const absolute = since >= ANCHOR;
    since = absolute ? 1 : since + 1;
    const [px, py] = absolute ? [0, 0] : [x, y];
    const as = (letter) => (absolute ? letter : letter.toLowerCase());
    if (c === 'M') put(as('M'), nx - px, ny - py);
    // A line along x as h (a line of no length too, as h0: a dot, with round caps), along y as v.
    else if (ny === y) put(as('H'), nx - px);
    else if (nx === x) put(as('V'), ny - py);
    else put(as('L'), nx - px, ny - py);
    [x, y] = [nx, ny];
  });
  return out;
}

// The same path in absolute commands, each segment its own command as it was written (M, L, H, V or Z), numbers in
// JavaScript's own digits. relativeD's output reads back as the same points, with every line along one axis (a line of
// no length too) as H or V, never L: a test that reads points back reads all four. Anything readPath can't read is
// returned as it was.
export function absoluteD(d) {
  const path = d ? readPath(d) : null;
  if (!path) return d;
  const n = (v) => String(v / path.scale);
  return path.segments.map(([c, x, y]) => (c === 'Z' ? 'Z' : c === 'H' ? `H${n(x)}` : c === 'V' ? `V${n(y)}` : `${c}${n(x)} ${n(y)}`)).join('');
}
