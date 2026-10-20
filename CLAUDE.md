# Paid & Penalized — site monorepo

Code for paidandpenalized.org: a family of explainer sites for CMS hospital payment programs.
**This repo becomes public.** Write every file, commit message and comment as if the world reads it.

## Never in this repo
- PHI of any kind. Public, aggregate CMS/federal data only.
- Partner or collaborator names, idea ratings, compensation, or private planning reasoning.
- Restricted third-party material: CPT descriptors, copyrighted guides, proprietary measure specs (see `NOTICE`).

## Planning context
- Planning lives in a separate private repo. Sessions may read it (e.g., `--add-dir`) for context, **read-only**,
  and never copy text, briefs, ratings or names from it into this repo. Restate what you need in your own words.
- Specs go in `docs/specs/`, implementation plans in `docs/plans/`. Both are public.

## Layout
- `engine/js/`: shared plain ES modules. Top-level files (`csv.js`, `stats.js`) are program-neutral.
  Program formulas live in `engine/js/<program>/` as pure functions (data in, result out; no `fs`, network, DOM
  or clock) so the page build and the browser share one copy.
- `sites/<program>/`, `hub/`: sites import the engine, never each other.
- `data/pinned/`: CMS inputs pinned byte-for-byte; `manifest.json` records SHA-256, source URL and dates.
  A test fails if a pinned file changes. Files of 10 MiB (10,485,760 bytes) or more never go in git: the pre-commit
  hook blocks them and a test fails on any tracked file that size.
- `pipeline/`: build-time Node helpers (repo files, the data-contract envelope). File I/O and the clock live here
  and in `sites/*/pipeline/`, never in `engine/`.
- `schemas/`: JSON Schemas for every emitted file (`common.schema.json` holds the envelope and CCN definitions),
  validated by `engine/js/schema.js`, which throws on any keyword it doesn't support. `schemas/conformance/`
  holds language-neutral test cases; the Python validator (with the hospital master) must pass the same set.
- `data/emitted/<site>/fy<YYYY>/`: each site's emitted data, committed. It is the golden snapshot: a test
  rebuilds it from the pins and must match. Every file carries `schema_version`, `methods_version`,
  `source_manifest`, `sources`, `built_at`, `fy`.

## Rules
- **Anchor on CMS.** Every reproduction must equal CMS's published values exactly where CMS publishes them.
  Acceptance tests must pass or the build fails.
- **No hand-typed numbers.** Every number in page copy or code comes from data. Exceptions: method constants
  (e.g., the 5th/95th percentiles) and documented tolerances.
- **Test fixtures name no hospital.** Pick rows by property ("a row with an assigned measure"), or use synthetic
  rows.
- **Zero dependencies by default.** Tests run on Node's built-in `node:test` (`npm test`). Flag any install or
  download to Dalton before running it. Pin exact versions if one is ever added.
- **Commit identity:** `275741810+daltonhaslam@users.noreply.github.com` (repo-local `user.email`).
- **Review gates** at each milestone: `/simplify` → tests → `/code-review` → `/security-review`
  (the last when a change touches external input or credentials).
- **Emitted data changes need a reason on record** in the same change, or CI's change gate fails
  (`tools/ci/change-gate.js` has the exact rule). A new file under `corrections/` (not an edit or exact
  rename of an old one) covers the whole change. Otherwise each changed emitted file must be:
  - **new** (a first emission); or
  - **re-pinned**: an input's SHA-256 changes in the same change, with the same `sources` and `methods_version`
    and a `source_manifest` that is the true hash at HEAD. Pin and `make emit` go together. Adding or dropping
    an input doesn't count; that's a methods change; or
  - **bumped**: its own `methods_version` moved to its site's new newest `## <site> methods_version N` heading
    in `docs/METHODS-LOG.md`, added in the same change.
  Deleting or renaming an emitted file needs a corrections entry. Tests require each site's newest year to carry
  the newest version; older years keep theirs. Run `make emit` after any engine or pin change (the golden test
  fails until you do); it keeps `built_at` when nothing else changed.
- **Commit hooks** (`make hooks`, once per clone): pre-commit blocks files of 10 MiB or more, strings from a
  private blocklist, and secrets (gitleaks); commit-msg checks the message against the blocklist. The blocklist
  lives outside the repo (`~/.config/paid-and-penalized/blocklist.txt`, or `$PP_BLOCKLIST`) and is never copied
  in, quoted, or echoed; hits report only an entry number. Tests use invented names.
- **CI** (`.github/workflows/ci.yml`): actions pinned by full SHA, a read-only token, no `pull_request_target`,
  no `${{ }}` inside `run:` (pass values through `env`). `tools/test/workflow.test.js` enforces these.
- **Outward actions need Dalton's explicit OK in the session:** pushing to a public remote, changing repo
  visibility, deploys, DNS, GitHub Releases. The repo stays private until the first public launch.

## Commands
- `npm test` (or `make test`): all tests, including the golden check.
- `make emit`: rebuild `data/emitted/` from the pins.
- `make hooks`: point git at `.githooks/`.
