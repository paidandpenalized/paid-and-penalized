# Post-launch fixes: implementation plan

> **For agentic workers:** steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/specs/2026-11-02-post-launch-fixes-design.md`.

**Acceptance:** every item below is done, or written up as a proposal for the owner; `make test` passes; no emitted
file changes; `make build` passes; the launch browser check passes on Chromium, Firefox and WebKit against a local
serve; screenshots of every visual change (desktop and phone, light and dark) for the owner.

**Constraints:** no new dependency or download; no push, pull request, merge or deploy; copy files hold no digits;
statements of CMS's rules carry a claim id; approved looks are kept.

## Milestone 1: words and counts

- [ ] Hub hospital page: the fairness line without its ranking clause.
- [ ] Hub: read which hospitals the HACRP file scored (its emitted file) into the hub's hospitals; the asset's `scored`
      column; the HAC step's "709 of the 718"; the scale line; the HAC peers' "that CMS didn't score" part.
- [ ] Hub: FY beside each payment factor; the Readmissions row's "why a different year" line.
- [ ] Hub: a hospital without an estimate says CMS's HAC decision.
- [ ] Home: "Methods, in brief" heading and text (owner approves the wording); the directory's live / under
      construction / under consideration heading; the value-based purchasing placeholder and the hospital page's link.
- [ ] Family Methods: how the counts differ; dollar figures are for the CCN as CMS listed it.
- [ ] HACRP: the "Three programs" figure's note says which hospitals it sums; the states map's keyboard note.
- [ ] Manifest: the HCRIS FY2024 landing page.
- [ ] Tests for each; screenshots.
- [ ] **Checkpoint 1:** `/simplify` on the milestone's diff, then `make test`; `/code-review`. Fix Critical/Important.

## Milestone 2: the net's band and the ramp's past lines

- [ ] `engine/js/dollars/ranges.js`: the likely-range arithmetic (from the HACRP site), shared.
- [ ] Hub hospital page: the net's likely range in the band's slot; hidden while a what-if is on.
- [ ] HACRP what-if: past years' lines (same formula as today's) as faint ticks on the ramp, with a line saying so.
- [ ] Tests; screenshots.
- [ ] **Checkpoint 2:** `/simplify`, then `make test`; `/code-review`. Fix Critical/Important.

## Milestone 3: browser races (input handling)

- [ ] The story's stage: the pointer goes to the current step's panel; a browser check that fails without it; the
      states-map check waits for the map to take the pointer.
- [ ] Search box: no late open after the reader has left; a press anywhere in the list keeps the focus; the close
      delay decided from evidence; unit tests and a browser check on all three engines.
- [ ] **Checkpoint 3:** `/simplify`, then `make test`; `/code-review`; `/security-review` (the search box reads input).

## Milestone 4: favicon and housekeeping

- [ ] Favicon: the "&" outlined from the self-hosted Alfa Slab One (no new tool; stop and report if one is needed).
- [ ] README, CLAUDE.md, dependencies, NOTICE, LICENSE note, HACRP CHANGELOG.
- [ ] **Checkpoint 4:** `/simplify`, then `make test`; `/code-review`.

## Final gate

- [ ] `/simplify` on the full branch diff, then `make test`.
- [ ] `/code-review` and `/security-review` on the full branch diff; fix and re-run until clean.
- [ ] `make build`; the launch browser check against a local serve on all three engines.
