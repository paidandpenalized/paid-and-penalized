# Readmissions port: pipeline and engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port Thirty Day Readmissions' data pipeline and formula into the monorepo, emitting
`data/emitted/hrrp/fy2027/hrrp.json` that equals the pinned Thirty Day Readmissions data, plus the shared
JavaScript formula, the fiscal-year rule and program-keyed page budgets. No page changes.

**Architecture:** Pure readers and formulas in `pp_engine` (text or bytes in, values out), one emitter in
`pp_pipeline` that reads the pins and the committed hospital master and writes the emitted file through the existing
contract, and a golden test that holds the emitted body equal to `data/pinned/tdr/hrrp.json`. The browser formula is
a JavaScript port in `engine/js/hrrp/`.

**Tech Stack:** Python 3.9+ stdlib (`unittest`, `zipfile`, `xml.etree`, `decimal`); Node 22 ES modules
(`node:test`). No new dependencies.

**Spec:** `docs/specs/2026-11-05-hrrp-fold-in-design.md`. Source: Thirty Day Readmissions at
`33d195927241514a671ca34073a7d7870c555baf` (cite as `thirty-day-readmissions@33d1959`); its `pipeline/` and
`web/src/js/model.js` + `web/test/model.test.mjs` are the reference for every port below. Read the source function
before porting it; port its docstring too.

## Global Constraints

- Branch `hrrp-port` in `.claude/worktrees/hrrp-foldin`. No push, no PR, no tag push. Commit identity is the repo's
  noreply `user.email` (already set). Never commit `.claude/`.
- `pp_engine` is pure: no file, network or clock access. File reads live in `pp_pipeline` (`files.py`).
- Stdlib only (Python) and no new npm packages. Run Python through `python3 -I pipeline/py/run.py <cmd>`.
- Test fixtures name no hospital: synthetic rows, or rows picked by property. Tests may read the pins.
- No hand-typed numbers except method constants (`MIN_DISCHARGES = 25`, `CAP = 0.03`, `DECIMALS = 6`,
  `MAX_DECIMALS = 12`, `MDH_END = "2026-12-31"`) and the CMS worked example's published values.
- Every ported file's header comment: `Ported from Thirty Day Readmissions (<path> at 33d1959).`
- Every file is public: no planning IDs' reasoning, no private names.
- `make test` green after every task. `make emit` after any engine or pin change.

## Review Focus

1. A pinned zip or the workbook inside it carrying a `../` or absolute member name, a DTD, or a part over the size
   limit → `SchemaError`, nothing inflated or extracted (Task 2 tests).
2. A CMS header that appears twice or is renamed in the supplemental file or Table 15 → `SchemaError` naming the
   column, never a silently picked column (Task 2 tests; `parse.table` already requires exactly one hit).
3. The committed hospital master stale against the pins (a re-pin without `make emit`) → `emit_hrrp` refuses and
   says to run `make emit` (Task 6 test).
4. A value that is an exact decimal tie (the double 0.06145) or needs more than 6 decimals to print CMS's 4-decimal
   value → `stored()` moves or extends it and the formula still reproduces every factor (Task 4 tests; Task 7's
   all-hospital test).
5. `MDH_END` before the fiscal year starts or after it ends → `year_share` clamps to 0 or 1 (Task 4 test).

---

### Task 1: Pins (main thread)

**Files:** Modify `data/pinned/manifest.json`; create `data/pinned/hrrp-fy2027/…`, `data/pinned/hrrp-history-fy2013-2026/…`,
`data/pinned/hrrp-curated-fy2027/…`. Modify `NOTICE`.

