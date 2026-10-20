# Engine v0 (HACRP formulas) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the monorepo skeleton and a pure-JS HACRP formula engine whose no-change output equals CMS's published FY2026 values exactly, for every hospital in the file.

**Architecture:** Plain ES modules in `engine/js/`, no runtime or dev dependencies, tested with Node's built-in `node:test`. Each formula is a pure function (data in, result out), shared later by the page build and the browser. Inputs come from one pinned CMS file whose SHA-256 is checked by a test.

**Tech Stack:** Node ≥ 22 (local: 26.0.0), ES modules, `node:test` + `node:assert/strict`, `node:crypto`. Zero npm packages.

**Spec:** the what-if standard (§ 2 math rules, § 6 edge cases, § 7 tests) and acceptance test A1 (HACRP). Both live in the private planning repo. The rules this plan needs are restated under Global Constraints, so this plan stands on its own.

## Global Constraints

- Zero npm dependencies (runtime and dev). Anything installed is flagged to Dalton first.
- Engine modules are pure: no `fs`, no network, no DOM, no `Date.now()`. File reading lives only in tests and, later, the build.
- `engine/js/hacrp/` may name its program. `engine/js/*.js` at the top level (csv, stats) may not. Sites never import each other.
- CCN is always a string (leading zeros kept).
- **Anchor on CMS:** with no changes, every output (score, flag, measure z) is CMS's published value, compared with `===`. This holds for every row in the file.
- **Change-only math:** a changed submitted measure moves the score by `(zFromValue(new) − zFromValue(old)) / n`, where n = the number of measures with a published z. A changed assigned measure (z published, value `N/A`) moves it by `(zFromValue(new) − publishedZ) / n`. Unchanged measures keep CMS's z.
- **Cutoff:** the boundary in CMS's decisions, derived from the data: `highestNo` = max score among "No", `lowestYes` = min score among "Yes". CMS flags a score *greater than* the cutoff. A hypothetical score is "No" if `≤ highestNo − band`, "Yes" if `≥ lowestYes + band`, otherwise "too-close". band = Σ(fit error of each changed measure) / n; band is 0 and the flag is CMS's when nothing changed.
- Maryland rows (Payment Reduction `N/A` with a score) keep flag `N/A` under any change.
- Rows with no Total HAC Score (`N/A`) get no what-if; CMS's values pass through verbatim.
- Measure parameters (mean, SD, floor, cap) are fit from CMS's published value–z pairs, never typed in. Fit tolerance: ≤ 0.0001 for each SIR, ≤ 0.0004 for PSI-90.
- Estimate tag (A1(c)): a measure is tagged when the public-method recompute (SAS PCTLDEF=5 percentiles at 5/95, sample SD, over hospitals with a published value) misses any published z by more than 0.001.
- Test fixtures name no hospital. Pick rows by property ("a Yes row with no score"), never by CCN or name.
- No numbers hand-typed into engine code except method constants (0.05, 0.95, 0.001 tag threshold) and the fit tolerances above.
- Commits use the repo-local noreply identity `275741810+daltonhaslam@users.noreply.github.com`.

## Review Focus

1. **A reader sets a measure back to its own value by hand.** It must read as no change: score `===` CMS and flag = CMS's. → Task 5 test `setting a value to its published value is no change`.
2. **A value above the cap, or below the floor.** The score must not move between two values that are both above the cap. → Task 4 `zFromValue clamps`; Task 5 `no movement above the cap`.
3. **A solver answer, rounded for display, lands back in "too-close".** Rounding must go in the safe direction. → Task 6 round-trip test applies the *rounded* value.
4. **A change to a measure with no published z.** Throw a `RangeError`; never silently score it. → Task 5 test.
5. **A one-measure hospital (n = 1).** It swings hardest. Band and leverage divide by 1, not by 6. → Task 5 test on a property-picked one-measure row.

---

## File map

