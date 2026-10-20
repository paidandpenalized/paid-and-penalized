# P2a part 3 (session 2 of 2): the hospital master's geography (methods_version 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every record in `data/emitted/hospital/fy2027/hospital_master.json` gains a map point (`lat`, `lon`, `geo`),
a county label and FIPS code, a CBSA and its name, and a census region and division, built offline from pinned files,
equal to Thirty Day Readmissions' values for every HRRP hospital. HACRP's `inProgram` comes to mean "subject to the
payment adjustment". The master becomes `methods_version` 2.

**Architecture:** TDR's location code is ported, not rewritten: `pipeline/hrrp/geo.py` becomes `pp_engine/geo.py`
(pure: it takes parsed TopoJSON, not a path) and `locate`, `named_city`, `place_name`, `county_label`, `place_hospital`
from `pipeline/build_data.py` become `pp_engine/location.py`. TDR's `pipeline/geocode.py` becomes
`pp_pipeline/geocode.py`, a hand-run client that is never called by the build or tests. Street-address points come
from two pinned CSVs: TDR's `geocodes.csv` (2,526 HRRP hospitals) and the result of one Census Geocoder batch call made
in this session for the rest.

**Tech Stack:** stdlib Python 3.9 (CI 3.12.15), `unittest`, seeded `random.Random` for property tests. No JS change
except whatever the contract tests need.

**Spec:** ARCH-04 (amended 2026-10-20) and Dalton's answers this session, restated here (the planning repo is private):
- Geocodes: TDR's `pipeline/content/geocodes.csv`, then one Census Geocoder batch call
  (`geocoding.geo.census.gov`, benchmark `Public_AR_Current`) for master hospitals without a point; the result CSV is
  committed as a pinned input. Unmatched hospitals fall back to the ZIP centroid (2024 ZCTA gazetteer), then the county.
- New pins copied from TDR's local `data/raw/` and SHA-checked against TDR's `pipeline/sources.json`: the ZCTA
  gazetteer zip, us-atlas 3.0.1 `counties-10m.json`, the FY2027 county-to-CBSA crosswalk zip.
- Record fields: `lat`, `lon` (4 decimals), `geo` (`address`/`zip`/`county`/null), `county`, `fips`, `cbsa`,
  `cbsaName`, `region`, `division`; `state` falls back to the impact file's FIPS state.
- TDR check: county, coordinates and CBSA equal TDR's for every HRRP hospital, or the test lists the differences.
- HACRP `inProgram` = subject to the payment adjustment (Dalton, 2026-10-20): the FY2026 file's 43 `N/A` rows (all
  Maryland) become `inProgram: false`, reason `maryland`, as in HRRP.
- ARCH-02 amended (Dalton, 2026-10-20): the repo never runs an editable install.

## Decisions taken for this plan (2026-10-20)

- **Who the Census call covers:** the 2,536 master hospitals that have a street address, no TDR point, and are not
  HRRP hospitals. The 386 HRRP hospitals without a TDR point are left out: TDR's own call (same benchmark,
  2026-10-11) already tried both their Care Compare and POS addresses, and a new point for them would break the TDR
  check until the fold-in. They keep TDR's ZIP/county placement.
- **One call, two rows per hospital:** the batch holds each hospital's Care Compare address and, when it differs, its
  POS address (ids `<ccn>-1`, `<ccn>-2`; ~5,000 rows, under the 10,000-row limit). The first-choice match wins. This
  keeps TDR's two-address fallback in a single request.
- **TDR's points are pinned at `80f3659`** (`geocodes.csv` is unchanged from there to TDR's HEAD), the same commit as
  `tdr/hrrp.json`.
- **`schema_version` 2** for `hospital.schema.json`: the record gains required fields, so a v1 reader would reject it.
- **County gate:** the build lists every county the rules can't check and fails above `MAX_UNCHECKED_COUNTIES`, set
  to the count this build finds across all 5,449 hospitals (TDR's limit, 17, covers HRRP only). The CCNs are printed,
  not pinned in a test (fixtures name no hospital; the golden check catches any change).
- **HACRP rule:** `hacrp_program()` returns `subject` (CCNs whose Payment Reduction is `Yes` or `No`) beside `names`;
  it raises `SchemaError` if any `N/A` row is outside Maryland, so a new kind of exemption can't silently take the
  `maryland` reason.

## Global Constraints

- Session 1's constraints hold (stdlib only; 3.9 syntax; `pp_engine` pure; CCN is 6-character text; synthetic CCNs
  and invented names in fixtures; canonical JSON; emitted layout; repo-local noreply identity; commit trailers).
