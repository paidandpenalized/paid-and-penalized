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
  A test fails if a pinned file changes.

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
- **Outward actions need Dalton's explicit OK in the session:** pushing to a public remote, changing repo
  visibility, deploys, DNS, GitHub Releases. The repo stays private until the first public launch.

## Commands
- `npm test` (or `make test`): all engine tests.
