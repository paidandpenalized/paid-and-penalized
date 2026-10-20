# P2a part 3 (session 1 of 2): the hospital master, Python side of the contract, CI Python job

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A CCN-keyed hospital master (`data/emitted/hospital/fy2027/hospital_master.json`) built in stdlib Python from
pinned CMS files. It covers every Care Compare hospital plus every CCN in the impact, HACRP and HRRP files, and gives
each program an `inProgram` flag and a reason code. It's validated by a Python twin of the JSON Schema subset
validator, golden-checked, covered by the change gate, compared to Thirty Day Readmissions' names, and tested in a
new CI Python job.

**Architecture:** `engine/py/pp_engine/` holds pure Python modules (validator, contract helpers, parsers over text, name
casing, the master build). `pipeline/py/pp_pipeline/` holds file I/O and the CLIs. One launcher,
`python3 -I pipeline/py/run.py <command>`, puts both on `sys.path` (isolated mode keeps the working directory off it),
so no install step is needed. The master is emitted data under the existing layout, so the JS contract test, golden
convention and change gate apply unchanged.

**Tech Stack:** Python 3.9-compatible stdlib only (local 3.9.6; CI 3.12.15 via `actions/setup-python` v7.0.0
`5fda3b95a4ea91299a34e894583c3862153e4b97`). `unittest` with seeded `random.Random` for property tests. Node side
unchanged except tests and workflow.

**Spec:** the project's architecture decisions (private planning repo), restated under Global Constraints. Session 2
(geography: Census geocoding of the gap, lat/lon, county labels, CBSA, region) is out of scope here and becomes the
master's `methods_version` 2.

## Decisions taken for this plan (2026-10-20)

- POS (30 MB, over the in-git limit): a script-derived extract is committed and pinned. The raw file's SHA-256 and URL
  are in the manifest, plus the copy already archived in TDR's public `fy2027-raw-inputs` Release. The raw file is
  never committed.
- Impact file: FY2027 final rule + correction notice (the pinned zip; the correction-notice text member is read).
- Master `fy`: the impact file's fiscal year (2027), read from its `FY <year> Wage Index` header.
- Universe: HGI ∪ impact ∪ HACRP ∪ HRRP CCNs (5,449 today).
- Path: `data/emitted/hospital/fy2027/hospital_master.json`, schema `hospital.schema.json` (the ARCH-08 name). This
  amends ARCH-04's wording `data/hospital_master.json`, so the gate and contract tests apply with no special case.
- Geocodes: TDR codes + a Census Geocoder batch call for the gap + ZIP-centroid fallback, all in session 2.
- Python: 3.9-compatible code; CI pins Python 3.12.15 through setup-python by SHA. The runner downloads Python only if
  its tool cache lacks 3.12.15.
- `pyproject.toml` (ARCH-02) declares `pp_engine` with no dependencies. Repo commands don't install it: an editable
  install would download setuptools in CI. `pip install -e .` stays optional for local use.

## Global Constraints

- No third-party Python packages; no network in tests or builds. Name any install or download to Dalton before running it.
- Python syntax and stdlib calls available in 3.9: no `match`, no `X | Y` in runtime annotations, no `zip(strict=)`.
- `pp_engine` modules are pure: no file, network or clock access. `hashlib` and `json` are fine.
- CCN is 6-character text everywhere (`^[0-9A-Z]{6}$`); never parsed as a number.
- Every number and code in the master comes from a pinned file; nothing typed per hospital.
- Test fixtures use synthetic CCNs (`000001`, `00001F`, `990001`…) and invented names; no real hospital is named.
- Envelope: `schema_version`, `methods_version`, `source_manifest`, `sources`, `built_at`, `fy`, as in
  `common.schema.json`. `source_manifest` must equal `pipeline/contract.js`'s hash (the shared vectors).
