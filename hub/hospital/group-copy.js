// A peer group's name in words, as the pages put it after a count ("117 Ohio hospitals", "1,034 hospitals with 100 to
// 299 beds"): the hospital page's copy (hub/hospital/copy.js) and the front page's last step (hub/client/story/copy.js)
// both spread these in, so a group reads the same on both; hub/hospital/peers.js groupName fills them. One wording for the
// smallest size group, "fewer than". Plain strings, no digit characters: {state}, a state's name; {beds}, {lo}, {hi}, a
// size band's bed-count edges (engine/js/peers.js).
export const GROUPS = Object.freeze({
  groupState: '{state} hospitals',
  groupSizeLow: 'hospitals with fewer than {beds} beds',
  groupSizeMid: 'hospitals with {lo} to {hi} beds',
  groupSizeHigh: 'hospitals with {beds} beds or more',
  groupTeachMajor: 'major teaching hospitals',
  groupTeachMinor: 'minor teaching hospitals',
  groupTeachNone: 'non-teaching hospitals',
});
