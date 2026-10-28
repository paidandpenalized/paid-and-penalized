// The followed hospital's chip, in words: the page build (render/shell.js, through web/copy.js) writes it for a hospital's
// own page, and the shell's script (client/shell.js) writes it for a page that follows a hospital from ?h=. One copy, so
// the two cannot say different things. Plain strings, no digit characters (the year is a {fy} placeholder); it imports
// nothing, so the script carries only these three (and fills them itself: client/shell.js fillWords).
export const CHIP = Object.freeze({
  // The chip's key, the words a screen reader hears before its net, and the stop link's name.
  chipKey: 'Hospital',
  chipNet: 'Estimated FY{fy} net:',
  chipStop: 'Stop following {name}',
});
