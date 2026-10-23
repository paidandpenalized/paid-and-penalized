# HACRP dollar estimates: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Estimate, for every hospital in the FY2026 HAC Reduction Program file, the dollars behind its 1% cut (and
the readmissions and value-based adjustments applied before it), prove the national totals against CMS's published
figures, and show the money on the HACRP pages so a reader sees it move in the what-if and wants to share it.

**Architecture:** Python reads CMS's FY2026 IPPS files and computes each hospital's estimate with pure functions in
`engine/py/pp_engine/`; `pipeline/py/pp_pipeline/emit_dollars.py` writes one emitted dataset,
`data/emitted/dollars/fy2026/dollars.json`, shared by every future site. The HACRP pages read it at build time; the
what-if gets each hospital's dollars at stake so the browser can move the money live. Ranges come from a scripted
back-test against hospitals' cost reports (milestone 3).

**Tech Stack:** stdlib Python 3.9+ (`python3 -I pipeline/py/run.py`), plain ES modules on `node:test`, the existing
page build. No new dependencies.

**Spec:** owner direction in the private planning repo, `docs/specs/2026-10-22-hacrp-dollars-spec.md`, and the
verified method it cites, `research/2026-10-19-dollar-method/close-out.md`. Use their facts and direction; don't
copy their notes into this repo.

## Global Constraints
- FY2026 throughout: the FY2026 impact file, FY2026 Tables 1A–1E, the FY2026 HRRP supplemental file, FY2026 Table
  16B (updated 2026-06-17), the FY2026 HACRP file already pinned (`yq43-i98g`). The hospital master stays FY2027.
- The formula, per hospital: HRRP $ = B(h − 1); HVBP $ = B(f − 1); T′ = T + HRRP $ + HVBP $; HACRP $ = −0.01 × T′
  when CMS's Payment Reduction is Yes, else 0; net = HRRP $ + HVBP $ + HACRP $. Negative is money Medicare keeps.
