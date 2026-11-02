# Lighter drawings: relative path data (2026-11-02)

## Problem

The HACRP program page (`/hacrp/`) is 1.42 MB of HTML, 281 KB gzipped (level 9) and 202 KB brotli (quality 11). A
mobile first visit is slow enough to cost Lighthouse points. The page's hospital table is not the cause: its rows
already come from the hashed hospitals file (`/assets/hacrp-hospitals.<hash>.json`), fetched as the table nears the
screen, and the page holds an empty `<tbody>`. The weight is the server-drawn figures: about 1.18 MB of inline SVG,
most of it path data. That is state outlines (two US maps per choropleth, the year map, the bubbles map, the locator
and place maps), the roll call's rows, the treemap's tiles, the score rule's silhouettes and the dots.

Every outline point is written absolutely (`L643.8,489.3L641.1,491.9…`), so each point repeats four or five digits
that the one before it already set.

## Decision

Same drawings, less markup. Out of scope: the figures' design, which figures are drawn on the server, and anything
that needs JavaScript to draw (server-drawn charts that work without JavaScript stay).

- `web/charts/pathd.js` `relativeD(d)` rewrites path data made of M, L, H, V and Z (absolute or relative) in relative
  commands. It starts with an absolute M (so paths joined end to end still draw), then uses `l`, `h`/`v` for lines
  along one axis, `m` for later movetos and `z`. Bare numbers continue a command, and the leading zero is dropped
  (`.5`). The differences are taken in whole units of the path's own last decimal place, so every point adds back to
  exactly the coordinate it had. Anything else (curves, arcs, exponents) is returned unchanged.
- Applied where the weight is: d3-geo outlines (`geo.js`: every map), the roll call's rows, the treemap's tiles,
  `lineD`, the silhouettes (`svg.js`, `measureDots.js`) and the pull lines. The dots (`dots.js`) were already relative
  and now drop leading zeros.
- `absoluteD(d)` reads a path back as absolute commands, for tests that read a drawing's geometry.

## What a reader sees

The same pixels, with one caveat. A browser adds relative coordinates in single precision, so a point can land a few
thousandths of a viewBox unit off after a long run. The dots' paths have always worked this way. On the program page
the largest such gap in the new paths is about 0.004 units, against 0.0125 in the dots that were already relative. An
edge pixel here and there anti-aliases one step differently. Screenshot comparison, before against after, light and
dark, phone and desktop widths, three engines: the counts are in the change's notes.

## Budget

The program page's size budget (`tools/ci/size-budget.js`, brotli quality 5, first visit) is re-set by its own
formula: the heaviest page plus 15%, rounded up to the next 10 KB. The figures test's weight limits
(`sites/hacrp/test/figures.test.js`) are re-measured.

## Not done here, for a separate decision

Getting the program page's HTML under 100 KB compressed needs the figures below Part 1 to draw their SVG contents from
hashed files fetched near scroll, which costs the no-JavaScript reader those charts. That trade is the owner's call.
