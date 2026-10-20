# P2a part 2: data contract, HACRP emitted data, golden snapshot, CI skeleton, commit hygiene

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every emitted data file has a strict, tested contract; the HACRP FY2026 data is emitted, committed and guarded by a golden check; CI runs the offline checks on every push and PR; local hooks keep secrets, private names and oversize files out of commits.

**Architecture:** Zero-dependency Node (ES modules, `node:test`). A small JSON Schema validator in `engine/js/schema.js` checks emitted files against `schemas/*.schema.json`; a shared corpus of valid/invalid cases in `schemas/conformance/` will also drive the Python validator that arrives with the hospital master (next session). The HACRP emitter in `sites/hacrp/pipeline/` turns the pinned CMS file into `data/emitted/hacrp/fy2026/hacrp.json` using the existing engine. The committed emitted file *is* the golden snapshot: a test rebuilds it from the pins and must match.

**Tech Stack:** Node ≥ 22 (local 26.0.0; CI 24.21.0), `node:test`, `node:crypto`, `node:child_process` (hooks and CI scripts only). gitleaks 8.30.1 (Homebrew locally; verified release tarball in CI). GitHub Actions pinned by commit SHA: `actions/checkout` v7.0.1 `3d3c42e5aac5ba805825da76410c181273ba90b1`, `actions/setup-node` v7.0.0 `820762786026740c76f36085b0efc47a31fe5020`.

**Spec:** the project's architecture decisions (private planning repo). The rules this plan needs are restated under Global Constraints.

**Out of scope (next session):** the hospital master (`data/hospital_master.json`, stdlib Python per the tooling decision), `schemas/hospital.schema.json`, the Python validator over the same corpus, the CI check comparing TDR's hospital names to the master by CCN, and the CI Python job. Page-dependent CI (build, size budget, axe, link check, Playwright) waits for the first page.

## Global Constraints

