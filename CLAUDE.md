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
- `sites/<program>/`, `hub/`: sites import the engine, never each other. `hub/` is the family landing page. A site's
  own CSS is `sites/<program>/web/styles.css` (bundled after `web/styles/`); its browser scripts are in `client/`.
- `web/`: what every page shares: `site.js` (name, origin, the hub's release state, each site's path, names and release state,
  and the registry of every program, live and coming), `programs.js` (the programs' method constants and deks), `render/`
  (escaping, formatting, the page shell, and `components.js`: page parts a site fills with its own words),
  `styles/` (`tokens.css` is the only CSS or JS file under `web/` or `hub/` that may hold a color value (hex, rgb/hsl, or a named color); `transparent`, `currentColor` and forced-colors system colors are allowed anywhere; `favicon.svg` is the one other file with colors, since an icon can't read CSS variables), self-hosted fonts with their
  licenses, the favicon.
- `pipeline/site/`: the page build. `build.js` empties `dist/`, builds the assets (`assets.js`: one CSS file and
  one ES module per JS entry, content-hashed), writes the hub's data asset once and computes the shell's facts that every
  page shows (`ctx.assets.shell`), then runs each site in its `SITES` list (hub last). Each site exports
  a manifest `{ id, entries, styles, generate }` from its generator (`sites/<program>/web/generate.js`,
  `hub/pages.js`). Generators write only through the context (`context.js`: `emit` for pages and files, `asset` for
  hashed data, `robotsFor`, the one indexing rule). Last, the build writes Cloudflare's `dist/_headers`
  (`headers.js`: the CSP, security headers, caching, `X-Robots-Tag: noindex` on every build but production, and
  the parser and matcher that read it back as Cloudflare does). `serve.js` previews `dist/` locally with those
  headers. `dist/` is build output and gitignored.
- `data/pinned/`: CMS inputs pinned byte-for-byte; `manifest.json` records SHA-256, source URL and dates.
  A test fails if a pinned file changes. Files of 10 MiB (10,485,760 bytes) or more never go in git: the pre-commit
  hook blocks them and a test fails on any tracked file that size.
- `pipeline/`: build-time Node helpers (repo files, the data-contract envelope). File I/O and the clock live here
  and in `sites/*/pipeline/`, never in `engine/`.
- `engine/py/pp_engine/` (pure: no file, network or clock access) and `pipeline/py/pp_pipeline/` (file I/O, CLIs):
  stdlib-only Python, 3.9 or later; CI runs 3.12. Run everything through `python3 -I pipeline/py/run.py
  <test|emit|extract-pos>`, which puts both packages on the path; nothing is installed. Python and JS write
  identical JSON text (numbers as JavaScript prints them, keys in UTF-16 order); shared vectors in
  `schemas/conformance/` pin it.
- The hospital master, `data/emitted/hospital/fy<YYYY>/hospital_master.json`: one record per CCN in Care Compare,
  the IPPS impact file or any program file, with per-program `inProgram` and a reason code (rules and order in
  `pp_engine/master.py` and `docs/METHODS-LOG.md`) and a location (point, county, CBSA, region; rules in
  `pp_engine/location.py`). Sites join on it by CCN. Until Thirty Day Readmissions folds in, a test requires its
  hospitals' names and locations to equal the master's. `run.py geocode` is the one command that uses the network
  (the Census Geocoder); it is run by hand, and its output is a pinned input.
- `schemas/`: JSON Schemas for every emitted file (`common.schema.json` holds the envelope and CCN definitions),
  validated by `engine/js/schema.js`, which throws on any keyword it doesn't support. `schemas/conformance/`
  holds language-neutral test cases; `engine/py/pp_engine/schema.py`, the Python twin, passes the same set.
- `data/emitted/<site>/fy<YYYY>/`: each site's emitted data, committed. It is the golden snapshot: a test
  rebuilds it from the pins and must match. Every file carries `schema_version`, `methods_version`,
  `source_manifest`, `sources`, `built_at`, `fy`.

## Rules
- **Aim high visually.** Pages should be creative and visually impressive, with many analyses and graphs that let readers explore the data. Start from an existing site's page components and improve on them; a section of text usually sits beside a figure. Draft first, then verify: claims and copy review follow the look and never cut a visual.
- **Anchor on CMS.** Every reproduction must equal CMS's published values exactly where CMS publishes them.
  Acceptance tests must pass or the build fails.
- **No hand-typed numbers.** Every number in page copy or code comes from data. Exceptions: method constants
  (e.g., the 5th/95th percentiles) and documented tolerances.
- **Test fixtures name no hospital.** Pick rows by property ("a row with an assigned measure"), or use synthetic
  rows.
- **Dependencies: build time only.** The engine, the pipeline's data code and their tests use none; tests run on
  Node's built-in `node:test` (`npm test`, which needs no browser). The page build uses four pinned dev dependencies:
  esbuild, d3-scale, d3-array, d3-format; the browser checks (`npm run e2e`, `tools/e2e/`) use two more, playwright
  and axe-core (`package-lock.json`; CI runs `npm ci`). Flag anything more, and any other install or download
  (including a Playwright browser), to Dalton before running it. Pin exact versions.
- **Commit identity:** `275741810+daltonhaslam@users.noreply.github.com` (repo-local `user.email`).
- **Review gates** at each milestone: `/simplify` → tests → `/code-review` → `/security-review`
  (the last when a change touches external input or credentials).
- **Emitted data changes need a reason on record** in the same change, or CI's change gate fails
  (`tools/ci/change-gate.js` has the exact rule). The corrections log is append-only: a change that edits,
  retypes or deletes a dated entry fails, so a typo in an entry is fixed by a new entry. Removing an entry is Dalton's
  call. A plain removal is a standalone change: the gate fails on its PR and on the push to `main` after the
  merge, then passes again. Private information is different: deleting the file leaves the text in git history,
  so it needs a history rewrite and force-push instead (Dalton's OK; the gate refuses the lost base, so check
  that range by hand). A new entry
  `corrections/YYYY-MM-DD-<slug>.md` (a real calendar date; a regular `.md` file under 1 MiB with non-blank text
  that isn't a copy of any `.md` already under `corrections/`) covers the whole change. Otherwise each changed emitted file must be:
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
- **Deploy** (`wrangler.jsonc`): a static-assets Cloudflare Worker serving `dist/` on workers.dev and preview URLs;
  no custom domain until go-live. Once Workers Builds is connected, a merge to `main` deploys.
- **Outward actions need Dalton's explicit OK in the session:** pushing to a public remote, changing repo
  visibility, deploys, DNS, GitHub Releases. The repo stays private until the first public launch.

## Commands
- `npm ci`: once per clone, installs the pinned build dependencies (`make build` and its tests need them).
- `make test`: all tests (`npm test`, then `python3 -I pipeline/py/run.py test`), including the golden checks.
- `make emit`: rebuild `data/emitted/` from the pins (both emitters).
- `make hooks`: point git at `.githooks/`.
- `make build`: write the site to `dist/`. Every build is `noindex` unless `PP_ENV=production`.
- `make serve`: preview `dist/` at http://127.0.0.1:8080/.
- `npm run e2e`: browser checks over `dist/` (run `make build` first), served with its real `_headers`; a test that takes over 3 minutes fails. Chromium runs the
  installed Google Chrome (the Chromium Playwright installs when `CI` is set); `E2E_ENGINE=firefox` or `webkit` picks
  another engine; `E2E_BASE_URL=<url>` tests a running site instead of serving `dist/` (the build still picks the pages). Not part of
  `make test`.
- `E2E_BASE_URL=<site> npm run e2e:launch`: the launch check, run by hand where all three browser engines are installed.
  Compares the site's live response headers with `dist/_headers` first (home, program and hospital pages, a request for
  each `_headers` rule, an unknown path, a missing hashed asset, and two redirects with their Location: the program
  page without its "/" and `/404.html`), then runs `npm run e2e` on Chromium, Firefox and WebKit
  against the site. Needs a `dist/` built from the deployed commit with the deployed `PP_ENV`. CI's `browser` job runs `npm run e2e` on Chromium only.
