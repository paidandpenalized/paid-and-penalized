# Plan: lighter drawings (relative path data)

Spec: `docs/specs/2026-11-02-svg-path-weight-design.md`. Branch `hacrp-table-lazy`, local only (no push, no PR).

## Milestone 1: the path writer and its uses

- [x] Baseline: `make build`, keep a copy of `dist/`, and measure `/hacrp/index.html` (raw, gzip -9, brotli q11) and
      every page type's first visit (`node tools/ci/size-budget.js`).
- [x] `web/charts/pathd.js`: `relativeD`, `absoluteD`, `pathNumber`, with tests (`web/test/pathd.test.js`): exact
      points on every US outline d3-geo writes, joins, relative input, refusals.
- [x] Use it in `geo.js` (outlines, rings), `rollCall.js`, `treemap.js`, `svg.js` (`lineD`, `silhouette`),
      `measureDots.js` (its silhouette, the pull lines); leading zeros in `dots.js`.
- [x] Tests that read a drawing's geometry read it back through `absoluteD`.
- [x] Check: screenshot every chart on the program, a hospital, a state, a metro, a region and the methods page, and on
      the hub's home and hospital pages. Light and dark, 375 and 1280 wide, before against after, in Chromium. Also a
      before-against-before run for the noise floor.
- [x] Checkpoint: `/simplify`, then `npm test`; `/code-review`. Fixed: an absolute point every 64 segments (the
      browser's single-precision sums no longer drift along a long run), paths with more than six decimal places left as
      they are, two tests that read only the first moveto, the number-joining rule shared with `dots.js`.
- [x] `/security-review`, run once for the whole branch at the final gate (the change touches no external input,
      credentials or fetches).

## Milestone 2: the budget

- [x] Re-set `BUDGETS.program` in `tools/ci/size-budget.js` by its formula, and the weight limits in
      `sites/hacrp/test/figures.test.js` (measure + about 5%).
- [x] Checkpoint: folded into milestone 1's (the budget is two numbers and a comment).

## Final gate (full branch diff)

- [x] `/simplify`, then `make test`. Applied: anchors by index, one pass over the tokens, a test that bounds the
      browser's single-precision error.
- [x] `/code-review` and `/security-review`. Fixed: a close is never the anchor, misplaced commas are refused,
      `pathNumbers` allocates no arrays, `absoluteD`'s doc. Security: no findings (every path is built from numbers;
      `html` escapes each interpolation). Left for later: the dots' own relative writer has no anchors (its drift,
      0.0125 units, predates this branch), and writing relative commands directly (a d3-geo path context, a small
      writer for the kit) instead of re-reading absolute text would save build and redraw time.
- [x] `make build`; `npm run e2e` on Chromium, Firefox and WebKit (`E2E_ENGINE`), against the local build: 1,036
      checks each, all pass (Firefox skips its one standing skip).
- [x] Screenshot comparison on all three engines, against each engine's own before-against-before noise: 476 chart
      shots each; past the noise, 53 (Chromium), 52 (Firefox) and 32 (WebKit) shots differ, at most 0.44% of a chart's
      pixels, each an anti-aliasing step on an edge.
- [x] Fix every finding and re-run until clean. Then commit.
