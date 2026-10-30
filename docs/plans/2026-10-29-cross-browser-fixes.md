# Cross-browser fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `npm run e2e:launch` passes on Chromium, Firefox and WebKit. The hub's first run outside Chromium (2026-10-29,
against the workers.dev site at `main` 3f08865) failed 23 checks on Firefox and 37 on WebKit; locally, 17 and 41.

**Approach:** fix what a reader would see; make the checks measure the same thing in every engine where the difference
is the engine's, not the page's. Every change below was traced to its cause first.

## What a reader sees (site fixes)

1. (Checked and dropped: opening the phone's search mid-page looked like it scrolled the page; Playwright's `click()`
   did that, scrolling the sticky button "into view". A real click leaves the content in place.)
2. **Safari cuts the top off the record card's state outline.** WebKit lays the map's SVG out narrower (390 px, not
   434) when the outline is first placed and widens it after; the card's size doesn't change, so the card's
   ResizeObserver never fires and the outline stays placed for the narrower drawing (Alabama runs under the title bar).
   `sites/hacrp/client/record.js`: observe the map's SVG as well as the card.
3. **Safari: Reset after a click leaves focus nowhere.** Safari doesn't focus a clicked button, so the what-if's reset
   never sees its button as focused and doesn't hand focus to the pressed peer toggle. `hub/client/hospital/whatif.js`
   `resetAll`: hand off from the control that was used.
4. **The states map's buttons have no name in WebKit's accessibility check.** Each takes its name from its SVG
   `<title>`, which WebKit computes as not displayed. The server gives each title an id (`hub/home/states.js`);
   `hub/client/story/map.js` names each state button by it (`aria-labelledby`), and undoes it with the rest of the wiring.
4b. **Safari: tabbing to the last step's search on a phone leaves it under the pinned chart.** The steps' controls
   carry a scroll margin the chart's height (`hub/styles.css`); Chrome's focus scroll honors it, Safari's doesn't.
   `web/client/topbar.js`, which already brings a keyboard focus left under the bar down to its edge, also brings one
   whose scroll margin isn't in view up until it is (never past the bar's edge). The browser check is "Find yours by keyboard".
4c. **Safari: HACRP's table retry button.** The same click-without-focus as 3: after a click, the loaded table didn't
   take the focus. `sites/hacrp/client/table.js`: a click focuses the button, as other engines' clicks do. New browser
   check ("the table's Try again"), which fails on WebKit without it.
5. (Checked and dropped: Firefox looked to clip the bar search's placeholder at 641 px; it shows it whole. Its
   `clientWidth` leaves out room it keeps for the clear button: a harness fix below.)

## What the checks get wrong (harness fixes, `tools/e2e/`)

6. **SVG boxes differ by engine.** (Every tab gets `window.svgBox`: `lib.js` `newPage`.) Firefox's `getBBox` and `getBoundingClientRect` of a `<text>` add about 2 px each
   side, and of a shape include its stroke; WebKit gives a `<tspan>` its whole `<text>`'s box. The checks measure text
   by its characters' extents (`getExtentOfChar`, which all three engines agree on) and shapes by `getBBox` through the
   screen CTM (`lib.js` `installSvgBox`): the peer chart (`charts.test.js`), the what-if's "actual" label and "drag me"
   hint (`hospital.test.js`), the map key's swatches (`story.test.js`).
7. **WebKit reports a page sent with Cross-Origin-Opener-Policy and opened at a `#fragment` as two navigation requests,
   and finishes one.** `lib.js` `watch`: a finished navigation request ends any other navigation in flight to the same
   address. New control in `watch.test.js`.
8. **Playwright's `click()` scrolls a sticky target "into view"**, moving the page (in WebKit after the check has
   already scrolled where it wants): the masthead trip check opens the phone's search with `lib.js` `clickInPlace` (a
   pointer's real click where the button is).
9. **WebKit tabs through links only with Option held** (macOS default). One `TAB_KEYS` in `lib.js`, used by every
   walk (`interact.test.js`'s own copy moves there; `shell.test.js`, `story.test.js`).
10. **Firefox:**
   - a page the browser holds may come back 304: the chip check accepts 200 or 304, as `pages.test.js` does;
   - a fresh tab takes the colour scheme only once primed: the new-tab check opens it with `newPage`;
   - it doesn't emulate a device scale below 1: the 50% zoom check is skipped there, with the reason;
   - without scroll-driven animations the masthead's fallback is the stylesheet's documented one (scripts held back:
     the header's wordmark stays hidden; scripts off: both show): the wordmark checks expect that where
     `CSS.supports('animation-timeline: scroll()')` is false;
   - it fills the peer table on `<details>`' toggle a task later: the check waits for the rows;
   - it asks for zstd, which Cloudflare sends and Playwright's `route.fetch` can't decode: the story's response rewrites
     fetch with `accept-encoding: gzip, br`;
   - the bar search's placeholder room is the box's width less its padding and border, not `clientWidth`.

11. **Load.** `node --test` ran every browser-check file at once (one per core, each with up to four tabs); under that
    load a few Firefox checks timed out at random (the peer table, the last step's search). `npm run e2e` is now
    `tools/e2e/run.js`: at most four files at once, one fewer than the cores (CI's 2-core runner: one, as before). Two
    full Firefox runs at four were clean, about 12 s slower.

## Tasks

- [ ] Task 1: site fixes 2–4, each with a check that fails before and passes after (unit test where the module has one:
  `sites/hacrp/test/record-client.test.js`; a browser check otherwise).
- [ ] Task 2: harness fixes 6–10.
- [ ] Task 3: `make test`; `npm run e2e` on Chromium, Firefox and WebKit over a local build; fix until all three pass.
- [ ] **Checkpoint (milestone):** `/simplify` on the branch diff, then tests again; `/code-review` on the result; fix
  Critical/Important findings. (`/security-review` not needed: no credentials, external input or data handling change.)
- [ ] **Final gate:** `/code-review` clean on the full diff; `/verify`: `E2E_BASE_URL=<branch preview> npm run e2e:launch`
  READY on all three engines (pushing the branch makes the preview: owner's OK first).
- [ ] Owner's OK, then merge.
