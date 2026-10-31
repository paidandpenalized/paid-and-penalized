# make refresh: design

2026-10-31. Branch `make-refresh`, off `main` at `c5b5bd7`.

## Intent

CMS replaces the files a site is built from: a new fiscal year each summer or fall, and now and then a corrected file
for the same year. Something outside this repo notices (a nightly check of CMS's postings); someone then runs one
command in a working session, reads what it produced, and opens a pull request for the owner to merge. Nothing
publishes on its own: the site changes only when a merge to `main` deploys.

`make refresh SITE=<site>` is that one command. It does the mechanical half of a refresh the same way every time: fetch
CMS's current file, pin it, rebuild every emitted file, run the reproduction checks and the tests, compare the emitted
data with `main`'s, and write the pull request's text, listing what a person must still do by hand. It has to exist
before the FY2027 HACRP file posts.

## Goals

1. **One command, safe by default.** `make refresh SITE=hacrp` is a dry run: it changes only `data/pinned/` and
   `data/emitted/` in the working tree and writes its report and the pull request's text to a new temporary folder.
   It creates no branch or commit, pushes nothing and opens nothing. `make refresh SITE=hacrp PR=1` does the same,
   then commits those two folders (and nothing else) on a branch, pushes it and opens a **draft** pull request with
   `gh`. A push to this public repo needs the owner's OK in the session; the dry run is what a session runs first.
2. **Fetch, untrusted.** For each source a site registers, ask CMS where its current file is and download it:
   - Provider Data Catalog datasets (`pdc`): the dataset's metastore record names the file
     (`distribution[0].downloadURL`). Every request goes to `https://data.cms.gov` only, redirects included, with
     urllib's own User-Agent (that host's CDN refuses browser-like and custom agents; urllib's is the one known to
     pass).
   - Each download goes into its own new empty folder outside the repo, is capped below the 10 MiB pin limit (a
     bigger file needs the Release or R2 path, not git) and at a total time, and is checked before it is pinned: the
     file name matches the source's pattern exactly (it becomes a path under `data/pinned/`), the text is UTF-8 CSV
     with the key columns the site reads (its own reader checks the rest at `make emit`) and at least one row, and,
     for a source with a fiscal-year column, one year that agrees with the year in the file name. Nothing from a
     download is run; the Python that reads one runs under `python3 -I`.
3. **Pin.** Same bytes as the pin: nothing changes (CMS's URL or dates moving with the bytes unchanged is reported,
   not written). New bytes for the same year (a correction): the file and its manifest entry are replaced in place
   (path, bytes, SHA-256, download URL, CMS's dates, retrieved). New bytes for a new year: the current pin's entry is
   renamed to the source's archive id (`hacrp-fy2026`, the scheme the earlier years already use) and keeps its file,
   and the new year's file is pinned under the dataset id at a new year folder. The manifest keeps its exact layout.
4. **Rebuild and check.** `make emit` (every emitter: the site's, the hospital master, the dollar estimates), the
   site's reproduction report (HACRP: acceptance A1, every history year's self-check, the dollar estimates' checks
   against CMS's totals), and `make test` (which includes every pin's SHA-256 and the golden tests). A failing step
   is reported with its output; the run goes on to the diff so the report shows everything, and exits 1.
5. **Golden diff against `main`.** Every file under `data/emitted/` in the working tree against the same path at the
   merge base with `main`: added, removed or changed, and for a changed file which top-level parts moved and, for
   lists of records keyed by CCN, `id` or year, how many records were added, removed or changed and which fields
   changed how often (e.g. "paymentReduction: 14"). `built_at` alone is not a change.
6. **Pull request text.** Pins changed against `main` (an archived pin shows as such); every pinned file's local
   SHA-256 re-verified; the reproduction report; test results; the golden diff; the inputs `make refresh` does not
   fetch for the site (re-pinned by hand when they move); and the steps a person must still do: the site's list for
   every refresh, plus its new-year list when the year changed.
7. **Other sites plug in.** A site is one entry in `pp_pipeline/refresh_sites.py`: its sources, its reproduction
   report command and its two checklists. HVBP's Provider Data Catalog datasets fit the `pdc` kind as they are.

## Scope of v1

- `SITE=hacrp`: the HACRP file (`yq43-i98g`) and CMS's footnote crosswalk (`y9us-9xdf`), the two Provider Data Catalog
  files the HACRP pages read that CMS replaces in place. `make emit` rebuilds every emitted file, so the hub's inputs
  that come from the HACRP file (the hospital master's HACRP column, the dollar estimates) are rebuilt and diffed in
  the same run; the hub has no fetched source of its own.
- Not fetched, listed in the report instead: Care Compare's Hospital General Information (its pin id names its
  release, so a new release is a new id and a code change), the IPPS final-rule files, POS, HCRIS, the HAI extracts and
  the archived history years (frozen, or derived by their own commands).
- A new HACRP year also needs code: the history's year list, the dollar estimates' IPPS year and pins, and the caps
  set against the old year's counts. `make refresh` pins and archives; the emit then fails with the message that names
  the change, and the report lists the steps. After the code change, running `make refresh` again finds the pins
  already current and carries on from the rebuild.

## Non-goals

- Detection or scheduling (the nightly check lives outside this repo; no scheduled GitHub Action).
- Merging, deploying, or editing code or copy.
- Fetching every pinned input from upstream. The archived and derived pins are re-verified locally by SHA-256; the
  test suite does that too.

## Safety

- Requests: `https` to `data.cms.gov` only, a redirect elsewhere refused; a 30 s deadline per request in all; the
  metastore record capped at 1 MB, a download at 10 MiB − 1 byte.
- Paths: a pinned path is `<source folder>/<file name>`, the folder from the site's entry and the name from CMS's URL
  only when it fully matches the source's pattern (no separators or dots beyond the pattern's); the resolved path must
  sit under `data/pinned/`.
- Values copied into the manifest: the download URL only after the host and path checks, CMS's dates only when they
  are `YYYY-MM-DD`.
- Commands run as argument lists, never through a shell. `PR=1` commits only `data/pinned/` and `data/emitted/`, and
  refuses to start with other uncommitted changes, so the pull request is exactly what was tested. It starts only on
  `main`, after checking it is origin's, or on the `refresh-<site>-<date>` branch it makes, so the pull request holds
  the refresh and nothing else. It stops before the push when emit, the reproduction report or the tests fail (and
  moves to that branch, where the fix is made and committed before running it again), or when the CI change gate
  refuses the commit. A rerun on a branch that already has a pull request updates that pull request's text.