- Canonical JSON: `json.dumps(v, sort_keys=True, ensure_ascii=False, separators=(',', ':'))`, hashed as UTF-8.
- The validator supports exactly the JS keyword set and throws `ValueError` on any other, before validating.
- Emitted file layout matches `formatEmitted` (one top-level key per line; one element of a top-level array per line;
  trailing newline). A rebuild that changes nothing keeps `built_at`.
- Commits: repo-local noreply identity; messages end with the Co-Authored-By and Claude-Session lines.

## Review Focus

1. **Python's types aren't JSON's types.** `True` passes `isinstance(x, int)` and equals `1`; `json.loads('1.0')` is a
   float. A validator that trusts `isinstance` accepts `true` as an integer and rejects `1.0`, so the Python and JS
   validators disagree. → Task 1 conformance suites `schema-version.cases.json` and the `enum`/`const` unit tests.
2. **`re` isn't JS `u`-mode regex.** Python's `\d` matches Arabic-Indic digits, and `re.match` anchors where JS
   `test` doesn't. → Task 1 conformance suite `built-at.cases.json` (non-ASCII digits invalid) and the unanchored-
   pattern unit test.
3. **A CCN loses its leading zeros or letter in a join** (e.g., a CSV cell cast to int). → Task 4 property test
   `test_ccns_survive_as_text`.
4. **A listed hospital gets a not-in-program reason** because a type or state rule fires first. → Task 4 property test
   `test_listed_always_wins`.
5. **The committed POS extract drifts from the raw file** (edited by hand or built by an older script). → Task 2:
   `test_extract_shape` in CI, plus `test_extract_rederives_from_raw` when `PP_RAW_POS` is set (run locally in this
   session).

---

## File map

| Path | Responsibility |
|---|---|
| `pyproject.toml` | `pp_engine` metadata; `requires-python = ">=3.9"`; no dependencies |
| `pipeline/py/run.py` | Launcher: `test`, `emit`, `extract-pos <raw>` |
| `engine/py/pp_engine/schema.py` | `validate(schema, data, schemas=None) -> list[str]` (twin of `engine/js/schema.js`) |
| `engine/py/pp_engine/contract.py` | `canonical_json`, `source_manifest_hash`, `envelope`, `keep_built_at`, `format_emitted` |
| `engine/py/pp_engine/parse.py` | TDR's table reader, `num`/`squash`/`zip5`, `read_hgi`, `read_impact`, `read_pos`, `impact_fy` |
| `engine/py/pp_engine/names.py` | TDR's `smart_title`, `display_name`, `alias` (ported unchanged) |
| `engine/py/pp_engine/master.py` | `kind_of`, `reason_for`, `build_record`, `build_master` |
| `engine/py/tests/` | Unit, conformance, property tests for the above |
| `pipeline/py/pp_pipeline/files.py` | `REPO_ROOT`, `read_manifest`, `read_pinned_bytes` (verifies SHA-256), `read_zip_member`, `load_schemas` |
| `pipeline/py/pp_pipeline/pos_extract.py` | Raw POS → extract (pure function + CLI wrapper) |
| `pipeline/py/pp_pipeline/emit_hospital.py` | Reads pins, builds, validates, keeps `built_at`, writes |
| `pipeline/py/tests/` | Golden, emitted-file, TDR-names, extract tests |
| `schemas/hospital.schema.json` · `schemas/conformance/hospital.cases.json` | The master's contract and its cases |
| `schemas/conformance/{schema-version,built-at}.cases.json` | Type and regex parity cases (both languages) |
| `data/pinned/{hgi-2026-07,ipps-impact-fy2027,pos-q2-2026}/…` + manifest entries | New pins |
| `data/emitted/hospital/fy2027/hospital_master.json` | The master (golden snapshot) |
| `.github/workflows/ci.yml` · `tools/test/workflow.test.js` | `python` job; its rules |
| `Makefile` · `README.md` · `CLAUDE.md` · `NOTICE` · `docs/METHODS-LOG.md` | Commands and docs |

