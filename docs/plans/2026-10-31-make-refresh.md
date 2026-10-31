# make refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `make refresh SITE=<site>` as designed in `docs/specs/2026-10-31-make-refresh-design.md`: fetch, pin,
rebuild, check, diff against `main`, write the pull request's text; a dry run by default, a draft pull request with
`PR=1`.

**Acceptance:**
- A dry run against CMS's current FY2026 files re-verifies every pin and shows no change to emitted data.
- A fixture-driven test, with synthetic files and no network, takes the changed-input path: a new pin, a non-empty
  golden diff, the pull request's text rendered; and the `PR=1` path commits only data and hands `gh` a draft.
- `make test` passes; `dist/` built from this branch is byte-identical to `dist/` built from `main`.

**Constraints:** Python standard library only (3.9), no new dependency; downloads are untrusted; no push, pull request
or deploy while building this.

## Milestone 1: fetch and pin (`pipeline/py/pp_pipeline/refresh_sources.py`; the sites in `refresh_sites.py`)

- [x] Registry: `Site` (sources, report command, `always` and `new_year` checklists) and `PdcSource` (pin id, dataset,
      file-name pattern, pinned folder template, required columns, optional fiscal-year column, title template,
      archive id template). `SITES["hacrp"]`: `yq43-i98g` (archive id `hacrp-fy{fy}`) and `y9us-9xdf`.
- [x] `fetch(url, cap)`: https to `data.cms.gov` only (redirects too), urllib's User-Agent, a deadline in all, a byte
      cap.
- [x] `locate(source, record)`: the metastore record → download URL, file name (pattern, fully matched), CMS's dates
      (`YYYY-MM-DD` or none).
- [x] `check_csv(source, data)`: UTF-8, header has the columns, at least one row, one fiscal year agreeing with the
      file name's.
- [x] `apply_pin(manifest, source, found, data, today, pinned_dir)`: unchanged / replaced / new year (archive the old
      entry under its archive id, refuse an id or path already taken); writes the file and returns the new manifest.
- [x] `write_manifest`: `json.dumps(indent=2, ensure_ascii=False)` + newline (round-trips today's file exactly).
- [x] Tests (`tests/test_refresh_sources.py`): synthetic metastore records and CSVs; a refused host, redirect,
      pattern, size, column set and year mismatch; unchanged, replaced and new-year pins; the manifest layout.
- [x] **Checkpoint 1:** `/simplify` on the diff, then `make test`; `/code-review`; `/security-review` (external
      input). Fix Critical/Important findings before Milestone 2.

## Milestone 2: rebuild, diff, report, pull request

- [x] `pp_pipeline/golden_diff.py`: pure diff of two `{path: parsed file}` maps and its Markdown.
- [x] `sites/hacrp/pipeline/reproduction.js`: A1, every history year's self-check and the dollar checks, as Markdown,
      from the emitted files (`loadHacrp`); exit 1 when any fails. `a1Summary` exported from `generate.js` (no output
      change).
- [x] `pp_pipeline/refresh.py`: preflight (`PR=1`: no other uncommitted changes), local SHA-256 check of every pin,
      fetch and pin each source, `make emit`, the report command, `make test`, the golden diff against the merge base
      with `main`, the pull request's text (pins changed, reproduction, tests, diff, inputs not fetched, checklists),
      written to a new temporary folder and printed. `PR=1`: stop on any failure; commit `data/pinned` and
      `data/emitted` on `refresh-<site>-<date>` (or the current branch, if not `main`), run the change gate, push,
      `gh pr create --draft`.
- [x] `run.py refresh <site> [--pr]`; `Makefile` `refresh` target (`SITE`, `PR=1`); `CLAUDE.md` Commands and the
      network line.
- [x] Tests (`tests/test_golden_diff.py`, `tests/test_refresh.py`): a temporary git repo with a synthetic site, a fake
      CMS and fake commands: the changed path (new pin, non-empty diff, rendered text, nothing committed), the new-year
      path, a failed emit, nothing to refresh, and `PR=1` (only data committed; push and a draft `gh` call recorded;
      refused with other changes in the tree).
- [x] **Checkpoint 2:** `/simplify`, then `make test`; `/code-review`; `/security-review`. Fix Critical/Important.

## Final gate

- [x] `/simplify` on the full branch diff, then `make test`.
- [x] `/code-review` and `/security-review` on the full branch diff; fix and re-run until clean.
- [x] Drive it: `make refresh SITE=hacrp` (dry run) against CMS's live files: every pin verified, no pin changed, no
      emitted file changed, `make test` passing inside the run; the working tree clean afterwards.
- [x] `make build` on this branch: `dist/` byte-identical to `main`'s.