- Zero npm dependencies. Anything installed or downloaded is named to Dalton first.
- Engine modules stay pure (no `fs`, network, DOM or clock). File I/O, `git` and the clock live in `sites/*/pipeline/` CLIs, `tools/`, and tests.
- `engine/js/*.js` at the top level never name a program.
- **Contract (every emitted file):** `schema_version` (integer, per schema), `methods_version` (integer ≥ 1, per site), `source_manifest` (SHA-256 hex of the manifest entries used), `sources` (their ids), `built_at` (UTC ISO-8601, `YYYY-MM-DDTHH:MM:SSZ`), `fy` (integer). CCN is 6-character text, `^[0-9A-Z]{6}$`. Strict: `additionalProperties: false` everywhere.
- `fy` comes from the data (the CSV's `Fiscal Year`), never typed.
- `source_manifest` = SHA-256 of `canonicalJson(entries)`, where entries are the manifest entries named in `sources`, sorted by `id`, and `canonicalJson` sorts object keys recursively.
- **Golden:** the committed emitted file must equal a fresh rebuild from the pins, ignoring `built_at`. The emitter keeps the committed `built_at` when nothing else changed, so a no-op rebuild leaves git clean.
- **Change gate:** a change under `data/emitted/` needs, in the same PR or push, a reason on record (final form in § Amendments: a re-pin, a methods_version bump, or a corrections entry). A `methods_version` must have a matching heading in `docs/METHODS-LOG.md`.
- Pinned inputs under 10 MB live in `data/pinned/` with a manifest entry; the hook blocks any staged file ≥ 10 MiB (10 × 1024 × 1024 bytes).
- TDR's `hrrp.json` is pinned byte-for-byte from TDR's public repo at commit `80f3659d1f6c850443bbc7d939f5f1dc9cd8153b` (2,604,301 bytes, SHA-256 `9541a509cda7f365504181b639fc314972ebe75aad181811e36c87323554f3c1`), read with `git show` from the local clone (no download).
- **Actions:** every `uses:` pinned to a 40-hex SHA with a version comment; top-level `permissions: contents: read`; no `pull_request_target`; checkout with `persist-credentials: false`; PR labels reach scripts only through `env`, never interpolated into `run:`.
- **Blocklist:** private names and strings live only in an untracked file outside the repo, `$PP_BLOCKLIST` or `~/.config/paid-and-penalized/blocklist.txt`. The hook refuses a list inside the repo and fails closed if the list is missing or empty. No real blocklisted string appears in code, tests, docs or output; tests use invented names. Hits report the file, line and entry number, not the entry.
- Test fixtures name no hospital.
- Commits use the repo-local noreply identity.

## Review Focus

1. **A no-op rebuild changes `built_at`, so every run dirties git and trips the change gate.** → Task 4 test `rebuilding with the same inputs keeps built_at`.
2. **A blocklisted name split across a line break or with odd case or spacing slips through; or a surname inside a CMS hospital name blocks a legitimate commit.** → Task 1 tests `matches across whitespace and line breaks, any case` and `no hit inside a longer word`; Step 1.6 runs the real list over the whole tree.
3. **The validator silently accepts a schema keyword it doesn't implement** (e.g., `format`, `oneOf`), so a schema looks strict but isn't. → Task 2 test `unsupported keyword throws`.
4. **The emitted file loses CMS's exact values** (float re-serialization, text dropped), so pages built from it drift from CMS. → Task 4 test `the emitted file reproduces CMS for every row`.
5. **A PR label name containing shell metacharacters reaches a `run:` line.** → Task 5 test `workflow passes labels through env only`.

---

## File map

| Path | Responsibility |
|---|---|
| `.githooks/pre-commit` · `.githooks/commit-msg` | Thin `sh` wrappers that call the Node hygiene CLIs |
| `tools/hygiene/blocklist.js` | Pure: parse a blocklist; find hits in text |
| `tools/hygiene/precommit.js` | CLI: staged files → size limit, blocklist scan, `gitleaks git --staged` |
| `tools/hygiene/commit-msg.js` | CLI: blocklist scan of the commit message |
| `engine/js/schema.js` | Pure JSON Schema subset validator |
| `engine/js/contract.js` | Pure: `canonicalJson`, `sourceManifestHash`, `keepBuiltAt`, `formatEmitted` |
| `schemas/common.schema.json` · `schemas/hacrp.schema.json` | Envelope + CCN defs · the HACRP emitted file |
| `schemas/conformance/*.cases.json` | Shared valid/invalid cases (JS now, Python next session) |
| `data/pinned/tdr/hrrp.json` + manifest entry | TDR's published data, pinned |
| `sites/hacrp/pipeline/build.js` | Pure: pinned rows + manifest entries → emitted object |
| `sites/hacrp/pipeline/emit.js` | CLI: read pins, build, keep `built_at`, write the file |
| `data/emitted/hacrp/fy2026/hacrp.json` | Committed emitted data = the golden snapshot |
| `docs/METHODS-LOG.md` | One heading per site methods version |
| `tools/ci/change-gate.js` | Pure gate + CLI over `git diff` and the `PR_LABELS` env |
| `.github/workflows/ci.yml` | Tests, golden, change gate, gitleaks |
| `package.json` · `Makefile` · `README.md` · `CLAUDE.md` · `NOTICE` | Test globs; `make hooks`, `make emit`; docs |

Test locations: `tools/test/`, `engine/js/test/`, `sites/hacrp/test/`. `npm test` runs `node --test "engine/js/test/**/*.test.js" "sites/*/test/**/*.test.js" "tools/test/**/*.test.js"`.

---

### Task 1: Commit hygiene hooks (first, so later commits are scanned)

**Files:** Create `tools/hygiene/{blocklist,precommit,commit-msg}.js`, `.githooks/{pre-commit,commit-msg}`, `tools/test/blocklist.test.js`, `tools/test/precommit.test.js`; modify `package.json`, `Makefile` (`hooks:` → `git config core.hooksPath .githooks`).

**Interfaces:**
- `parseBlocklist(text) → string[]`: one entry per line; trims; skips blank lines and `#` comments; throws if no entries remain.
- `findHits(text, entries) → Array<{ entry: number, line: number }>`: `entry` is the 1-based list index; `line` is 1-based where the match starts. Each entry is matched literally (regex specials escaped), case-insensitively with Unicode case folding (`iu`), with any run of whitespace in the entry matching `\s+` (line breaks included), and only on a boundary: not preceded or followed by a letter or digit (`(?<![\p{L}\p{N}])…(?![\p{L}\p{N}])`).
- `blocklistPath(env, home) → string`; `assertOutsideRepo(listPath, repoRoot)` throws when the resolved list lies inside the repo.
- `checkStaged({ files: Array<{ path, bytes: Buffer }>, entries, maxBytes }) → string[]` (problem messages; empty = OK). Binary files (a NUL in the first 8,000 bytes) skip the text scan but not the size check.
- `precommit.js` CLI: list staged files with `git diff --cached --name-only --diff-filter=ACMR -z`, read each with `git show :<path>`, run `checkStaged`, then `gitleaks git --staged --redact --no-banner`. Exit 1 with messages on any problem; exit 1 with install instructions if gitleaks isn't on PATH.
- `commit-msg.js <file>`: `findHits` on the message; exit 1 on a hit.

- [ ] **Step 1.1: Failing tests** (`blocklist.test.js`, synthetic entries such as `Jane Placeholder`, `j.q@example.test`):
  - `parses entries, skipping blanks and comments`; `an empty list throws`.
  - `matches across whitespace and line breaks, any case`: `"jane\n  PLACEHOLDER"` hits entry 1 at line 1.
  - `no hit inside a longer word`: `"Janet Placeholderson"` → none; `"Jane Placeholder's"` → hit.
  - `entries are literal`: entry `a.b` doesn't hit `axb`.
  - `reports the line where the match starts`.
  - Property (seeded PRNG, 2,000 trials): insert a random entry, with random case per letter and 1–3 random whitespace characters per space, between random words → always one hit with that entry's index.
  - `precommit.test.js`: `checkStaged` reports a file of exactly 10 MiB and passes one of 10 MiB − 1; a binary file with a hit is skipped for text but still size-checked; `assertOutsideRepo` throws for a path inside the repo root and for one reached through `..`.
- [ ] **Step 1.2:** `npm test` → FAIL (modules missing).
- [ ] **Step 1.3:** Implement. `npm test` → PASS.
- [ ] **Step 1.4:** Hooks: `.githooks/pre-commit` = `exec node tools/hygiene/precommit.js`; `.githooks/commit-msg` = `exec node tools/hygiene/commit-msg.js "$1"`; both `chmod +x`. `make hooks`.
- [ ] **Step 1.5 (local, untracked):** Claude writes `~/.config/paid-and-penalized/blocklist.txt` with the entries Dalton chose in the session (never echoed into the repo or the transcript summary).
- [ ] **Step 1.6:** Run the scan over every tracked file (`git ls-files -z` through `checkStaged`'s scan) with the real list. Expected: zero hits, including the pinned CMS files. A hit is a finding: fix the matching rule or tell Dalton; don't weaken the list.
- [ ] **Step 1.7:** Commit (the hook runs on this commit): `Commit hygiene: blocklist scan, 10 MB limit and gitleaks in pre-commit; commit-message scan`. This plan file goes in the same commit.

### Task 2: JSON Schema subset validator + shared conformance corpus

**Files:** Create `engine/js/schema.js`, `schemas/common.schema.json`, `schemas/conformance/common.cases.json`, `engine/js/test/schema.test.js`.

**Interfaces:**
- `validate(schema, data, { schemas = {} } = {}) → string[]`: error messages as `"<json-pointer>: <problem>"`; empty = valid. `schemas` maps `$id` → schema for cross-file `$ref`.
- Supported keywords only: `$schema`, `$id`, `$defs`, `$ref` (`#/$defs/x` and `<id>#/$defs/x`), `title`, `description`, `type` (string or array; `object` excludes arrays and null; `integer` = `Number.isInteger`), `properties`, `required`, `additionalProperties` (boolean or schema), `items`, `enum`, `const`, `pattern` (`u` flag), `minimum`, `maximum`, `minItems`, `minLength`. **Any other keyword throws `RangeError`** before validating.
- `common.schema.json` (`$id: "common.schema.json"`), `$defs`: `ccn` (`^[0-9A-Z]{6}$`), `sha256` (`^[0-9a-f]{64}$`), `builtAt` (`^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$`), `envelope` fields: `schemaVersion` (integer ≥ 1), `methodsVersion` (integer ≥ 1), `sources` (array of non-empty strings, minItems 1), `fy` (integer, 2013–2100).
- Corpus file format: `{ "schema": "<$id>", "def": "<$defs name or null>", "cases": [{ "name", "valid": boolean, "data" }] }`. The test validates every case in every `schemas/conformance/*.cases.json` against `schemas/<schema>` (or its `$defs/<def>`).

- [ ] **Step 2.1: Failing tests:** each keyword, valid and invalid, on synthetic schemas; `unsupported keyword throws` (`format`, `oneOf`, `patternProperties`); `$ref` across files; error pointers name the failing path (`/hospitals/3/ccn`); CCN cases in the corpus (synthetic CCNs only): `"000001"` valid, `1` (number) invalid, `"00001"` invalid, `"00000a"` invalid; corpus runner over all case files.
- [ ] **Step 2.2:** Run → FAIL. **Step 2.3:** Implement → PASS.
- [ ] **Step 2.4:** Commit: `Data contract: JSON Schema subset validator, common envelope and CCN definitions, shared conformance cases`.

### Task 3: Pin TDR's hrrp.json

**Files:** Create `data/pinned/tdr/hrrp.json`; modify `data/pinned/manifest.json`, `NOTICE`; create `engine/js/test/tdr-pin.test.js`.

- [ ] **Step 3.1:** `git -C ../thirty-day-readmissions show 80f3659d1f6c850443bbc7d939f5f1dc9cd8153b:web/src/data/hrrp.json > data/pinned/tdr/hrrp.json`; `shasum -a 256` → `9541a509…f3c1`, 2,604,301 bytes. **Mismatch → stop and ask Dalton.**
- [ ] **Step 3.2:** Manifest entry: `{ "id": "tdr-hrrp-fy2027", "title": "Thirty Day Readmissions published data (HRRP FY2027)", "path": "tdr/hrrp.json", "bytes": 2604301, "sha256": "9541…", "downloadUrl": "https://raw.githubusercontent.com/daltonhaslam/thirty-day-readmissions/80f3659d1f6c850443bbc7d939f5f1dc9cd8153b/web/src/data/hrrp.json", "landingPage": "https://github.com/daltonhaslam/thirty-day-readmissions", "sourceCommit": "80f3659d1f6c850443bbc7d939f5f1dc9cd8153b", "retrieved": "2026-10-20" }`. The existing pinned test covers bytes + hash.
- [ ] **Step 3.3: Tests** (`tdr-pin.test.js`): parses; `meta.fy` is an integer; every `hospitals[].id` is a string matching the CCN def (validated with `validate` against `common.schema.json#/$defs/ccn`); ids are unique.
- [ ] **Step 3.4:** `NOTICE`: the TDR file is the project's own MIT-licensed derived data from CMS public files, re-pinned by hand at each TDR refresh.
- [ ] **Step 3.5:** Commit: `Pin TDR's published hrrp.json (commit 80f3659) as an external input`.

### Task 4: HACRP emitted data, golden snapshot, methods_version

**Files:** Create `engine/js/contract.js`, `schemas/hacrp.schema.json`, `schemas/conformance/hacrp.cases.json`, `sites/hacrp/pipeline/{build,emit}.js`, `docs/METHODS-LOG.md`, `data/emitted/hacrp/fy2026/hacrp.json`; tests `engine/js/test/contract.test.js`, `sites/hacrp/test/{emitted,golden}.test.js`; modify `Makefile` (`emit:` → `node sites/hacrp/pipeline/emit.js`).

**Interfaces:**
- `contract.js`: `canonicalJson(value) → string`; `sourceManifestHash(entries) → hex` (sorts by `id`); `keepBuiltAt(previous | null, next) → next` (returns `next` with `previous.built_at` when the two are equal except `built_at`); `formatEmitted(obj) → string`: top-level keys one per line, each element of a top-level array on its own line, trailing newline (reviewable git diffs).
- `build.js`: `METHODS_VERSION = 1`, `SCHEMA_VERSION = 1`; `buildHacrp({ rows, manifestEntries, builtAt }) → object` =
  `{ schema_version, methods_version, source_manifest, sources: ["yq43-i98g"], built_at, fy, model: { boundary, measures: { [id]: { ...params, estimate: { tagged, maxError } } } }, hospitals: Hospital[] }`. `fy` = `Number` of the rows' single `Fiscal Year` (throws if rows disagree). `hospitals` are `toHospital` records in file order. Emitted name/state are CMS's text for this file; canonical names come from the hospital master later.
- `emit.js`: reads the manifest + pinned CSV, `builtAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')`, `keepBuiltAt` against the committed file, validates against `hacrp.schema.json` (throws on errors), writes with `formatEmitted`.
- `hacrp.schema.json` (`$id: "hacrp.schema.json"`): envelope via `$ref` to `common.schema.json`; `schema_version` `const: 1`; `model` and each `Hospital` field exactly as `toHospital`/`fitMeasureParams` produce them (numbers or `null` where CMS has `N/A`; text fields strings; `paymentReduction` enum `Yes`/`No`/`N/A`); `measures` objects require all six ids.
- `docs/METHODS-LOG.md`: `## hacrp methods_version 1 (2026-10-20)` + two lines: what the file holds and that values are CMS's.

- [ ] **Step 4.1: Failing tests.**
  - `contract.test.js`: `canonicalJson` is key-order independent and array-order sensitive; `sourceManifestHash` is order-independent over entries; `keepBuiltAt` keeps the old timestamp for equal content and takes the new one when any other field differs; `formatEmitted` output parses back `deepEqual` to the input.
  - `emitted.test.js` (on the committed file): validates against `hacrp.schema.json`; `source_manifest` equals the hash recomputed from the manifest; `fy` equals the CSV's fiscal year; `methods_version` has its heading in `docs/METHODS-LOG.md`; **`the emitted file reproduces CMS for every row`**: for each emitted hospital, `whatIf(h, model).after` equals CMS's score and flag (`===`) and every text field equals the CSV's; `buildModel(emitted hospitals)` deep-equals emitted `model` minus `estimate`.
  - `golden.test.js`: `buildHacrp` from the pins with the committed `built_at` deep-equals the committed file; `rebuilding with the same inputs keeps built_at` (`keepBuiltAt(committed, buildHacrp({..., builtAt: <other time>}))` equals committed).
  - Conformance cases: a valid minimal file; invalid with a numeric CCN, with an extra top-level key, with `paymentReduction: "Maybe"`, with a missing measure id.
- [ ] **Step 4.2:** Run → FAIL. **Step 4.3:** Implement; `make emit`; `npm test` → PASS. Run `make emit` again → `git status` shows no change.
- [ ] **Step 4.4:** Commit: `HACRP FY2026 emitted data with contract envelope; golden check and methods log`.

### ☐ Checkpoint M1 (after Task 4)
- [ ] `/simplify` on the diff since this plan's first commit → `npm test`.
- [ ] `/code-review` on the result; `/security-review` (hooks run `git`/`gitleaks` on staged input; the validator takes external data). Fix Critical/Important before Task 5.

### Task 5: CI skeleton + change gate

> **Superseded in part:** the label, `PR_LABELS` and "any change under `corrections/`" below were replaced
> during execution. The rule as built is in § Amendments, *Change gate (final form)*, and in the header of
> `tools/ci/change-gate.js`.

**Files:** Create `tools/ci/change-gate.js`, `.github/workflows/ci.yml`, `.github/CODEOWNERS` (`* @daltonhaslam`; enforced once branch protection is on at the public flip), `tools/test/change-gate.test.js`, `tools/test/workflow.test.js`; modify `README.md`, `CLAUDE.md`.

**Interfaces:**
- `changeGate({ changed: string[], labels: string[] }) → { ok: boolean, reason: string }`: OK when nothing under `data/emitted/` changed, or labels include `new-cms-release`, or `changed` includes `docs/METHODS-LOG.md` or any path under `corrections/`.
- CLI: base = `$GATE_BASE` (PR: base SHA; push: `github.event.before`; if empty or all zeros, `HEAD~1`); `changed` from `git diff --name-only <base>...HEAD`; labels = `JSON.parse(process.env.PR_LABELS || '[]')`, where `null` (a push has no PR) means none; anything else that isn't an array of strings fails the gate. Prints the reason; exit 1 when not OK.
- `ci.yml`: `on: push (branches: [main])` and `pull_request (types: [opened, synchronize, reopened, labeled, unlabeled])`; top-level `permissions: contents: read`; `concurrency` per ref with cancel-in-progress. Job `test` (ubuntu-24.04): checkout (SHA, `fetch-depth: 0`, `persist-credentials: false`) → setup-node (SHA, `node-version: 24.21.0`) → `npm test` (includes golden) → change gate with `env: GATE_BASE`, `PR_LABELS: ${{ toJSON(github.event.pull_request.labels.*.name) }}`. Job `secrets`: checkout (full history) → download `gitleaks_8.30.1_linux_x64.tar.gz` from the v8.30.1 release, `sha256sum -c` against `551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb`, extract to `$RUNNER_TEMP`, `gitleaks git --redact --no-banner .`.

- [ ] **Step 5.1: Failing tests.** `change-gate.test.js`: unrelated changes pass; an emitted change alone fails; it passes with the label, with a METHODS-LOG change, with a change under `corrections/`; a path like `corrections-old.md` doesn't count; a label named `new-cms-release-ish` doesn't count; non-array `PR_LABELS` fails; `null` counts as no labels. `workflow.test.js` (reads `ci.yml` as text): every `uses:` line matches `@[0-9a-f]{40} # v`; `permissions:` at top level is `contents: read`; no `pull_request_target`; no `${{` inside any `run:` block (`workflow passes labels through env only`); every checkout sets `persist-credentials: false`; the gitleaks step checks a 64-hex SHA-256.
- [ ] **Step 5.2:** Run → FAIL. **Step 5.3:** Implement → PASS.
- [ ] **Step 5.4:** `README.md`: `make hooks` (once per clone), `make emit`, `npm test`. `CLAUDE.md`: hooks and the blocklist location rule; emitted data is committed and golden-checked; the change-gate rule; schemas in `schemas/`; Python arrives with the hospital master.
- [ ] **Step 5.5:** Commit: `CI skeleton: tests, golden and change gate, gitleaks; actions pinned by SHA, read-only token`.
- [ ] **Step 5.6:** Push to the private remote. Watch the run (`gh run watch`). Expected: both jobs green. Then open a throwaway PR branch that edits one line of the emitted file without a log change → `test` fails at the change gate; close the PR and delete the branch.

### ☐ Final gate (full diff since this plan's first commit)
- [ ] `/simplify` → `npm test`.
- [ ] `/code-review` + `/security-review` + `/verify`: clean clone → `make hooks` → a commit with an invented blocklisted name (via `PP_BLOCKLIST` pointing at a temp list) is refused; `npm test` passes; `make emit` leaves git clean.
- [ ] Fix all findings; re-run until clean. Push.

### Task 6: Planning-repo close-out (private repo, Claude)
- [ ] INDEX/ROADMAP per the planning rules; `.project-status`; hours from Dalton.

---

## Amendments made during execution (2026-10-20)

- **File placement:** the pure hook checks are in `tools/hygiene/precommit-checks.js` (the CLIs in `precommit.js`
  and `commit-msg.js`, the list loader in `load.js`). The envelope helpers (`canonicalJson`,
  `sourceManifestHash`, `keepBuiltAt`, `formatEmitted`, and `envelope`, added in the simplify pass) are in
  `pipeline/contract.js`, not `engine/js/`: they use `node:crypto` and are build-only. Repo file helpers
  (`readJson`, `readManifest`, `readPinned`, `loadSchemas`) are in `pipeline/files.js`.
- **Emitted HACRP shape:** `model` is exactly `buildModel()`'s `{ params, boundary }`, so a page passes it
  straight to `whatIf`. The estimate tags are a separate top-level `estimate` object.
- **Blocklist matching:** both sides are NFC-normalized. A space in an entry also matches runs of dots, dashes
  and underscores, so file names and email addresses are caught. Staged file paths are scanned too. UTF-16 text
  with a byte-order mark is decoded rather than skipped as binary. Type-changed files (`T`) are included. The
  outside-repo check uses `realpathSync.native`, so a differently cased path can't slip through on macOS.
- **Validator:** NaN and ±Infinity fail `number` and `integer`, because JSON would write them as `null`.
- **Change gate (final form):** the `new-cms-release` label is gone (Dalton, 2026-10-20). Labels exist only on
  PR runs, so a label-only merge turned `main` red, and a real CMS release always re-pins. The gate reads
  statuses from one `git diff --name-status --no-renames` (a rename is a delete plus an add) and runs from the
  repo root. A file under
  `corrections/YYYY-MM-DD-<slug>.md` (a real date; a regular file whose whitespace-normalized text is non-blank
  and not already a `.md` file under `corrections/` at the merge base; files of 1 MiB or more, such as evidence
  PDFs, are never read) covers the whole change, deletions included. The log is append-only, checked on its
  own: any change that edits, retypes or deletes a dated entry fails. Removing one is a standalone change whose
  PR run and post-merge `main` run both fail; private text also needs a history rewrite, since a deletion leaves
  it in history. Known limits: re-adding an entry deleted
  in an earlier change counts as new. Push runs happen only on `main`; other branches are checked by their PR
  run. A first push of `main` (no `before`) is checked against `HEAD~1`. Otherwise each changed emitted file needs one
  of:
  - *added*: a first emission (by git status, not by content);
  - *re-pinned*: an input's SHA-256 changes in the same change, the file keeps its sources and `methods_version`,
    and its new `source_manifest` is the true hash at HEAD. Pin and re-emit go together, as `make refresh` will
    do (a pin alone already fails the golden test);
  - *bumped*: its own `methods_version` moved to its site's new newest version in the log.
  A deletion needs a corrections entry. Content that isn't an emitted file explains nothing and never crashes
  the gate. An unreachable base (force-push) fails closed. The rule (`changeGate`, `reasonFor`) is pure and
  unit-tested; the CLI is tested against a throwaway git repo.
- **No links under `data/emitted/`** (final security review): a test requires every tracked path there to be a
  regular file. A symlinked file or folder would point readers at content the gate never checks.
- **Known Minor items left after the final review (clean of Critical/Important):** the misnamed-entry hint
  also fires for non-entry notes such as `corrections/evidence/summary.md` and doesn't mention the lowercase
  `.md` and slug rules; the `batchTexts` test doesn't check the stdin it sends or a near-limit buffer; it
  doesn't check the newline after each blob (execFileSync throws on overflow, so truncation isn't expected).
- **`source_manifest`** hashes only `{ id, sha256 }` per input, so metadata fixes don't change emitted data.
  This was HACRP `methods_version` 2; no numbers changed.
- **Methods versions by year:** `pipeline/test/emitted-contract.test.js` checks every emitted file of every
  site against its schema and requires a log heading for its `methods_version`. Only a site's newest year must
  carry the newest version; older years keep the version they were published under.
- **CI:** each push to `main` gets its own concurrency group (GitHub drops queued runs in a shared group even
  without cancel-in-progress), so every push is gate-checked; a PR's newer run replaces its older one. A test fails on any tracked
  file of 10 MiB or more, since the hook can be skipped.
- **Conformance cases:** one base document plus a JSON Pointer patch per case, with ops `set` (the key
  must exist), `create` (it must not) and `delete`. These are deliberately not RFC 6902's names, whose meanings
  differ. The Python runner must apply the same patches.
- **Synthetic CCNs** (`000001`, `00001F`, `990001`) replace real ones in the contract fixtures.
- **Verified on GitHub:** both CI jobs are green on `main`. A throwaway PR that changed one emitted value with
  no reason failed both the golden check and the change gate. The PR was closed unmerged and its branch
  deleted. (A label test in that PR also passed; the label was dropped afterwards.)