| Path | Responsibility |
|---|---|
| `CLAUDE.md` | Rules for Claude Code sessions in this repo (OPS-11) |
| `README.md` | What the repo is, how to run tests |
| `LICENSE` · `LICENSE-CONTENT` · `NOTICE` · `CITATION.cff` | MIT code; CC BY 4.0 content and derived data; exclusions; citation |
| `CONTRIBUTING.md` · `SECURITY.md` | No outside PRs yet; how to report a security issue |
| `package.json` · `Makefile` · `.gitignore` | `npm test` / `make test`; no dependencies |
| `data/pinned/manifest.json` | One entry per pinned file: id, path, bytes, sha256, URLs, PDC dates, retrieved |
| `data/pinned/hacrp-fy2026/FY_2026_HAC_Reduction_Program_Hospital.csv` | CMS PDC `yq43-i98g`, byte-identical to the 10-13 pin |
| `engine/js/csv.js` | RFC 4180 parse → array of header-keyed objects |
| `engine/js/stats.js` | mean, sampleSd, percentileInc, percentileSas5, linearFit |
| `engine/js/hacrp/measures.js` | The six measures and their CSV columns |
| `engine/js/hacrp/hospital.js` | CSV row → `Hospital` record |
| `engine/js/hacrp/score.js` | Total score, cutoff boundary, flag classification |
| `engine/js/hacrp/params.js` | Fit CMS's per-measure parameters; value → z; public-method z + tag |
| `engine/js/hacrp/model.js` | `buildModel(hospitals)`: params for all measures + boundary |
| `engine/js/hacrp/whatif.js` | `whatIf(hospital, model, changes)` |
| `engine/js/hacrp/solver.js` | `solveMeasure(hospital, model, id)` |
| `engine/js/test/**/*.test.js` | Tests; `engine/js/test/fixtures.js` loads the pinned file |

---

### Task 1: Repo skeleton (local only, no network)

**Files:** Create every root file in the file map except `data/`; `engine/js/test/smoke.test.js`.

- [ ] **Step 1:** Write `CLAUDE.md` with these rules: public-by-default (world-readable after the flip; no partner names, ratings, comp or private planning); planning repo is read-only context (via `--add-dir`), never copied from; specs and plans go in `docs/specs/` and `docs/plans/`; engine rule (no program names at the engine top level; sites never import each other); acceptance tests must pass, or the build fails; no hand-typed numbers in copy or code (numbers come from data); test fixtures name no hospital; zero-dependency default, and installs are flagged first; commit identity = the noreply address; milestone gates `/simplify` → tests → `/code-review` → `/security-review`; anything outward (push to a public remote, visibility flip, deploy, DNS, release) needs Dalton's explicit OK; no PHI.
- [ ] **Step 2:** `LICENSE` (MIT, "Copyright (c) 2026 Dalton Haslam"); `LICENSE-CONTENT` = the official CC BY 4.0 legal code, plain text (**download, flagged:** `https://creativecommons.org/licenses/by/4.0/legalcode.txt`), with a two-line header saying it covers prose, charts and derived data; `NOTICE`: CMS source data is US-government public domain; the project names and logos aren't licensed; no CPT descriptors or other restricted third-party material in the repo; not affiliated with or endorsed by CMS; `CITATION.cff` (cff-version 1.2.0, title "Paid & Penalized", author Dalton Haslam, url https://paidandpenalized.org, license MIT).
- [ ] **Step 3:** `CONTRIBUTING.md` ("Not accepting outside pull requests yet. Send corrections through the feedback form on the site."); `SECURITY.md` (report privately to the project email, which is not yet set, so for now write "through the site's feedback form, marked SECURITY"; no PHI).
- [ ] **Step 4:** `package.json`: `{"name":"paid-and-penalized","private":true,"type":"module","engines":{"node":">=22"},"scripts":{"test":"node --test \"engine/js/test/**/*.test.js\""}}`. `Makefile`: `test:` → `npm test`. `.gitignore`: `node_modules/`, `.DS_Store`, `.project-status`, `*.local.*`.
- [ ] **Step 5:** `engine/js/test/smoke.test.js` asserts `true`. Run `npm test`. Expected: 1 pass.
- [ ] **Step 6:** Commit: `Repo skeleton: CLAUDE.md, licenses, contributing, test runner`. This plan file goes in the same commit.

### Task 2: Pinned input + CSV parser

**Files:** Create `data/pinned/manifest.json`, the CSV, `engine/js/csv.js`, `engine/js/test/fixtures.js`, `engine/js/test/csv.test.js`, `engine/js/test/pinned.test.js`.

**Interfaces:**
- Produces: `parseCsv(text: string) → Array<Record<string,string>>`; `loadHacrpFy2026() → { text: string, rows: Record<string,string>[] }` (test-only, in `fixtures.js`).