**Produces:** manifest ids `hrrp-supplemental-fy2027`, `hrrp-table15-fy2027`, `ipps-rates-fy2027`,
`hrrp-history-fy2013-2026`, `hrrp-history-summary-fy2013-2026`, `hrrp-history-provenance`, `hrrp-annual-totals`,
`hrrp-dollar-check-fy2027`. (The design's two grouped ids split one-per-file: a manifest entry has one path.)

- [x] Copy the three CMS zips from Thirty Day Readmissions' local `data/raw/` and check each SHA-256 against its
      `pipeline/sources.json` (`63b7b7b0…`, `8c1b2a25…`, `70a89efe…`); re-download each from its cms.gov URL into the
      scratchpad and confirm the same hash (three downloads, 1.7 MB in all; named before running).
- [x] Entries in the shape of `ipps-impact-fy2027` (`title`, `path`, `bytes`, `sha256`, `downloadUrl`, `archiveUrl`
      to the `fy2027-raw-inputs` release where it has the file, `retrieved`).
- [x] Copy `pipeline/history/hrrp_paf_history_fy2013_2026.csv`, `hrrp_history_summary.csv`, `PROVENANCE.md`,
      `pipeline/content/annual_totals.json`, `dollar_check.json` byte-for-byte at the source commit (`git show
      33d1959:<path>`); entries in the shape of `tdr-geocodes` (`downloadUrl` at the commit, `sourceCommit`,
      `landingPage`).
- [x] `NOTICE`: the three new CMS files are unmodified copies; the five Thirty Day Readmissions files are unmodified
      copies of that MIT-licensed site's derived data and notes; formulas, prose and tests ported from it at
      `33d1959` carry its MIT notice (same copyright holder).
- [x] HACRP's Methods test holds every pin to the HACRP pages' list: allow the eight new ids (`PINS_AWAITING_EMIT`)
      until Task 6's emitter names them.
- [x] Run `make test` → PASS (the pin tests hash every entry and refuse unlisted files). Commit
      `Pins for the Readmissions port: FY2027 HRRP files, Tables 1A-1E, history and curated inputs`.

### Task 2: Readers — workbook, supplemental file, Table 15, zip guard (Sonnet)

**Files:** Create `engine/py/pp_engine/xlsx.py`, `engine/py/pp_engine/tests/test_xlsx.py`. Modify
`engine/py/pp_engine/parse.py`, `engine/py/pp_engine/tests/test_parse.py`, `pipeline/py/pp_pipeline/files.py`,
`pipeline/py/pp_pipeline/tests/test_pins.py` (or a new `test_files.py`).

**Interfaces — Produces:**
- `xlsx.XLSX_MAX_PART = 100_000_000`; `xlsx.sheet_rows(data: bytes, sheet: str, label: str) -> list[list[str]]`
  (TDR `_xlsx_rows` over bytes; refuses DTD/entity declarations, parts over the limit, out-of-order cells, a missing
  sheet; raises `parse.SchemaError`).
- `parse.CONDITIONS = ("AMI", "COPD", "HF", "PN", "CABG", "THA_TKA")`; `parse.SUPP_LABELS` (TDR's).
- `parse.read_supplemental(rows, label) -> {ccn: {paf, dual, peer, nm, c: {COND: {n, err, med, flag, ratio}}}}`,
  over an iterable of rows (the caller passes `xlsx.sheet_rows(...)` for the workbook or `rows(text, "\t")` for the
  tab export).
- `parse.read_table15(text, fy) -> {ccn: paf}`.
- `files.check_zip_members(zf: zipfile.ZipFile, label: str) -> None`: `SchemaError` on a member whose name is absolute
  (`/`, a drive letter) or has a `..` part, or contains a backslash. `read_zip_member` calls it on every open.

- [x] Tests first (synthetic workbooks built in the test with `zipfile` + minimal XML; synthetic tab text):
      `test_reads_shared_inline_and_numeric_cells`, `test_skipped_cells_are_blank`, `test_refuses_a_dtd`,
      `test_refuses_a_part_over_the_limit` (patch the limit small), `test_refuses_a_missing_sheet`,
      `test_refuses_cells_out_of_order`; `test_supplemental_full_precision_and_export_agree_on_shape`,
      `test_supplemental_flag_and_missing_values` (`.` → None, `Y` → 1), `test_supplemental_duplicate_column_raises`,
      `test_table15_reads_the_fy_column`, `test_table15_wrong_fy_raises`; `test_zip_member_escaping_refused` for
      `../x`, `/x`, `a/../../x`, `C:\\x`; `test_every_pinned_zip_passes_the_member_check`.
- [x] Pin test: `read_supplemental` over the pinned workbook (`FY2027_HRRP_Supplemental_File.xlsx`, sheet
      `FR FY 2027`) and the export (`FY2027_HRRP_Supplemental_File - FR FY 2027 Tab.txt`) yields 2,912 CCNs each,
      the same set as `tdr/hrrp.json`'s hospitals; Table 15 (`Section 508 version of FY2027_HRRP_Table_15.txt`)
      yields the same set with the same factors. (Counts and sets come from the pin, not typed.)
- [x] Implement, run `make test` → PASS, commit.

### Task 3: Readers — rates, estimate inputs, star rating (Sonnet)

**Files:** Modify `engine/py/pp_engine/ipps.py`, `engine/py/pp_engine/parse.py`, their tests.

**Interfaces — Produces:**
- `ipps.read_operating_rates(text) -> {"1A": {key: (labor, nonlabor)}, "1B": {...}}`: Tables 1A and 1B only, with
  `read_rates`' scenario-key and update-agreement checks; `read_rates` calls it (no behavior change: the dollars
  golden stays green). No `ImpactYear` needed.
- `ipps.read_estimate_inputs(text, fy, grouper) -> {ccn: {wi, cola, cases, cmi, qual_red, ehr_red, mdh, hsp}}`: TDR
  `read_impact`'s payment fields (`FY {fy} Wage Index`, `Cost of Living Adjustment` (blank → 1.0),
  `CASETA{grouper}`, `TACMIV{grouper}`, `Proxy Quality Reduction` == 1, `Proxy EHR Reduction` == 1, `MDH Flag`,
  `HSP Rate`).
