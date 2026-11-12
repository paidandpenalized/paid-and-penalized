# Paid & Penalized

Code for [paidandpenalized.org](https://paidandpenalized.org): plain-language explainers for the CMS programs
that raise or cut what Medicare pays hospitals, with every hospital's published result and the math behind it.

Live since 2026-10-30: the family's front page and a page for every hospital across the programs (the hub), the
Hospital-Acquired Condition Reduction Program (HACRP) site, and summary pages for the Hospital Readmissions Reduction
Program. Every page that names a CMS value shows it as CMS published it; the site's own recomputations and dollar
estimates are labeled as such, and the HACRP pages reproduce CMS's published scores and payment-reduction decisions
exactly.

## Layout

- `data/pinned/`: source files, byte-for-byte, with SHA-256s in `manifest.json`.
- `data/emitted/`: the data each site is built from, rebuilt from the pinned files and committed.
- `schemas/`: the JSON Schemas every emitted file must pass, plus shared test cases.
- `engine/js/`: the formulas, shared by the build and the browser. `engine/py/pp_engine/`, `pipeline/py/pp_pipeline/`:
  the Python side (standard library only): the hospital master, one record per hospital (CCN) shared by every site,
  the dollar estimates, and a twin of the schema validator.
- `sites/<program>/`: each program's site. `hub/`: the family's own pages (the front page, each hospital's page across
  the programs, Methods and the policy pages). `web/`: what every page shares (the page shell, styles, fonts, charts,
  the what-if, the search box).
- `pipeline/site/`: the page build, which writes the whole site to `dist/`, with Cloudflare's `_headers` and the short
  links' `_redirects`. `tools/`: the browser checks, CI helpers
  and the share cards' generator.

`CLAUDE.md` holds the working rules and the full map of the code.

## Commands

Requires Node 22 or later and Python 3.9 or later.

```
npm ci        # once per clone: the pinned build dependencies (below)
make test     # all tests (npm test, then the Python suite), including the check that data/emitted/ matches a fresh build
make emit     # rebuild data/emitted/ from data/pinned/
make build    # write the site to dist/ (noindex unless PP_ENV=production)
make serve    # preview dist/ at http://127.0.0.1:8080/
npm run e2e   # browser checks over dist/ (E2E_ENGINE=firefox or webkit picks another engine)
make hooks    # once per clone: commit hooks (need gitleaks and a private blocklist file outside the repo)
make refresh SITE=hacrp   # a dry run of a site's data refresh from CMS (it uses the network; nothing is committed)
```

The Provider of Services file is too big to commit (30 MB), so `data/pinned/pos-q2-2026/` holds a subset
derived from it. With the full file (its URL and SHA-256 are in the manifest), check the subset:
`PP_RAW_POS=<path> python3 -I pipeline/py/run.py test`, or rebuild it with
`python3 -I pipeline/py/run.py extract-pos <path>`.

A change to `data/emitted/` must say why: new pinned source data, a new methods version in
`docs/METHODS-LOG.md`, or a new dated entry `corrections/YYYY-MM-DD-<slug>.md`. The corrections log is
append-only. CI checks this; `tools/ci/change-gate.js` has the exact rule.

## Dependencies

The engine, the data pipeline and the tests use none: Node's built-in test runner and Python's standard library. The
rest are pinned in `package-lock.json`:

| Package | License | Used for | In the site's files |
|---|---|---|---|
| esbuild | MIT | bundling and minifying the page scripts and styles | no |
| d3-array, d3-scale, d3-format | ISC | the charts, drawn as SVG at build time | parts, in the HACRP program page's script, with their notices |
| d3-color, d3-interpolate | ISC | dependencies of d3-scale | parts, as above |
| d3-geo, topojson-client | ISC | the maps, drawn at build time from us-atlas | no |
| playwright | Apache-2.0 | the browser checks and the share cards' images | no |
| axe-core | MPL-2.0 | the accessibility checks in the browser checks | no |

The site's fonts are self-hosted under the SIL Open Font License (`web/fonts/`). `NOTICE` lists every third-party
work in the repository and the site, with its terms.

## License

Code: MIT (`LICENSE`). Prose, charts and derived data: CC BY 4.0 (`LICENSE-CONTENT`). Neither covers what `NOTICE`
lists: CMS's and other federal agencies' data (U.S. government works), us-atlas (ISC), the fonts (SIL OFL), the
bundled d3 code (ISC), and the project's names and logos.

Not affiliated with or endorsed by the Centers for Medicare & Medicaid Services.