- [ ] **Step 1 (download, approved 10-20):** `curl -fsSL -o data/pinned/hacrp-fy2026/FY_2026_HAC_Reduction_Program_Hospital.csv '<downloadURL from PDC metadata for yq43-i98g>'`, then `shasum -a 256`. Expected: `5e152d9872e6f3a012eafe312b1f9916c1cc0a830aed0752aa1aef1925a4e5c4`, 595,701 bytes. **On a mismatch, stop and ask Dalton.**
- [ ] **Step 2:** Write `manifest.json`: `[{ "id": "yq43-i98g", "path": "hacrp-fy2026/FY_2026_HAC_Reduction_Program_Hospital.csv", "bytes": 595701, "sha256": "5e15…", "downloadUrl": …, "landingPage": "https://data.cms.gov/provider-data/dataset/yq43-i98g", "pdcModified": "2026-01-26", "pdcReleased": "2026-08-13", "retrieved": "2026-10-20" }]`.
- [ ] **Step 3: Failing tests.** `csv.test.js`: quoted field with a comma; doubled quote `""` → `"`; CRLF and LF both; empty field → `""`; a trailing newline makes no empty row; a row whose field count differs from the header throws. `pinned.test.js`: every manifest entry's file exists and its byte length and SHA-256 match.
- [ ] **Step 4:** Implement `parseCsv` (character state machine; no regex split). Run `npm test`. Expected: all pass.
- [ ] **Step 5:** Commit: `Pin FY2026 HACRP file (PDC yq43-i98g) with SHA-256 manifest; CSV parser`.

### Task 3: Hospital records, total score, cutoff, flag (A1 (a) and (b))

**Files:** Create `engine/js/stats.js`, `engine/js/hacrp/measures.js`, `engine/js/hacrp/hospital.js`, `engine/js/hacrp/score.js`; tests `stats.test.js`, `hacrp/hospital.test.js`, `hacrp/a1.test.js`.

**Interfaces:**
- `MEASURES: ReadonlyArray<{ id: 'PSI90'|'CLABSI'|'CAUTI'|'SSI'|'CDI'|'MRSA', value: string, valueFootnote: string, z: string, zFootnote: string }>`, where the strings are CSV column names (e.g., `'PSI 90 Composite Value'`, `'PSI 90 Composite Value Footnote'`, `'PSI 90 W Z Score'`, `'PSI 90 W Z Footnote'`).
- `toHospital(row) → Hospital`:
  `{ ccn, name, state, fiscalYear, measures: { [id]: { value: number|null, valueText, valueFootnote, z: number|null, zText, zFootnote } }, total: number|null, totalText, totalFootnote, paymentReduction: 'Yes'|'No'|'N/A', paymentReductionFootnote, periods: { psi90: {start,end}, hai: {start,end} } }`. `N/A` and `''` → `null`. Text fields keep CMS's exact strings.
- `scoredMeasures(h) → id[]` (z !== null); `isAssigned(m) → boolean` (z !== null && value === null).
- `stats.js`: `mean(xs)`, `sampleSd(xs)`, `percentileInc(sorted, p)`, `percentileSas5(sorted, p)`, `linearFit(xs, ys) → { slope, intercept }`.
- `totalFromZ(zs: number[]) → number` (mean); `cutoffBoundary(hospitals) → { highestNo, lowestYes }`; `classify(score, boundary, band = 0) → 'Yes'|'No'|'too-close'`.

- [ ] **Step 1: Failing tests.**
  - `stats.test.js`: hand-checkable synthetic cases for each function; `percentileSas5` returns an observation (the mean of two at an exact n·p).
  - `hospital.test.js`: synthetic row, CCN `"010001"` stays a string; `N/A` → null; footnotes kept.
  - `a1.test.js` on the pinned file:
    - (a) `|totalFromZ(published z) − total| < 0.0001` for ≥ 99% of scored rows (assert the share, and log the max error).
    - (b) for every Yes/No row with a score, `classify(total, boundary) === paymentReduction`.
    - `lowestYes > highestNo`.
    - `percentileInc(all scored totals, 0.75)` lies in `[highestNo, lowestYes)`, and `total > p75` matches every Yes/No flag (the A1 wording, not circular).
- [ ] **Step 2:** Run. Expected: FAIL (modules missing).
- [ ] **Step 3:** Implement. Run. Expected: PASS.
- [ ] **Step 4:** Commit: `HACRP hospital records, total score and cutoff boundary; A1 (a)(b) pass on FY2026`.

### Task 4: Measure parameters, value → z, estimate tag (A1 (c))

**Files:** Create `engine/js/hacrp/params.js`, `engine/js/hacrp/model.js`; tests `hacrp/params.test.js`.

**Interfaces:**
- `fitMeasureParams(hospitals, id) → MeasureParams`:
  `{ id, n, mean, sd, floor, cap, zMin, zMax, median, decimals, fitError }`.
  Fit: least-squares of value on published z over the rows with both, *excluding* rows at zMin or zMax (clipped), giving value = mean + sd·z. Then floor = mean + sd·zMin, cap = mean + sd·zMax. `median` = median of published values. `decimals` = the decimal count of CMS's value text (3 for SIRs, 4 for PSI-90). `fitError` = max |zFromValue(value) − published z| over all rows with both.