---

### Task 1: Python foundation: launcher, validator, contract helpers, CI job

**Files:** Create `pyproject.toml`, `pipeline/py/run.py`, `engine/py/pp_engine/{__init__,schema,contract}.py`,
`engine/py/tests/{__init__,test_schema,test_contract}.py`, `pipeline/py/pp_pipeline/{__init__,files}.py`,
`schemas/conformance/{schema-version,built-at}.cases.json`; modify `.github/workflows/ci.yml`,
`tools/test/workflow.test.js`, `Makefile`.

**Interfaces (produces):**
- `run.py test` discovers `engine/py/tests` and `pipeline/py/tests` (`test_*.py`), exit 1 on failure. `run.py emit`
  and `run.py extract-pos` dispatch to later tasks' `main()`.
- `schema.validate(schema, data, schemas=None) -> list[str]`: messages `"<json-pointer>: <problem>"`, same wording as
  the JS twin. JSON type of a value: `None`→null, `bool`→boolean (checked before int), `int`/`float`→number
  (non-finite → "non-finite number"), `str`, `list`→array, `dict`→object. `integer` = number with
  `float(v).is_integer()`. Equality for `enum`/`const` is type-aware (`True != 1`, `1 == 1.0`). `pattern` uses
  `re.search(p, s, re.ASCII)`. `minLength` counts code points.
- `contract.canonical_json(v) -> str`, `source_manifest_hash(entries) -> str` (keeps `id`/`sha256`, sorts by `id`),
  `envelope(schema_version, methods_version, sources, manifest, built_at, fy) -> dict` (raises `KeyError` naming an
  unknown source), `keep_built_at(previous, nxt) -> dict`, `format_emitted(obj) -> str`.
- `files.REPO_ROOT: Path`, `read_manifest() -> list`, `read_pinned_bytes(id) -> bytes` (raises if size or SHA-256
  differ from the manifest), `read_zip_member(id, member) -> bytes`, `load_schemas() -> dict`, `read_json(path)`.

- [ ] **1.1 Failing tests.** `test_schema.py`:
  - each supported keyword, valid and invalid, on small synthetic schemas, with the JS test's pointer wording
    (`/hospitals/3/ccn: does not match ^[0-9A-Z]{6}$`);
  - `test_unsupported_keyword_raises` (`format`, `oneOf`, `patternProperties`, nested under `properties`);
  - `test_bool_is_not_integer`, `test_float_integral_is_integer` (`1.0` passes `integer`), `test_enum_type_aware`
    (`enum: [1]` rejects `True`; `const: false` rejects `0`), `test_nan_and_inf_fail_number`;
  - `test_pattern_is_unanchored_search` (`pattern: "b"` accepts `"abc"`);
  - `test_cross_file_ref` and `test_ref_depth_limit`;
  - conformance runner over every `schemas/conformance/*.cases.json` with a Python `apply_patch` that has the JS
    semantics (`set`/`create`/`delete`; arrays take `set`/`delete`; anything else raises), plus its own unit tests
    mirroring `schema.test.js`'s patch tests.
  New suites (run by both languages): `schema-version.cases.json` (`def: schemaVersion`): `1` valid, `1.0` valid,
  `true` invalid, `"1"` invalid, `0` invalid. `built-at.cases.json` (`def: builtAt`): `"2026-10-20T00:00:00Z"` valid,
  `"٢٠٢٦-10-20T00:00:00Z"` invalid, `"2026-10-20T00:00:00.000Z"` invalid.
  `test_contract.py`: every vector in `source-manifest.vectors.json` (canonical string and hash);
  `canonical_json` is key-order independent, array-order sensitive; `envelope` with an unknown source raises;
  `keep_built_at` keeps for equal content and takes the new one otherwise; `format_emitted` round-trips and puts each
  top-level array element on its own line.
