# Post-launch fixes: implementation plan

> **For agentic workers:** steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/specs/2026-11-02-post-launch-fixes-design.md`.

**Acceptance:** every item below is done, or written up as a proposal for the owner; `make test` passes; no emitted
file changes; `make build` passes; the launch browser check passes on Chromium, Firefox and WebKit against a local
serve; screenshots of every visual change (desktop and phone, light and dark) for the owner.

**Constraints:** no new dependency or download; no push, pull request, merge or deploy; copy files hold no digits;
statements of CMS's rules carry a claim id; approved looks are kept.

## Milestone 1: words and counts

- [x] Hub hospital page: the fairness line without its ranking clause.
- [x] Hub: read which hospitals the HACRP file scored (its emitted file) into the hub's hospitals; the asset's `scored`
      column; the HAC step's "709 of the 718"; the scale line; the HAC peers' "that CMS didn't score" part.
- [x] Hub: FY beside each payment factor; the Readmissions row's "why a different year" line.
- [x] Hub: a hospital without an estimate says CMS's HAC decision.
- [x] Home: "Methods, in brief" heading and text (owner approves the wording); the directory's live / under
      construction / under consideration heading; the value-based purchasing placeholder and the hospital page's link.
- [x] Family Methods: how the counts differ; dollar figures are for the CCN as CMS listed it.
- [x] HACRP: the "Three programs" figure's note says which hospitals it sums; the states map's keyboard note.
- [x] Manifest: the HCRIS FY2024 landing page.
- [x] Tests for each; screenshots.
- [x] **Checkpoint 1:** `/simplify` on the milestone's diff, then `make test`; `/code-review`. Fix Critical/Important.

## Milestone 2: the net's band and the ramp's past lines

- [x] `engine/js/dollars/ranges.js`: the likely-range arithmetic (from the HACRP site), shared.
- [x] Hub hospital page: the net's likely range in the band's slot; hidden while a what-if is on.
- [x] HACRP what-if: past years' lines (same formula as today's) as faint ticks on the ramp, with a line saying so.
- [x] Tests; screenshots.
- [x] **Checkpoint 2:** `/simplify`, then `make test`; `/code-review`. Fix Critical/Important.

## Milestone 3: browser races (input handling)

- [x] The story's stage: the pointer goes to the current step's panel; a browser check that fails without it; the
      states-map check waits for the map to take the pointer.
- [x] Search box: no late open after the reader has left; a press anywhere in the list keeps the focus; the close
      delay decided from evidence (removed: a press on the list keeps the focus by itself, and a tap picks with no
      delay in Chromium and WebKit); unit tests and a browser check on all three engines.
- [x] **Checkpoint 3:** `/simplify`, then `make test`; `/code-review`; `/security-review` (the search box reads input).

## Milestone 4: favicon and housekeeping

- [x] Favicon: the "&" outlined from the self-hosted Alfa Slab One (no new tool; stop and report if one is needed).
- [x] README, CLAUDE.md, dependencies, NOTICE, LICENSE note, HACRP CHANGELOG.
- [x] **Checkpoint 4:** folded into the final gate, whose `/simplify` and `/code-review` cover this milestone's diff.

## Final gate

- [x] `/simplify` on the full branch diff, then `make test`.
- [x] `/code-review` and `/security-review` on the full branch diff; fix and re-run until clean.
- [x] `make build`; the launch browser check against a local serve on all three engines.