- `parse.read_hgi` records gain `star`: `Hospital overall rating` as int when all digits, else None.

- [x] Tests: `read_operating_rates` over the pinned FY2027 rates member `CMS-1849-CN Tables 1A - 1E.txt` equals
      `tdr/hrrp.json` `meta.rates` (tuples vs lists normalized); FY2026's still equals what `read_rates` gave;
      `read_estimate_inputs` on synthetic tab text (blank COLA → 1.0, flags, missing → None); `star` digits/`Not
      Available`.
- [x] `make test` (hospital and dollars goldens unchanged) → PASS, commit.

### Task 4: `pp_engine/hrrp.py` — formula, stored decimals, gates, dollars (Sonnet; Opus reviewer)

**Files:** Create `engine/py/pp_engine/hrrp.py`, `engine/py/pp_engine/tests/test_hrrp.py`.

**Interfaces — Consumes:** `parse.CONDITIONS`; `dollars.MDH_SHARE`. **Produces** (TDR names, `SystemExit` → a
`HrrpError(ValueError)` raised with TDR's message):
- constants `MIN_DISCHARGES`, `CAP`, `DECIMALS`, `MAX_DECIMALS`, `MDH_END = "2026-12-31"` (cited comment: extended
  through Dec 31, 2026 by section 6202 of the Consolidated Appropriations Act, 2026);
- `contribution(nm, c)`, `contributions(h)`, `reduction(h)`, `replication_status(h)`;
- `est_base_payment(imp, rates)`, `est_mdh_addon(imp, federal, share)`, `est_penalty(base, paf)`;
- `rnd(v, places, half_up=False)`, `to_fixed4(v)`, `stored(v, published, label, ties=None)`,
  `stored_constant(rows, full, published, label, ties=None)`, `precision_mismatches(full, published)`,
  `as_stored(ccn, s, pub, nm, peer_med, ties=None)`, `replication_gate(kept)`, `extra_places(hospitals, peer_med, nm)`;
- `table15_mismatches(t15, supp) -> list`, `out_of_range(supp) -> list`;
- `year_share(fy, end)`, `mdh_shortfall(addons)`;
- `DOLLAR_CHECK_FIELDS`, `check_dollar_check(rec, fy) -> rec` (raises naming every bad field);
- `program_fields(s, imp, types, rates, mdh_share) -> (fields, addon)`: the HRRP part of a hospital record —
  `paf`, `red`, `dual`, `peer`, `base`, `pen`, `c` exactly as TDR's `hospital_record` computes them — and the
  `(federal, add-on, full-year add-on)` triple for an MDH with a base, else None.

- [x] Port TDR `tests/test_model.py` and the stored-decimals, gate, year-share, MDH and dollar-check tests from
      `tests/test_build.py` (skip its location, geocode and county tests: those are the master's), on synthetic
      records. Must include: `test_cms_worked_example` (Hospital A, peer 4, NM 0.9458: reduction rounds to 0.0034, PAF
      0.9966; HF under 25 contributes 0); `test_cap`; `test_exact_tie_moves_one_unit` (0.06145 published 0.0615);
      `test_needs_more_decimals` (1.0248497… published 1.0248); `test_year_share_clamps` (end before Oct 1 → 0,
      after Sep 30 → 1, Dec 31 of FY2027 → 92/365); `test_dollar_check_names_each_bad_field`.
- [x] Implement; `make test` → PASS; commit.

### Task 5: `pp_engine/hrrp_history.py` (Sonnet)

**Files:** Create `engine/py/pp_engine/hrrp_history.py`, `engine/py/pp_engine/tests/test_hrrp_history.py`.

**Produces:** `load_paf_history(text, keep_ids, first_fy, last_fy) -> (years, {ccn: [paf|None]})`,
`summarize_fy(fy, pafs, cap_pct) -> dict`, `load_national(text) -> list[dict]` — TDR `hrrp/history.py` over text.

- [x] Synthetic-CSV tests: scope-flagged rows skipped, out-of-range years ignored, PAF rounded to 4; summary on an
      empty list; `nMax` at the cap. Implement; `make test`; commit.

### Milestone A checkpoint (Tasks 1–5)

- [x] `/simplify` on the diff since `main`, then `make test`.
- [x] `/code-review` on that diff; fix Critical/Important.
- [x] `/security-review` (zip, workbook and CSV parsing are external input); fix Critical/Important.

### Task 6: `emit_hrrp.py`, the schema, the methods log, the goldens (main thread)

**Files:** Create `pipeline/py/pp_pipeline/emit_hrrp.py`, `schemas/hrrp.schema.json`,
`schemas/conformance/hrrp.cases.json`, `pipeline/py/pp_pipeline/tests/test_hrrp_golden.py`,
`data/emitted/hrrp/fy2027/hrrp.json`. Modify `pipeline/py/run.py` (emitters: hospital, hrrp, dollars),
`docs/METHODS-LOG.md`, `pipeline/py/pp_pipeline/files.py`.

**Interfaces — Produces:** `emit_hrrp.build_from_pins(built_at) -> dict`, `emit_hrrp.emitted_path(fy)`,
`emit_hrrp.committed_path()`, `emit_hrrp.main() -> int`; `emit_hrrp.SOURCES` (its own pins, then the master's
`emit_hospital.SOURCES`, so a re-pin of either moves `source_manifest`); `files.require_current(emitted, manifest,
label)` (raises `ValueError` "… run `make emit`" unless `emitted["source_manifest"]` is the hash of the manifest's
entries for `emitted["sources"]`).

- [x] Golden tests first: `test_fresh_emit_equals_committed` (all but `built_at`);
      `test_body_equals_tdr_pin` — `meta` less `sources` and `whatsNew`, `conditions`, `hospitals`, `history`
      deep-equal `tdr/hrrp.json`; `test_every_factor_reproduces` (2,912 of 2,912 `exact` from the stored values);
      `test_stale_master_refused`; `test_unknown_ccn_refused` (a supplemental CCN with no master record).
- [x] Build: TDR `build()` order of gates (Table 15, PAF range, workbook vs export, stored constants and medians,
      `as_stored`, replication gate), then per CCN the master's fields renamed to TDR's (`ccn→id`, `state→st`,
      `bedsSource "cr"→bedsSrc "cr"`; `alias`, `bedsSrc`, `inactive` left out when None) plus HGI `star` and
      `program_fields`; `meta` as TDR's but `sources` = `[{id, name: title, url}]` per pin plus the Census Geocoder,
      no `whatsNew`; `history` from the pinned CSVs with FY2027's row from `summarize_fy` and the annual totals. The
      TDR build report prints (stored-decimals count, ties, MDH add-on).
- [x] Schema in the subset `engine/js/schema.js` supports; conformance cases (a valid record, a bad CCN, a PAF out of
      range). `## hrrp methods_version 1 (2026-11-05)`: Thirty Day Readmissions' method at `33d1959`, unchanged.
- [x] `sites/hacrp/test/methods.test.js`: drop Task 1's `PINS_AWAITING_EMIT`; count the pins named by the other
      sites' emitted files (`data/emitted/hrrp/`) as used.
- [x] `make emit`, `make test` → PASS; `node tools/ci/change-gate.js` against `main` reads the file as new. Commit.

### Task 7: `engine/js/hrrp/` (Sonnet; Opus reviewer)

**Files:** Create `engine/js/hrrp/formula.js`, `whatif.js`, `summary.js`, `filters.js`;
`engine/js/test/hrrp/formula.test.js`, `whatif.test.js`, `summary.test.js`, `filters.test.js`.

**Produces** (TDR `model.js` names and behavior):
- `formula.js`: `CONDS`, `PEERS`, `MIN_DISCHARGES`, `CAP`, `CAP_PCT`, `cutPct`, `isMeasured`, `weightPublished`,
  `WEIGHT_MISSING`, `peerMedian`, `conditionContribution`, `contrib`, `condState`, `verdict`.
- `whatif.js`: `whatIfPaf`, `niceDomain`, `sliderRange`.
- `summary.js`: `measuredAny`, `noEstimate`, `summarize`, `percentileRank`, `rankPct`, `peerBands` (d3's
  `quantileSorted` → `stats.percentileInc`, the same R-7 interpolation).
- `filters.js`: `slug`, `scopeFilter`, `BED_BANDS`, `bedBand`, `applyFilters`, `TEACH_LABEL`.
- Wording and formatting (`fmt*`, `plural`, `toCSV`, `noEstimateNote`, `penalizedOfMeasured`, …) stay out: they
  belong to the site (pages step).

- [x] Port the matching tests from `web/test/model.test.mjs`, incl. `reproduces the CMS worked example (0.34%)` and
      `the formula reproduces CMS's factor for every hospital` over both `data/emitted/hrrp/fy2027/hrrp.json` and
      `data/pinned/tdr/hrrp.json` (2,912/2,912); add `peerBands` equals d3's on a synthetic list (d3-array is a dev
      dependency, so the test may import it).
- [x] Implement; `npm test` → PASS; commit.

### Task 8: `engine/js/years.js` (Sonnet)

**Files:** Create `engine/js/years.js`, `engine/js/test/years.test.js`.

**Produces:** `shownYear(program: { years: number[] }) -> number | null` (the newest);
`hubYear(programs: { years: number[] }[]) -> number | null` (for each FY, the count of programs with it; the FY with
the most, the later on a tie; null when none).

- [x] Tests: `shownYear({ years: [2026, 2027] })` is 2027; empty → null; `hubYear` with three programs on 2026 and one
      on 2027 → 2026; a 2–2 tie → the later; duplicates in one program count once; unsorted input. Implement; commit.

### Task 9: Program-keyed page types and budgets (Sonnet)

**Files:** Modify `tools/ci/page-types.js`, `tools/ci/size-budget.js`, `tools/test/page-types.test.js`,
`tools/test/size-budget.test.js`.

**Produces:** `pageType(path)` unchanged in its return values; new `pageProgram(path) -> string | null` (the program
id for `program`, `hospital`, `place`, `methods`, `dictionary`; null otherwise), from a `PROGRAM_SITES` list
(`[{ id: 'hacrp', … }]`; HRRP's entry joins with its pages); `BUDGETS` keeps the family-wide types and gains
`PROGRAM_BUDGETS = { hacrp: { program: 330 KB, hospital: 120 KB, place: 150 KB, methods: 100 KB, dictionary: 50 KB },
hrrp: { same } }`; `budgetOf({ type, program })` used by `overBudget`. The interim `hrrp`/`hrrpHospital` types stay.

- [x] Tests: every HACRP page's type and budget unchanged; `PROGRAM_BUDGETS.hrrp` deep-equals `.hacrp`; every
      `PROGRAM_SITES` id has budgets; a program-keyed type with no program throws. `make build` then
      `node tools/ci/size-budget.js` → within budget. Commit.

### Task 10: Site content and provenance (Sonnet)

**Files:** Create `sites/hrrp/content/research.json`, `timeline.json`, `whats_new.json` (byte copies at `33d1959`),
`sites/hrrp/content/README.md` (where each came from; that page copy goes through the site's claims register when the
pages are built). Test `sites/hrrp/test/content.test.js`: `whats_new.json` items equal `tdr/hrrp.json` `meta.whatsNew`
for its `fy`; each file is valid JSON. Commit.

### Milestone B checkpoint (Tasks 6–10) and final gate (full branch)

- [x] `/simplify` on the diff since Milestone A, then `make test`.
- [x] `/code-review`; `/security-review` (the emitter's reads and the new schema); fix Critical/Important; repeat
      until clean.
- [x] Final: `make test`, `make emit` leaves git clean, `make build` + size budget, `node tools/ci/change-gate.js`.
- [x] Thirty Day Readmissions: `git tag -a pre-foldin 33d1959` there, local only (not pushed).
- [x] Stop: report what landed; nothing pushed. (Tag created locally; branch not pushed.)