- [ ] **1.2** `python3 -I pipeline/py/run.py test` → FAIL (modules missing). `npm test` → the new suites pass in JS
  (if a JS case fails, the case is wrong or JS has a bug: stop and look).
- [ ] **1.3** Implement → `run.py test` PASS.
- [ ] **1.4 CI.** `workflow.test.js` first: `test('the python job pins setup-python to an exact version and runs
  isolated', …)` asserts a `uses: actions/setup-python@<40-hex> # v7.0.0` line, `python-version: '3.12.15'`, and a
  `run: python -I pipeline/py/run.py test` line. Then add job `python` (ubuntu-24.04, timeout 10 min; checkout by SHA
  with `persist-credentials: false`; setup-python; run). `Makefile`: `test` runs `npm test` then
  `python3 -I pipeline/py/run.py test`. `npm test` PASS.
- [ ] **1.5** Commit: `Python side of the data contract: JSON Schema subset validator, envelope helpers, shared
  conformance cases; CI Python job`.

### ☐ Checkpoint M1 (after Task 1)
- [ ] `/simplify` on the diff since this plan's commit → both test suites.
- [ ] `/code-review` on the result. Fix Critical/Important; list Minors under § Amendments.

### Task 2: Pins: HGI, impact file, POS extract

**Files:** Create `data/pinned/hgi-2026-07/Hospital_General_Information.csv`,
`data/pinned/ipps-impact-fy2027/fy2027-ipps-fr-impact-file.zip`, `data/pinned/pos-q2-2026/pos_hospitals.csv`,
`pipeline/py/pp_pipeline/pos_extract.py`, `pipeline/py/tests/test_pos_extract.py`; modify
`data/pinned/manifest.json`, `NOTICE`.

**Interfaces:**
- `pos_extract.COLUMNS = ("PRVDR_NUM", "PRVDR_CTGRY_SBTYP_CD", "FAC_NAME", "ST_ADR", "CITY_NAME", "STATE_CD", "ZIP_CD",
  "CRTFD_BED_CNT", "PGM_TRMNTN_CD", "TRMNTN_EXPRTN_DT")`.
- `extract(raw_text: str) -> str`: rows with `PRVDR_CTGRY_CD == "01"` (hospitals), these columns in this order,
  sorted by `PRVDR_NUM`, cells stripped, `csv` QUOTE_MINIMAL, `\n` line ends. Raises on a missing column or a duplicate
  `PRVDR_NUM`. The raw file is read as latin-1, as TDR does; the extract is UTF-8.
- `main(raw_path)`: checks the raw file's size and SHA-256 against the manifest entry's `derivedFrom`, writes the
  extract, and prints its bytes and SHA-256.
- Manifest entries (ids): `hgi-2026-07` (PDC `xubh-q36u`, modified 2026-07-22), `ipps-impact-fy2027`,
  `pos-q2-2026` with `derivedFrom: { file, bytes, sha256, downloadUrl, archiveUrl }` and
  `derivedBy: "pipeline/py/pp_pipeline/pos_extract.py"`. URLs and SHA-256s are the ones in TDR's
  `pipeline/sources.json`; the archive is the matching asset in TDR's `fy2027-raw-inputs` Release.

- [ ] **2.1 Failing tests** (`test_pos_extract.py`, synthetic raw text): only category `01` kept; output columns and
  order exact; sorted; a CCN `00001F` stays text; a missing column raises; a duplicate CCN raises;
  `test_extract_shape` on the committed extract (header equals `COLUMNS`; CCNs unique, sorted, all
  `^[0-9A-Z]{6}$`); `test_extract_rederives_from_raw` (skipped unless `PP_RAW_POS` is set).
- [ ] **2.2** Run → FAIL. **2.3** Implement.
- [ ] **2.4** Copy HGI and the impact zip from TDR's local `data/raw/` (no download), verify each SHA-256 against TDR's
  `sources.json` (**a mismatch → stop and ask Dalton**), add manifest entries. Run
  `python3 -I pipeline/py/run.py extract-pos <TDR raw POS path>`, add its entry.
  `PP_RAW_POS=<path> python3 -I pipeline/py/run.py test` → PASS including the re-derivation; `npm test` PASS
  (the pinned-file test now covers the three files).