- No network in tests or builds. The only network use is the one Census call (Task 4), approved by Dalton 2026-10-20,
  announced in the session before it runs. No other download or install.
- CMS text files are read as cp1252; the gazetteer and TopoJSON as UTF-8.
- `lat`/`lon` are `round(v, 4)` (TDR's `rnd` without `half_up`), so they equal TDR's exactly.
- `STRAY_KM = 40`, as in TDR.
- Nothing copied from TDR may name a hospital (TDR's `named_city` docstring and tests name one; drop it).

## Review Focus

1. **The response is untrusted.** A geocoder row with an id not requested, a repeated id, another state, malformed or
   out-of-bounds coordinates, or a body over 10 MB must not reach the CSV (port TDR's checks and their tests).
2. **An outage must not wipe points.** Fewer than half the hospitals matched → the CSV is left unchanged.
3. **Fallback order is total.** Any mix of point / ZIP / Care Compare county / impact FIPS present or absent gives
   exactly one of `address`, `zip`, `county`, null, in that priority, and `lat`/`lon` are null exactly when `geo` is
   (property test, Task 3).
4. **A hospital with no Care Compare row** (impact- or program-only) still gets a ZIP (POS) and a state (FIPS) and its
   county from the impact file (test in Task 5).
5. **Two point sources overlapping:** a CCN in both TDR's CSV and the Census CSV fails the build rather than picking
   one silently (test in Task 5).

---

## File map

- Create `engine/py/pp_engine/geo.py`: TDR `geo.py` port; `read_counties(topo)` takes the parsed object.
- Create `engine/py/pp_engine/location.py`: `STRAY_KM`, `locate`, `independent_city`, `atlas_fips`, `named_city`,
  `place_name`, `county_label`, `place_hospital`, `Ref`.
- Modify `engine/py/pp_engine/parse.py`: `table` gains TDR's `*suffix` header match; `read_hgi` adds `county`;
  `read_impact` adds `fips`, `cbsa_geo`; new `read_zcta(text)`, `read_cbsa_names(text)`, `read_points(text)`.
- Modify `engine/py/pp_engine/master.py`: location fields, state fallback, `subject` per program, v2.
- Create `pipeline/py/pp_pipeline/geocode.py`; `run.py geocode`.
- Modify `pipeline/py/pp_pipeline/emit_hospital.py`: new pins, `Ref`, report and county gate.
- Tests: `engine/py/pp_engine/tests/test_geo.py`, `test_location.py`, additions to `test_parse.py`, `test_master.py`;
  `pipeline/py/pp_pipeline/tests/test_geocode.py`; `test_tdr_names.py` → `test_tdr_check.py`.
- Pins: `data/pinned/zcta-2024/`, `us-atlas-3.0.1/`, `county-cbsa-fy2027/`, `tdr/geocodes.csv`,
  `census-geocodes-2026-10/geocodes.csv`; `manifest.json`; `NOTICE`.
- `schemas/hospital.schema.json`, `schemas/conformance/hospital.cases.json`, `docs/METHODS-LOG.md`, `CLAUDE.md`,
  `README.md` (if it lists pins or fields).

### Task 1: Pins

**Files:** `data/pinned/**`, `data/pinned/manifest.json`, `NOTICE`; test `pipeline/py/pp_pipeline/tests/test_pins.py`

- [ ] **Step 1:** Write `test_every_manifest_entry_matches_its_file` (every entry: size and SHA-256 equal, via
  `read_pinned_bytes`) and `test_no_unlisted_pinned_files` (every file under `data/pinned/` except `manifest.json` is
  some entry's `path`). Run → passes today (it guards the new entries).
- [ ] **Step 2:** Copy from `../thirty-day-readmissions/data/raw/`: `zcta_gazetteer_2024/2024_Gaz_zcta_national.zip`,
  `us_atlas_counties/counties-10m.json`, `county_cbsa_fy2027/fy2027-ipps-fr-county-cbsa-crosswalk-file.zip`. Check
  each SHA-256 against TDR's `pipeline/sources.json`; write `git -C ../thirty-day-readmissions show
  80f3659:pipeline/content/geocodes.csv` to `data/pinned/tdr/geocodes.csv`. No download.
- [ ] **Step 3:** Manifest entries `zcta-2024`, `us-atlas-counties-3.0.1`, `county-cbsa-fy2027`, `tdr-geocodes`
  (title, path, bytes, sha256, downloadUrl from `sources.json`, landingPage, `sourceCommit` for TDR, retrieved
  2026-10-20). NOTICE: the gazetteer and crosswalk are federal works (unmodified copies); us-atlas 3.0.1 is ISC-licensed
  TopoJSON derived from Census cartographic boundaries; `tdr/geocodes.csv` is TDR's Census Geocoder output.
- [ ] **Step 4:** `make test` → pass. Commit `Pin the ZCTA gazetteer, us-atlas counties, the FY2027 county-CBSA
  crosswalk, and TDR's geocodes`.

### Task 2: Readers and geometry, ported from TDR

**Interfaces — Produces:**
- `parse.read_zcta(text) -> {zip5: (lat, lon)}`; `parse.read_cbsa_names(text) -> {cbsa: name}` (columns `*cbsa`,
  `*cbsa name`; quotes stripped); `parse.read_points(text) -> {ccn: (lat, lon)}` (header `ccn,lat,lon,match,source`;
  duplicate CCN or malformed coordinate raises `SchemaError`); `read_hgi` records gain `county`; `read_impact`
  records gain `fips` (5-digit, zero-filled, or None) and `cbsa_geo`.
- `geo`: `DIVISIONS`, `STATES`, `STATE_FIPS`, `STATE_NAMES`, `region_of(st)`, `county_key`, `city_stem`,
  `drop_suffixes`, `Counties(centroid, by_name, shape, name, named)`, `read_counties(topo: dict) -> Counties`,
  `km_outside(lat, lon, polys)`.

- [ ] **Step 1:** Tests in `test_geo.py`: port TDR's `GeoTest.test_region_and_division`, `CountyKeyTest` (all four),
  `test_km_outside` (unit-square `SQUARE` and the holed square). Add `test_read_counties_decodes_a_synthetic_topology`:
  a hand-made two-county TopoJSON (FIPS `99001` a unit square, `99002` a two-polygon county) with `transform`
  scale/translate; assert centroid of the largest polygon, `by_name` keys, `named`, and `shape` rings.
- [ ] **Step 2:** Tests in `test_parse.py`: `table` `*` suffix match (`"*cbsa"` finds `"FY 2025 CBSA"`, not
  `"FY 2025 CBSA Name"`; the first hit wins, as in TDR); `read_zcta` on a two-row synthetic gazetteer with padded header;
  `read_cbsa_names` on a synthetic crosswalk with a title row and quoted names; `read_points` happy path, duplicate
  CCN, `lat` = `"x"`; HGI `county` and impact `fips` zero-fill.
- [ ] **Step 3:** Run → fail. Port the code (TDR `geo.py` verbatim except `read_counties` takes the parsed object).
  Run → pass. Commit `Port TDR's county geometry and the gazetteer, crosswalk and point readers`.

### Task 3: Location rules, ported from TDR

**Interfaces — Produces:** `location.STRAY_KM = 40`; `locate(g, imp, st, zcta, counties, point=None) ->
(lat, lon, source, county label or None)`; `county_label(g, st, fips, counties, point=None, moved=None) ->
(label, doubt)`; `place_hospital(ccn, g, imp, st, ref) -> (lat, lon, geo, county)`;
`Ref = namedtuple("Ref", "zcta counties points moved unchecked")`. `g` is `{"zip", "county"}`; `imp` is
`{"fips"}`.

- [ ] **Step 1:** Port to `test_location.py`, with synthetic CCNs (`990001`…) and no hospital named:
  `StrayPointTest` (all), `CountyLabelTest` / `CountyDoubtTest` with TDR's synthetic `COUNTIES` fixture,
  `HospitalCountyTest`'s three `place_hospital` cases, `test_place_name`, `test_independent_city_fips`,
  and the `CHECKED_COUNTIES` table run against the pinned atlas (`RealAtlasCountyTest`).
- [ ] **Step 2:** Property tests (seeded `random.Random(2026)`, 500 draws over the synthetic geography): for random
  presence of point (inside / ~22 km out / ~111 km out / none), ZIP point (inside / near / far / none), Care Compare
  county (known / unknown / none) and FIPS (in atlas / centroid only / unknown / none):
  - `test_fallback_order`: `source` is `address` iff a point was given and is within `STRAY_KM` or its FIPS has no
    shape; else `zip` iff a ZIP point exists and isn't >`STRAY_KM` out; else `county`; else None;
  - `test_coordinates_null_exactly_when_source_is`;
  - `test_a_far_point_lands_on_the_fips_centroid` (whenever source is `county` and the label is not None, the point is
    `counties.centroid[fips]`).
- [ ] **Step 3:** Run → fail. Port the functions (`Ref` slimmed to the fields above; docstrings keep TDR's rules,
  minus the hospital example). Run → pass. Commit `Port TDR's location rules: stray check, fallbacks, county labels`.

### ☐ Checkpoint M1 (after Task 3)
- [ ] `/simplify` on the diff since the plan commit → `make test`.
- [ ] `/code-review` on the result. Fix Critical/Important; Minors below. (No security review: no external input yet
  beyond pinned files.)

### Task 4: Census Geocoder client and the one call

**Interfaces — Produces:** `geocode.candidates(ccns, hgi, pos) -> {ccn: [(src, street, city, st, zip), ...]}`;
`geocode.batch(cands) -> {id: (src, street, city, st, zip)}` with ids `<ccn>-<n>`;
`geocode.parse_response(text, batch) -> {id: (lat, lon, match)}`; `geocode.pick(found) -> {ccn: (lat, lon, match,
src)}` (lowest `n` wins); `geocode.write(found, attempted, path)`; `geocode.gap() -> sorted ccns` (master universe
minus TDR points minus TDR HRRP ids); `main(send=post)`.

- [ ] **Step 1:** `test_geocode.py` with a fake `send`: port TDR's `parse_response` checks (unrequested id, repeated
  id, `No_Match`, `Tie`, wrong state, malformed coordinate, outside `US_BOUNDS`); POS row dropped when equal to HGI
  case-insensitively; first choice wins over second; `>10,000` rows raises; `write` refuses below `MIN_MATCHED` and
  leaves the file; written lines are `f"{lat:.5f}"`. `gap()` excludes TDR's points and HRRP ids (on the real pins:
  disjoint from both, 2,537 CCNs today).
- [ ] **Step 2:** Run → fail → port → pass. `run.py geocode` added (help text says it calls the network). Commit
  `Census Geocoder batch client (hand-run, never called by the build)`.
- [ ] **Step 3:** Announce in the session: "starting the one approved Census Geocoder call: N rows for M hospitals."
  Run `python3 -I pipeline/py/run.py geocode` once. Record counts printed.
- [ ] **Step 4:** Manifest entry `census-geocodes-2026-10` (path `census-geocodes-2026-10/geocodes.csv`, bytes, sha256,
  `request`: URL, benchmark, row and hospital counts, date; note that the service can't reproduce it byte for byte);
  NOTICE line. `make test` → pass. Commit `Pin the Census Geocoder result for hospitals TDR didn't geocode`.

### Task 5: Master v2, emitted, TDR check on location

**Interfaces — Consumes:** Tasks 2–4. **Produces:** `build_master(hgi, impact, pos, programs, fy, manifest,
sources, built_at, ref)`; `programs[pid] = {"fy", "names", "subject"}`; record keys add `county`, `fips`, `lat`,
`lon`, `geo`, `cbsa`, `cbsaName`, `region`, `division`.

- [ ] **Step 1:** Tests in `test_master.py` (synthetic geography from Task 3's fixture):
  - a record's location fields: `fips` from the impact file; `cbsa` only when 5 characters; `cbsaName` from the
    crosswalk or None; `region`/`division` from the state;
  - `state` falls back HGI → POS → impact FIPS state; with it the impact-only Maryland CCN gets `maryland`;
  - no HGI row: the ZIP comes from POS and the county label from the impact FIPS (Review Focus 4);
  - a CCN listed but not in `subject` → `inProgram: false`, reason from `reason_for` (`maryland` for MD);
  - overlapping point sources raise (Review Focus 5).
  In the pipeline tests: `hacrp_program()` `subject` has 3,012 CCNs and its `N/A` rows are all MD; a synthetic
  non-MD `N/A` raises.
- [ ] **Step 2:** `test_tdr_check.py` (renamed): add `test_location_matches_tdr` comparing, for every TDR hospital,
  `(state, county, lat, lon, geo, cbsa, cbsaName, region, division)` to the master's (TDR keys `st`, `county`, `lat`,
  `lon`, `geo`, `cbsa`, `cbsaName`, `region`, `division`); the failure message lists each differing CCN and field.
  `test_hrrp_set` unchanged.
- [ ] **Step 3:** Schema: new required fields (`lat`/`lon` number|null in range; `geo` enum; `fips`/`cbsa`
  `^[0-9]{5}$`|null; `county`/`cbsaName` string|null minLength 1; `region`/`division` enums from `geo.DIVISIONS`);
  `schema_version` const 2; conformance base + cases (a null-geo record valid; `geo: "gps"` invalid; `lat: 91`
  invalid; 4-digit `fips` invalid). Schema-enum test extended to `region`/`division`/`geo`.
- [ ] **Step 4:** Implement; emitter builds `Ref` from the pins, prints moved / set-aside / unchecked counts, and fails
  above `MAX_UNCHECKED_COUNTIES`. `METHODS_VERSION = 2`, `SCHEMA_VERSION = 2`. METHODS-LOG heading
  `## hospital methods_version 2 (2026-10-20)`: location sources and order, the stray rule, CBSA, region, state
  fallback, HACRP `inProgram` meaning. `make emit` → `make test` → pass, including the TDR location check. Docs
  (`CLAUDE.md` layout line on the master). Commit `Hospital master methods_version 2: location fields, HACRP subject
  to adjustment`.

### ☐ Final gate (full diff since this plan's commit)
- [ ] `/simplify` → `make test`.
- [ ] `/code-review` + `/security-review` (the geocoder client reads an HTTP response; new pinned inputs) + `/verify`:
  clean clone → `make test`; `make emit` leaves git clean; a hand-edited `lat` in the emitted file fails the golden and
  TDR checks; a duplicate CCN in a points CSV fails.
- [ ] Fix Critical/Important; list Minors below. Push to the private remote; CI green.

### Task 6: Planning-repo close-out (private repo)
- [ ] INDEX: ARCH-04 (geography built, v2; HACRP `inProgram` meaning), ARCH-02 amended (no editable install),
  ARCH-17 noted (five new pins); detail-file lines; Done list; Now rewrite; `.project-status`; hours from Dalton.

---

## Amendments made during execution

- **Census call (2026-10-20):** one request, 2,748 addresses for 2,536 hospitals, 12 seconds; 2,147 matched (1,648
  Exact, 499 Non_Exact; 35 on the POS address). Unmatched 389 + 1 with no street address use ZIP/county placement.
- **Result:** geo sources across 5,449 hospitals: 4,673 address, 740 ZIP, 34 county, 2 none (one Virgin Islands
  hospital whose ZIP isn't a ZCTA and has no atlas county; one VA hospital outside the impact file whose ZIP isn't a
  ZCTA). Every TDR hospital's state, county, point, source, CBSA, CBSA name, region and division equal the master's.
  HACRP: 3,012 subject of 3,055 listed.
- **County gate:** 73 unchecked across the master (17 among HRRP hospitals, TDR's own 17). After the final-gate
  altitude review the gate counts only names Care Compare gave in a state the atlas covers (37; 16 of them HRRP):
  a missing name or a territory can't be fixed by teaching a spelling, so those are printed but not counted.
  `MAX_UNCHECKED_COUNTIES` is 37 in `emit_hospital.py`; `make emit` prints all 73.
- **Final-gate simplify** (4 angles): `listed` renamed `subject`; `place` required in `build_master`; one gate run
  per emit; the geocoder's gap reads the HRRP set from `tables()`; a test that the master gives every HACRP N/A row
  reason `maryland`. Skipped: moving pin accessors to their own module, a namedtuple for addresses (ported code),
  normalizing CBSA in the reader.
- **Territories:** American Samoa, Guam, the Northern Mariana Islands and the Virgin Islands take no "County"
  suffix (TDR's `NO_SUFFIX` had AK, DC, PR only; TDR lists no territory hospital, so the TDR check can't move).
- **Universe** is one function, `master.universe`, shared by the build and the geocoder's gap.
- **Stricter readers than TDR:** a `*` header pattern must match exactly one column (two year-stamped columns raise);
  ZCTA and point coordinates must be finite and in range; CMS text that isn't valid Windows-1252 raises SchemaError.
- **Order:** geo.py/location.py were ported with TDR's tests rather than test-first; the property test was checked by
  a mutation (STRAY_KM 40 → 10 fails it).
- **Checkpoints:** M1 `/simplify` (4 angles) and `/code-review` (an independent replay of the port on the pins: 0
  differences from TDR on all 2,912) ran; its two Minors were fixed.
- **Known Minor items (not fixed):**
  - Encoding and zip member live as constants in `emit_hospital.py`, not in the manifest (a manifest-driven
    `pinned_text(pin_id)` would put them with the pin).
  - `atlas_fips` scans every atlas county per call (ported; under a second per build).
  - us-atlas's ISC notice in NOTICE names the author without the copyright years; check against the package's
    LICENSE before the repo goes public.
  - The two hospitals with no location have no ZCTA for their ZIP; a county-name-only fallback (`city_stem` for
    "X CITY") would place one, but TDR doesn't, so it waits for the fold-in.