- `zFromValue(value, p) → number`: clamp the value to [floor, cap], then `(v − mean) / sd`.
- `publicMethodZ(hospitals, id) → Map<ccn, number>`: SAS PCTLDEF=5 bounds at 0.05/0.95, winsorize, then z with the sample mean and SD of the winsorized values, over the rows with a published value.
- `estimateTagged(hospitals, id) → { tagged: boolean, maxError: number }` (threshold 0.001).
- `buildModel(hospitals) → { params: { [id]: MeasureParams }, boundary }`.

- [ ] **Step 1: Failing tests (pinned file).**
  - `fitError ≤ 0.0001` for each SIR and `≤ 0.0004` for PSI-90.
  - `zFromValue(cap + 1, p) === zFromValue(cap, p)` and `zFromValue(floor − 1, p) === zFromValue(floor, p)`.
  - `zFromValue` is non-decreasing over a 1,000-point grid.
  - The tagged set for FY2026 is exactly `{PSI90, CDI}`; SSI and MRSA `maxError ≤ 0.0001`.
  - Every assigned measure's published z equals that measure's zMax (to 1e-9): non-submitters sit at the worst score.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Run. Expected: PASS.
- [ ] **Step 4:** Commit: `HACRP parameter fit from CMS's value–z pairs; public-method recompute and estimate tag`.

### ☐ Checkpoint M1 (after Task 4)
- [ ] `/simplify` on the diff since the skeleton → `npm test` (a failure is a finding to fix).
- [ ] `/code-review` on the result. Fix Critical/Important before Task 5.

### Task 5: What-if

**Files:** Create `engine/js/hacrp/whatif.js`; tests `hacrp/whatif.test.js`, `hacrp/whatif.property.test.js`.

**Interfaces:**
- Consumes: `Hospital`, `buildModel`, `zFromValue`, `classify`.
- `whatIf(hospital, model, changes: { [id]: number } = {}) → WhatIfResult`:
  - No score: `{ available: false, reason: 'no-score', cms: { totalText, paymentReduction, totalFootnote } }`.
  - Otherwise `{ available: true, n, band, before: { score, flag }, after: { score, flag }, measures: { [id]: { assigned, beforeValue, afterValue, beforeZ, afterZ, changed, atCap, contribution, leveragePerTenth } } }`.
  - `flag` ∈ `'Yes'|'No'|'N/A'|'too-close'`. `before` is always CMS's. `changed` is false when the new value `===` the published value.
  - `contribution` = afterZ / n. `leveragePerTenth` = 0.1 / (n · sd), always the raw slope; `atCap` tells the UI when a move changes nothing.
  - Throws `RangeError` for a change to a measure with no published z, or a non-finite or negative value.

- [ ] **Step 1: Failing tests.**
  - **No change = CMS, every row** (3,055): for scored rows, `after.score === h.total`, `after.flag === h.paymentReduction`, each `afterZ === published z`; for unscored rows, `available === false` and the CMS text is passed through.
  - Setting a value to its published value is no change (Review Focus 1).
  - No movement above the cap: on a property-picked row with a measure above its cap, changing it to any other value above the cap leaves the score unchanged.
  - Assigned measure: on a property-picked assigned row, entering the national median lowers the score; with no entry it stays at CMS.
  - Maryland (N/A + score): any change keeps flag `'N/A'`.
  - One-measure row: band and leverage use n = 1.
  - `RangeError` cases (Review Focus 4).
  - A hypothetical score inside `(highestNo, lowestYes)` reads `'too-close'`.
  - **Property test** (`whatif.property.test.js`, seeded PRNG, 5,000 trials): pick a random scored row and a submitted measure, draw two values a < b in [0, cap·1.5]; then `after(a).score ≤ after(b).score + 1e-12`. Also: a worse value never lowers the score below `before`, and a better one never raises it above.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement per the Global Constraints math. Run. Expected: PASS.
- [ ] **Step 4:** Commit: `HACRP what-if: anchored on CMS, change-only math; no-change = CMS for every FY2026 row`.

### Task 6: Solver ("What would it take?" / "How much cushion?")

**Files:** Create `engine/js/hacrp/solver.js`; tests `hacrp/solver.test.js`.