- [ ] **2.5** `NOTICE`: the POS extract is a column and row subset of the CMS file, derived by the named script.
- [ ] **2.6** Commit: `Pin Hospital General Information, the FY2027 IPPS impact file, and a POS hospital extract`.

### Task 3: Parsers and names, ported from TDR

**Files:** Create `engine/py/pp_engine/{parse,names}.py`, `engine/py/tests/{test_parse,test_names}.py`.

**Interfaces:**
- `parse.SchemaError(Exception)`; `num`, `squash`, `zip5` as in TDR; `table(rows, anchor, columns, label) -> list[dict]`
  (TDR's `_table`); `index_by_ccn(records, build, label) -> dict` (TDR's `_index_by_ccn`).
- `read_hgi(text) -> {ccn: {name, street, city, state, zip, type, ownership}}` (UTF-8 with BOM; columns
  `Facility ID`, `Facility Name`, `Address`, `City/Town`, `State`, `ZIP Code`, `Hospital Type`, `Hospital Ownership`).
- `impact_fy(text) -> int` from the single `FY <yyyy> Wage Index` header (raises unless exactly one).
- `read_impact(text) -> {ccn: {name, urgeo, irb, beds, own, ptype, mdh}}` (tab-delimited; columns as TDR's
  `read_impact` minus wage, case-mix and payment fields).
- `read_pos(text) -> {ccn: {name, street, city, state, zip, beds, term, termDate}}` over the extract; unknown
  termination code or malformed date raises (TDR's `POS_TERMINATION` table, unchanged).
- `names.smart_title`, `names.display_name`, `names.alias`: TDR's code, unchanged.

- [ ] **3.1 Failing tests**, all synthetic: header found by first cell, not line number; a missing column raises
  naming it; footnote rows skipped; a 5-digit numeric CCN raises; duplicate CCN raises; `num` on `'"1,110"'`, `'.'`,
  `'Too few to report'`; `zip5('2124')` → `'02124'`; `impact_fy` with zero or two matching headers raises.
  `test_names.py`: TDR's casing rules on invented names (`"ST MARY OF THE PLAINS MDL CTR"`,
  `"MC DONOUGH VALLEY HOSPITAL"`, `"O'BRIEN HLTH SVCS"`, a mixed-case name kept as-is); `alias` returns `None` when
  the names share most distinctive words and the title-cased impact name when they don't.
- [ ] **3.2** Run → FAIL. **3.3** Port → PASS.
- [ ] **3.4** Commit: `Port TDR's CMS table parsers and hospital-name casing to pp_engine`.

### Task 4: Master build, schema, reason codes

**Files:** Create `engine/py/pp_engine/master.py`, `engine/py/tests/test_master.py`, `schemas/hospital.schema.json`,
`schemas/conformance/hospital.cases.json`.

**Interfaces:**
- `KINDS` (HGI `Hospital Type` → kind): `Acute Care Hospitals`→`acute`, `Critical Access Hospitals`→`critical_access`,
  `Psychiatric`→`psychiatric`, `Childrens`→`childrens`, `Long-term`→`long_term`, `Rural Emergency Hospital`→
  `rural_emergency`, `Acute Care - Veterans Administration`→`va`, `Acute Care - Department of Defense`→`dod`.
  `kind_of(hgi_row, in_impact) -> str`: the mapped kind; an unmapped type raises `SchemaError`; no HGI row → `acute` if
  in the impact file, else `unknown`.
