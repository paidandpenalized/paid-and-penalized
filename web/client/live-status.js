// A polite live region's words: said at once, or, while the reader types, once they pause, so a screen reader is not
// handed a new count per keystroke over its own echo of the typing. Shared by the tables' counts and the what-if.

// A live announcement waits this long after the reader stops typing.
export const SETTLE_MS = 400;

// say(text, typing): writes text into status now, or SETTLE_MS after the last call while typing; any call cancels a
// waiting one.
export function liveStatus(status, wait = SETTLE_MS) {
  let timer = 0;
  return (text, typing = false) => {
    clearTimeout(timer);
    if (typing) timer = setTimeout(() => { status.textContent = text; }, wait);
    else status.textContent = text;
  };
}