**Interfaces:**
- `solveMeasure(hospital, model, id) → SolverResult`:
  `{ kind: 'needed'|'cushion', id, possible: boolean, value: number|null, atCap: boolean, unlimited: boolean, note: 'assigned'|'not-applicable'|'no-cushion'|null }`.
  - `needed` when CMS's flag is Yes; target score = `highestNo − fitError/n`. `cushion` when it is No; target score = the same bound (the highest value that still reads No).
  - Required z = zFromValue(current) + (target − total) · n. Then value = mean + sd·z.
  - `needed`: if the required z < zMin → `possible: false`; if the value ≥ cap → `value = cap, atCap: true` ("at or below the cap").
  - `cushion`: if the value comes out below the current value (a No row already inside the band) → `note: 'no-cushion'`.
  - `cushion`: if the required z ≥ zMax → `unlimited: true` (this measure alone can't cross the line).
  - Round to `decimals` in the safe direction (floor) for both kinds.
  - Assigned measures → `note: 'assigned'`, `value: null`. Maryland, no-score and too-close rows → `note: 'not-applicable'`.

- [ ] **Step 1: Failing tests.**
  - **Round-trip**: for every Yes row and every submitted measure with `possible && !atCap`, `whatIf(h, model, {[id]: result.value}).after.flag === 'No'`, using the *rounded* value (Review Focus 3).
  - Cushion: for every No row, applying the cushion value keeps 'No'; adding one display unit (10^−decimals) makes it 'too-close' or 'Yes', unless the result is `unlimited`.
  - The `atCap` and `possible: false` cases each occur at least once in FY2026 and behave as specified (picked by property).
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Run. Expected: PASS.
- [ ] **Step 4:** Commit: `HACRP solver: value needed / cushion per measure, safe rounding`.

### ☐ Final gate (full branch diff)
- [ ] `/simplify` → `npm test`.
- [ ] `/code-review` + `/security-review` (CSV parsing takes external input) + `/verify`: run `npm test` from a clean clone, and run `whatIf` on three property-picked rows from a Node REPL and read the output by eye.
- [ ] Fix all findings, then re-run until a clean pass.

### Task 7: Repo creation and push (outward; Dalton confirms the exact commands)

- [ ] `gh repo create paidandpenalized/paid-and-penalized --private --disable-issues --disable-wiki --description "Public explainers for CMS hospital payment programs. Not affiliated with CMS."`
- [ ] `gh api -X PATCH repos/paidandpenalized/paid-and-penalized -F has_discussions=false -F has_projects=false`
- [ ] `git remote add origin https://github.com/paidandpenalized/paid-and-penalized.git && git push -u origin main` (private remote).
- [ ] Verify: `gh repo view paidandpenalized/paid-and-penalized --json visibility,hasIssuesEnabled,hasWikiEnabled,hasDiscussionsEnabled`. Expected: PRIVATE, all false.

### Task 8: Planning-repo close-out (private repo)
- [ ] INDEX + detail-file lines: OPS-11 (b), ARCH-50 (b), LEGAL-08 (a) decided 2026-10-20; tick the ROADMAP P2a boxes that are done; Done list; Now rewrite; `.project-status`; hours.

---

## Amendments made during execution (2026-10-20)

- **Solver result:** `{ kind: 'needed'|'cushion'|null, id, possible, value, unlimited, note }`. There is no `atCap`: for a flagged hospital the value needed is always below its current value, so it can't reach the cap. "At or below the cap" is the cushion's `unlimited` answer. `kind` is null when `note` is `'assigned'` or `'not-applicable'`.
- **One value → z mapping (`hypotheticalZ` in `params.js`):** at or past the cap, CMS's maximum z; at or below the floor (for an SIR, 0), its minimum. In between, the change-only step from the published z, kept inside [zMin, zMax]. A published value already past a bound stays at its published z while the new value is past it too. Every real move carries its measure's fit error in the band, so the flag changes only once as a value rises. A z move smaller than 1e-9 counts as no move, and a net-zero change reports band 0.
- **The solver searches the what-if itself** (bisection over display units). Every answer reads "No" and one display unit higher does not. "Unlimited" means a value past the cap still reads "No"; "not possible" means 0 doesn't. "No-cushion" means the current value is already the highest that reads "No".
- **Flag direction:** a score that moves away from the line (a "No" hospital improving, a "Yes" hospital getting worse) keeps CMS's decision. Only a move toward the line is re-judged with the band.
- **Parameter bounds:** zMin and zMax come from hospitals with a published value. A test checks the assigned z-scores against them.
- **A1(a):** asserted for every scored hospital, which is stricter than the ≥ 99% in the spec, because FY2026 reaches 100%.
- **Guards added:** the CSV parser rejects stray quotes and duplicate headers; numbers must be plain decimals; the fit, the cutoff boundary and the estimate tag throw on degenerate input instead of returning NaN or Infinity.