- B = the base operating DRG payment: cases × CMI × (labor rate × wage index + nonlabor rate × COLA), the rate pair
  from Table 1A (wage index > 1) or 1B (≤ 1) by the hospital's quality and EHR status (the federal payment, `fed`),
  plus the MDH add-on 0.75 × max(0, H − F), where H = the MDH hospital-specific rate (the file's FY2025 rate × the
  scenario's FY2026 update) × CMI(HSP) × cases and F = the federal operating payment = `fed` + IME + DSH + operating
  outliers + uncompensated care. SCH: federal payment only in B; its hospital-specific difference max(0, H − F), with H
  the SCH rate × CMI(HSP) × cases, is a separate part of T. NTAP isn't published per hospital: left out of B and
  stated as an assumption.
- T = all IPPS payment before the three adjustments, cost sharing included: B + operating IME (× `fed`) + operating
  DSH (× `fed`) + outliers (× `fed` + IME + DSH) + the SCH hospital-specific difference + low-volume (the adjustment
  × `fed` + MDH add-on + IME + DSH + outliers + SCH difference + capital, not uncompensated care) + capital (capital
  federal rate × CMI × GAF × (1 + capital IME + capital DSH) × cases, with outliers) + interim uncompensated care.
- Maryland: $0 in all three programs, out of every total. Pennsylvania Rural Health Model participants: no estimate,
  and the pages say why. MDH and expanded low-volume tiers: in force for all of FY2026 (reinstated through
  2026-12-31).
- Every dollar figure on a page says it is an estimate and carries its range. No dollar figure ships without a
  back-tested range; until milestone 3 the pages show the range as pending.
- No hand-typed numbers: rates come from the pinned Table 1A–1E file; tolerances are documented method constants.
  Copy files hold no digits; every factual sentence cites a row of `sites/hacrp/CLAIMS.md`.
- "CMS reports" for CMS's numbers; "this site estimates" for dollars. No site-published top or worst lists and no
  ranked headlines; default sorts stay alphabetical or by state; aggregates name no hospital.
- No PHI. No real CCN or hospital name in code, tests, comments or commits.
- Nothing public: no push to `main`, no deploy. Never `--no-verify`.
- Downloads: name each (source, file, size) before running it, then pin it. Files of 10 MiB or more stay out of git
  (pin a derived extract with `derivedFrom`, as `pos-q2-2026` does).

## Review Focus
1. A hospital in the HACRP file with no impact-file row, or with zero or blank cases or case mix: status
   `no-inputs`, no dollars in the JSON (never 0 or NaN), counted out of the totals and the count stated. Test in
   Task 4.
2. The hospital CMS marked Yes without a score: its own page shows its estimate, but national dollars sum over the
   same set as the headline count (scored, decided, Yes), so "718 hospitals, $X" agree; Methods notes the
   difference. Test in Task 5.
3. A hospital missing from the HRRP file or Table 16B takes factor 1 (no adjustment), counted and capped so a
   mismatched file fails loudly. Test in Task 5.
4. Rounding: per-hospital dollars are whole dollars, and every total is the sum of the rounded figures, so a reader
   adding a table gets the headline. Test in Task 4.
5. The what-if near the line: a too-close hypothetical score shows "$0 or $X", never one number. Test in milestone 2.

---

## Milestone 1: data and engine (branch `hacrp-dollars` off `main`)

### Task 1: Pin the FY2026 inputs

**Files:**
- Create: `data/pinned/ipps-impact-fy2026/fy2026-ipps-fr-impact-file.zip` (1,626,305 bytes, last modified
  2025-09-29), `data/pinned/ipps-rates-fy2026/fy2026-ipps-fr-table-1a-1e.zip` (15,431),
  `data/pinned/hrrp-fy2026/fy2026-hospital-readmissions-reduction-program-supplemental-data-file.zip` (1,721,540),
  `data/pinned/hvbp-fy2026/fy2026-ipps-table-16b.zip` (90,124), all from `https://www.cms.gov/files/zip/<name>`.
- Modify: `data/pinned/manifest.json` (ids `ipps-impact-fy2026`, `ipps-rates-fy2026`, `hrrp-supplemental-fy2026`,
  `hvbp-table16b-fy2026`; `downloadUrl`, `bytes`, `sha256`, `retrieved`).
- Create: `data/pinned/parhm-fy2026/` only if CMS publishes the FY2026 participant list as a file or page; record its
  source. If CMS publishes none, stop and report: the PARHM rule then can't be applied.

**Interfaces:**
- Produces: the five pin ids above; each zip's member names and the impact file's README column list, written into
  the docstrings of Task 2's parsers.

- [ ] **Step 1:** Name the four downloads (already named to the owner 2026-10-22) and download them to the paths
  above with `curl -fL`. Record SHA-256 and bytes in the manifest.
- [ ] **Step 2:** Run `python3 -I pipeline/py/run.py test` — expected: `test_pins` passes with the new entries.
- [ ] **Step 3:** List each zip's members and read the impact file's README; note every column Task 2 needs (cases,
  CMI, wage index, COLA, quality and EHR flags, provider type, MDH and SCH, HSP rate, operating and capital IME, DSH,
  uncompensated care, outlier, GAF, low-volume). A needed field with no column: stop and report.
- [ ] **Step 4:** Commit: `Pin the FY2026 IPPS impact file, Tables 1A–1E, HRRP supplemental and Table 16B`.

### Task 2: Parse the IPPS files

**Files:**
- Create: `engine/py/pp_engine/ipps.py`; Test: `engine/py/pp_engine/tests/test_ipps.py`.

**Interfaces:**
- Consumes: `parse.rows`, `parse.table`, `parse.index_by_ccn`, `parse.num`, `parse.SchemaError`.
- Produces:
  - `read_rates(text) -> dict`: `{"operating": {"1A": {key: (labor, nonlabor)}, "1B": {...}}, "capital": float,
    "update": {key: percent}}`, keys `qe`, `qn`, `ne`, `nn` (quality data submitted or not × meaningful EHR user or
    not); `update` is each scenario's FY2026 update as its Table 1A/1B heading states it.
  - `read_payment_inputs(text) -> {ccn: dict}` with keys `cases, cmi, wi, cola, quality, ehr, ptype, mdh, sch, hsp,
    ime_op, dsh_op, ime_cap, dsh_cap, gaf, ucp, outlier, low_volume` (numbers; `None` where blank).
  - `read_hrrp_factors(text) -> {ccn: float}`; `read_vbp_factors(text) -> {ccn: float}`.

- [ ] **Step 1: Write the failing tests** — synthetic text in the files' real layouts (from Task 1's notes):
  `test_rates_pairs_sum_to_the_full_rate` (each labor + nonlabor equals the table's full standardized amount);
  `test_rates_on_the_pin` (four keys in 1A and 1B; capital rate positive); `test_payment_inputs_blank_is_none`;
  `test_payment_inputs_duplicate_ccn_raises`; `test_factors_in_range_on_the_pins` (every HRRP factor in
  [0.97, 1.0]; every VBP factor in (0.9, 1.1)); `test_missing_column_raises` (a header without a needed column
  raises `SchemaError` naming it).
- [ ] **Step 2:** Run `python3 -I pipeline/py/run.py test` — expected: the new tests fail on import.
- [ ] **Step 3:** Implement the four readers in `ipps.py`. Read CMS's text as Windows-1252, as `emit_hospital.py`
  does. Column names live in one dict per reader, quoted from the README.
- [ ] **Step 4:** Run the tests — expected: pass.
- [ ] **Step 5:** Commit: `IPPS readers: FY2026 rates, payment inputs, HRRP and VBP factors`.

### Task 3: The estimate, per hospital

**Files:**
- Create: `engine/py/pp_engine/dollars.py`; Test: `engine/py/pp_engine/tests/test_dollars.py`.

**Interfaces:**
- Consumes: Task 2's dicts.
- Produces:
  - `estimate(inp, rates, *, hrrp, vbp, cut) -> dict` with keys `base, total, hrrp, hvbp, after, at_stake, hac, net`
    (floats; `base` = B and `total` = T per Global Constraints, both built from the dollar parts the dict also lists:
    `fed, mdh_addon, ime, dsh, outlier_op, sch_diff, low_volume, capital, uc`; `after` = T′; `at_stake` = 0.01 × T′ for
    every hospital; `hac` = −`at_stake` when `cut` is true, else 0).

- [ ] **Step 1: Write the failing tests** with synthetic hospitals whose answers are worked by hand in the test:
  `test_base_uses_1a_above_one_and_1b_at_or_below`; `test_cola_scales_nonlabor_only`;
  `test_mdh_addon_is_three_quarters_of_the_shortfall_and_never_negative`; `test_sch_base_is_federal`;
  `test_total_adds_each_component` (one component nonzero at a time); `test_hac_is_one_percent_of_total_after_both`
  (`hac == -0.01 * (total + hrrp + hvbp)`); `test_not_cut_keeps_at_stake_and_zero_hac`;
  `test_net_is_the_sum`.
- [ ] **Step 2:** Run — expected: fail on import.
- [ ] **Step 3:** Implement. Pure: no file, network or clock.
- [ ] **Step 4:** Run — expected: pass.
- [ ] **Step 5:** Commit: `Dollar estimate per hospital: B, T, the three adjustments and the net`.

### Task 4: Statuses and national checks

**Files:**
- Modify: `engine/py/pp_engine/dollars.py`; Test: `engine/py/pp_engine/tests/test_dollars.py`.

**Interfaces:**
- Produces:
  - `status(ccn, state, inp, parhm) -> str`: `"maryland"` (state MD), `"parhm"` (in the participant set),
    `"no-inputs"` (no row, or cases or CMI missing or zero), else `"estimated"`.
  - `national(rows) -> dict` over `estimated` rows: sums of the rounded `base, total, hrrp, hvbp, hac, net`, and
    counts.
  - `checks(nat, *, hacrp_yes) -> list[dict]` of `{id, value, low, high, pass}`.
  - Constants with their sources in comments: `HRRP_SHARE = (0.0040, 0.0048)` (CMS's 0.44%, FY2026 final rule Table
    I.G.7.-01); `HAC_SHARE = (0.002, 0.003)`; `VBP_NET_OF_POOL = 0.10` (|Σ HVBP $| ≤ 10% of 2% × Σ B over Table 16B
    hospitals).

- [ ] **Step 1: Write the failing tests:** `test_maryland_is_zero_and_out_of_totals`;
  `test_no_inputs_has_no_dollars` (Review Focus 1); `test_totals_are_sums_of_rounded` (Review Focus 4);
  `test_checks_flag_a_share_outside_its_range`; `test_hac_count_check_equals_the_files_yes_count_less_exclusions`.
- [ ] **Step 2:** Run — fail. **Step 3:** Implement. **Step 4:** Run — pass.
- [ ] **Step 5:** Commit: `Dollar statuses and the national checks`.

### Task 5: Emit the dataset

**Files:**
- Create: `pipeline/py/pp_pipeline/emit_dollars.py`, `schemas/dollars.schema.json`,
  `data/emitted/dollars/fy2026/dollars.json`, `pipeline/py/pp_pipeline/tests/test_dollars_golden.py`.
- Modify: `pipeline/py/run.py` (`emit` also runs the dollars), `docs/METHODS-LOG.md`
  (`## dollars methods_version 1 (<date>)`), `schemas/conformance/` if the envelope needs a case.

**Interfaces:**
- Consumes: Tasks 2–4; the HACRP pin `yq43-i98g` (Payment Reduction per CCN; scored or not).
- Produces `dollars.json`: the envelope (`schema_version` 1, `methods_version` 1, `source_manifest`, `sources`,
  `built_at`, `fy` 2026), then
  - `assumptions`: `{ratesFy, volumeFy, mdhEnd, lowVolumeEnd, ntap: "excluded"}`;
  - `national`: Task 4's sums and counts, `headline` (the same sums over scored, decided, Yes hospitals), `checks`;
  - `hospitals`: one row per HACRP-file CCN: `{ccn, status, cases, base, total, hrrpFactor, vbpFactor, hrrp,
    hvbp, after, atStake, hac, net}` (the repo's camelCase JSON keys), whole dollars, dollar keys absent unless `status` is `estimated`;
  - `bands`: `null` until milestone 3.

- [ ] **Step 1: Write the failing tests:** `test_rebuild_equals_committed`; `test_every_hacrp_ccn_has_one_row`;
  `test_every_check_passes`; `test_missing_factor_rows_counted_and_capped` (Review Focus 3: hospitals without an
  HRRP or VBP factor take 1; more than a stated cap fails); `test_headline_matches_the_scored_yes_count` (Review
  Focus 2).
- [ ] **Step 2:** Run — fail. **Step 3:** Implement; run `make emit`. **Step 4:** Run `make test` — pass.
- [ ] **Step 5:** Commit: `Emit the FY2026 dollar estimates (dollars methods_version 1)`.

### Checkpoint M1
- [ ] /simplify on the diff since `main`, then `make test`.
- [ ] /code-review; fix Critical and Important findings.
- [ ] /security-review (new external inputs).
- [ ] Report the national figures and every check to the owner before milestone 2.

## Milestone 2: the look

One author agent designs and builds the pages, screenshotting and art-directing as it goes (the redesign plan's
way). The owner direction's § Hospital page, § Program page, § Place pages and § Methods are the brief; aim for its
"the money is a cliff" idea and at least five new program-page figures.

**Interfaces it builds on:**
- `sites/hacrp/web/data.js` loads `dollars.json` and checks its `fy` equals the HACRP file's.
- `web/render/format.js` gains `money(x)` ("$48K", "$1.2M", "$342M", "$1.0B") and `moneyRange(lo, hi)`.
- The what-if's browser data (`sites/hacrp/web/pages/whatif.js` browserHospital) gains `atStake`; a pure
  `dollarsOf(flag, atStake)` beside `whatIf` returns 0, `-atStake`, or `[0, -atStake]` for too close; the result
  panel, scenario sentence and slide text carry it.
- The CSV gains modeled dollar columns; `DATA-DICTIONARY.md` and the CSV schema version follow.

- [ ] Hospital page: verdict money, the payment statement figure, the what-if cliff meter, share control, record
  card field, page description with the dollar sentence. Screenshots to the owner.
- [ ] Program page: summary form, the new Part, the score rule's dollars view, the sandbox. Place pages. Methods
  section. Screenshots to the owner.
- [ ] Checkpoint M2: /simplify → `make test` → /code-review → /security-review (share control, page script) →
  drive every interaction in Chrome (light, dark, 375 px, reduced motion).

## Milestone 3: the range

- [ ] Name and pin the back-test inputs: FY2024's impact file, Tables 1A–1E, HRRP supplemental and Table 16B (small),
  and HCRIS FY2024 hospital cost reports (large: keep it out of git, pin a derived extract of the lines used). Check
  the Worksheet E Part A line numbers for HRRP, HVBP and HAC against the current Provider Reimbursement Manual
  chapter 40 first.
- [ ] `pipeline/py/pp_pipeline/backtest_dollars.py`: re-run Tasks 2–4 on FY2024; per hospital, log(estimate ÷
  cost-report actual) for B, the HAC cut and the net; the 10th–90th percentile by stratum (beds under 100, 100–299,
  300+, crossed with MDH or SCH), the global median drift removed and each stratum's bias reported.
- [ ] `bands` in `dollars.json` (methods_version 2): per stratum, the multipliers for the HAC cut and the net; the
  pages turn on the ranges. Methods draws the back-test.
- [ ] Checkpoint M3: as M1.

## Milestone 4: accuracy and the final gate
- [ ] Claims for every new factual sentence (rates, the payment order, the base, Maryland, PARHM, MDH dates, NTAP);
  the copy gate; a verification pass by agents that didn't source them.
- [ ] Final gate on the whole branch: /simplify → `make test` → /code-review + /security-review + /verify. Then the
  merge, on the owner's OK.
