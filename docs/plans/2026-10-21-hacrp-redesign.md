# HACRP redesign plan

**Goal:** Make the HACRP pages creative and very impressive visually, with many analyses and graphs that let readers explore the data in interesting ways. Thirty Day Readmissions (TDR, `../thirty-day-readmissions/web/src`, MIT, same author) is the bar to meet or beat.

**How it runs:** one author agent designs and builds whole pages, screenshotting and art-directing itself as it goes. Subagents may fetch, research or review; they don't split the design. Draft text freely and flag it. Claims and copy review come in the accuracy pass, after the look.

**Inputs:**
- Owner direction (private planning repo): `docs/specs/2026-10-21-hacrp-redesign-spec.md`.
- Explanatory text draft: `docs/drafts/2026-10-21-hacrp-explanations-draft.md`.
- What made TDR work: `docs/notes/2026-10-21-how-tdr-was-built.md`.

Use their facts and direction. Don't copy their notes into this repo.

**Hard limits:**
- No PHI. No real CCN or hospital name in code, tests, comments or commits.
- Nothing public: no push to main, no deploy.
- Installs and downloads are fine when they help: name each one, with source, version or file and size, before running it, and pin it.
- Never use `--no-verify`.
- `make test` stays green, and the numbers stay proved against CMS.

## Milestones
- [x] **M1, hospital page.** Build it complete, then send the owner screenshots and wait for his reaction.
- [x] **Checkpoint M1:** /simplify → `make test` → /code-review → /security-review if inputs changed → verify in Chrome beside TDR.
- [x] **M2, program page and place pages.**
  - Program page: Parts 1–3 (How it works, the FY picture, map and every hospital).
  - Place pages: region, division, state, metro.
  - Search across places.

  Send screenshots after.
- [x] **Checkpoint M2:** same as Checkpoint M1, including /security-review for search.
- [ ] **M3, history and Methods.**
  - Part 4 history, per DATA-A-03. Name the prior-year files and their sizes before downloading them, then pin them.
  - `/hacrp/methods/`.

  Send screenshots after.
- [ ] **Accuracy pass:**
  - claim ids and register rows for every factual sentence;
  - the copy gate;
  - the owner copy list;
  - the claims checked against sources;
  - fixes made inside the design.
- [ ] **Final gate:** /simplify → `make test` → /code-review → /security-review → verify in a fresh clone. Then push the branch privately and ask the owner before any merge.
