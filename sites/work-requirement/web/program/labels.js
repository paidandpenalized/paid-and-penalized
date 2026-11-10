// Label placement shared by the figures that fit their own text (states.js, both.js): a type table's lookup, a label's box
// and the box overlap test. Pure: no DOM, file or clock.
import { textWidth } from '../../../../web/charts/text.js';

// The lookups for a type table (fonts: class -> { size: px, or by drawing; mono }): fontOf(cls, drawing) is { size, mono };
// labelAt(cls, text, x, y, anchor, drawing) is a label: its class, text, anchor point and box ([x, top, w, h]; a text's
// box spans its size above the baseline less a fifth, and a fifth below).
export function labelKit(fonts) {
  const fontOf = (cls, drawing) => {
    const f = fonts[cls];
    return { size: typeof f.size === 'number' ? f.size : f.size[drawing], mono: f.mono };
  };
  const labelAt = (cls, text, x, y, anchor, drawing) => {
    const { size, mono } = fontOf(cls, drawing);
    const w = textWidth(text, size, { mono });
    const x0 = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x;
    return { cls, text, x, y, anchor, box: [x0, y - size * 0.8, w, size] };
  };
  return { fontOf, labelAt };
}

export const overlap = (a, b) => a[0] < b[0] + b[2] && a[0] + a[2] > b[0] && a[1] < b[1] + b[3] && a[1] + a[3] > b[1];