- `REASONS = ("critical_access", "psychiatric", "childrens", "long_term", "rural_emergency", "federal", "maryland",
  "inactive", "not_listed")`. `reason_for(listed, kind, state, inactive) -> str | None`, first match wins:
  1. listed → `None`;
  2. kind in the not-paid-under-IPPS kinds → that kind (`va` and `dod` → `federal`);
  3. state `MD` → `maryland`;
  4. inactive in POS (termination codes 01–07) → `inactive`;
  5. otherwise `not_listed` ("CMS's file doesn't list it and doesn't say why").
- `build_record(ccn, hgi, impact, pos, listed: dict[str, bool]) -> dict` with keys, in order: `ccn`, `name`, `alias`,
  `street`, `city`, `state`, `zip`, `kind`, `ipps`, `types`, `teach`, `urban`, `beds`, `bedsSource`, `own`,
  `ownDetail`, `inactive`, `programs`. Rules (TDR's, ported):
  - name: `display_name(hgi name, impact name)`, else `smart_title(POS name)`; none → `SchemaError`. `alias`:
    `names.alias(name, impact name)` or `None`.
  - address: HGI's, else POS's (`city` through `smart_title`; empty → `None`); `state` falls back to POS.
  - `ipps`: in the impact file. Only IPPS hospitals have `types` (TDR's `PTYPES` + `MDH` flag, sorted), `teach`
    (`none`/`minor`/`major` from the resident-to-bed ratio, 0.25 cut) and `urban` (`LURBAN`/`OURBAN`); others get
    `[]`, `None`, `None`.
  - `beds`/`bedsSource`: POS certified beds (`pos`) else impact beds (`cr`) else `None`/`None`.
  - `own`: TDR's `ownership(HGI ownership, impact code)`; `ownDetail`: HGI's text or `None`.
  - `inactive`: `{date, reason}` for POS codes 01–07, else `None`.
  - `programs`: `{hacrp: {inProgram, reason}, hrrp: {inProgram, reason}}`, `reason` from `reason_for`.
- `build_master(hgi, impact, pos, programs: {id: {"fy": int, "ccns": set}}, fy, manifest, sources, built_at) -> dict`:
  envelope + `programYears: {id: fy}` + `hospitals` (one per CCN in HGI ∪ impact ∪ every program's CCNs, sorted).
  `METHODS_VERSION = 1`, `SCHEMA_VERSION = 1`.
- `hospital.schema.json`: envelope by `$ref`; `schema_version` const 1; every record field typed and nullable where
  the rules allow; `kind` and `reason` enums; `programs` requires `hacrp` and `hrrp`; `additionalProperties: false`
  at every level.

- [ ] **4.1 Failing tests** (`test_master.py`; seeded `random.Random(20261020)`; synthetic CCNs):
  - `test_universe_is_the_union`: 500 random trials over random overlapping CCN sets → master CCNs equal
    HGI ∪ impact ∪ programs, sorted, unique; a POS-only CCN is not added.
  - `test_ccns_survive_as_text`: CCNs like `000001`, `00001F`, `120345` come out byte-identical.
  - `test_listed_always_wins`: for every combination of kind × state ∈ {`MD`, `VA`, `None`} × inactive, listed →
    `inProgram` true and `reason` None.
  - `test_reason_precedence`: table-driven oracle over all combinations (written independently in the test), equal
    to `reason_for`; `inProgram` is true exactly when `reason` is None.
  - `test_kind_of`: each HGI type; unknown type raises; no HGI → `acute`/`unknown`.
  - `test_name_fallbacks`: HGI → impact → POS; none raises.
  - `test_beds_source`, `test_non_ipps_has_no_ipps_attributes`, `test_inactive_codes`.
  - `test_record_validates`: random synthetic records validate against `hospital.schema.json` with `pp_engine.schema`.
  - Conformance `hospital.cases.json` (base = a minimal valid file with one synthetic hospital): invalid with a numeric
    CCN, an unknown `kind`, an unknown `reason`, a missing `hrrp`, an extra record key, `beds: "12"`.
- [ ] **4.2** Run → FAIL. **4.3** Implement → PASS; `npm test` PASS (JS runs the new cases too).
- [ ] **4.4** Commit: `Hospital master build: universe, attributes, per-program flags with reason codes; schema`.

### ☐ Checkpoint M2 (after Task 4)
- [ ] `/simplify` on the diff since M1 → both suites.
- [ ] `/code-review`. Fix Critical/Important; list Minors under § Amendments.

### Task 5: Emit, golden, TDR name check, docs, push

**Files:** Create `pipeline/py/pp_pipeline/emit_hospital.py`, `pipeline/py/tests/{test_hospital_golden,test_tdr_names}.py`,
`data/emitted/hospital/fy2027/hospital_master.json`; modify `docs/METHODS-LOG.md`, `Makefile` (`emit` runs both
emitters), `README.md`, `CLAUDE.md`.

**Interfaces:**
- `emit_hospital.SOURCES = ("hgi-2026-07", "ipps-impact-fy2027", "pos-q2-2026", "yq43-i98g", "tdr-hrrp-fy2027")`.
  HACRP CCNs and fy come from the pinned CSV (`Facility ID`, the single `Fiscal Year`); HRRP's from the pinned TDR
  file (`hospitals[].id`, `meta.fy`). The impact text is the zip member
  `FY 2027 IPPS Impact File - Correction Notice.txt` (latin-1), the file TDR builds from.
- `build_from_pins(built_at) -> dict`; `emitted_path(fy) -> Path`; `main()`: build with the current UTC second,
  `keep_built_at` against the committed file, validate (raise on errors), write with `format_emitted`.
- METHODS-LOG: `## hospital methods_version 1 (2026-10-20)`: what the file holds, the universe, the reason codes and
  their order, and that location fields arrive in version 2.

- [ ] **5.1 Failing tests.**
  - `test_hospital_golden.py`: `keep_built_at(committed, build_from_pins("2099-01-01T00:00:00Z")) == committed`;
    the committed file validates; `source_manifest` equals the recomputed hash; `fy` equals the impact file's;
    a second `emit` leaves the file byte-identical.
  - `test_tdr_names.py` (ARCH-04's CI check): every CCN in the pinned TDR file is in the master with
    `programs.hrrp.inProgram` true; no other hospital has it true; for each, master `name` and `alias` equal TDR's
    (`alias` absent in TDR = `None`). Failures list up to 20 CCNs with both values.
  - The existing JS `emitted-contract.test.js` picks the file up as site `hospital` (schema, fy folder, methods-log
    heading).
- [ ] **5.2** `run.py emit` → file written. Both suites PASS; `make emit` twice → `git status` clean after the first.
- [ ] **5.3** Docs: `README.md` (Python commands, the `PP_RAW_POS` check); `CLAUDE.md` (layout: `engine/py`,
  `pipeline/py`, the launcher, Python 3.9 floor, the master and its reason codes).
- [ ] **5.4** Commit: `Hospital master FY2027 emitted with golden check and TDR name check`. Push; watch CI
  (`gh run watch`): `test`, `secrets`, `python` green. The change gate passes as a first emission.

### ☐ Final gate (full diff since this plan's commit)
- [ ] `/simplify` → both suites.
- [ ] `/code-review` + `/security-review` (the validator and parsers read external files; CI workflow change) +
  `/verify`: clean clone → `make test`; `make emit` leaves git clean; a hand-edited name in the emitted file fails the
  golden check and the TDR check; a hand-edited extract fails `test_extract_rederives_from_raw`.
- [ ] Fix Critical/Important; list Minors below. Push.

### Task 6: Planning-repo close-out (private repo)
- [ ] INDEX: ARCH-04 amended (path and universe), ARCH-08 noted (Python validator built), ARCH-25 noted (Python job);
  Done list; Now rewrite with session 2's handoff; `.project-status`; hours from Dalton.

---

## Amendments made during execution

(none yet)
