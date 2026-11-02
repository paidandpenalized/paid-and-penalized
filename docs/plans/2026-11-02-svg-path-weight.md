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
- [ ] Checkpoint: `/simplify`, then `npm test`; `/code-review`; `/security-review` (the change touches no external
      input, credentials or fetches; run for the record). Fix Critical/Important findings.

## Milestone 2: the budget

- [x] Re-set `BUDGETS.program` in `tools/ci/size-budget.js` by its formula, and the weight limits in
      `sites/hacrp/test/figures.test.js` (measure + about 5%).
- [ ] Checkpoint: `/simplify`, then `npm test`; `/code-review`.

## Final gate (full branch diff)

- [ ] `/simplify`, then `make test`.
- [ ] `/code-review` and `/security-review`.
- [ ] `make build`; `npm run e2e` on Chromium, Firefox and WebKit (`E2E_ENGINE`), against the local build.
- [ ] Screenshot comparison on Firefox and WebKit too.
- [ ] Fix every finding and re-run until clean. Then commit.
