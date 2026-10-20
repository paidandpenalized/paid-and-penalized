# Paid & Penalized

Code for [paidandpenalized.org](https://paidandpenalized.org): plain-language explainers for the CMS programs
that raise or cut what Medicare pays hospitals, with every hospital's published result and the math behind it.

Work in progress. The first piece is the formula engine for the Hospital-Acquired Condition Reduction Program
(HACRP), FY2026, which reproduces CMS's published scores and payment-reduction decisions exactly.

## Layout

- `data/pinned/`: source files, byte-for-byte, with SHA-256s in `manifest.json`.
- `data/emitted/`: the data each site is built from, rebuilt from the pinned files and committed.
- `schemas/`: the JSON Schemas every emitted file must pass, plus shared test cases.
- `engine/js/`: the formulas, shared by the build and the browser. `sites/<program>/`: each site.
- `engine/py/pp_engine/`, `pipeline/py/pp_pipeline/`: the Python side (standard library only): the hospital
  master, one record per hospital (CCN) shared by every site, and a twin of the schema validator.

## Commands

Requires Node 22 or later and Python 3.9 or later. No packages to install.

```
make test     # all tests (npm test, then the Python suite), including the check that data/emitted/ matches a fresh build
make emit     # rebuild data/emitted/ from data/pinned/
make hooks    # once per clone: commit hooks (need gitleaks and a private blocklist file outside the repo)
```

The Provider of Services file is too big to commit (30 MB), so `data/pinned/pos-q2-2026/` holds a subset
derived from it. With the full file (its URL and SHA-256 are in the manifest), check the subset:
`PP_RAW_POS=<path> python3 -I pipeline/py/run.py test`, or rebuild it with
`python3 -I pipeline/py/run.py extract-pos <path>`.

A change to `data/emitted/` must say why: new pinned source data, a new methods version in
`docs/METHODS-LOG.md`, or a new dated entry `corrections/YYYY-MM-DD-<slug>.md`. The corrections log is
append-only. CI checks this; `tools/ci/change-gate.js` has the exact rule.

## License

Code: MIT (`LICENSE`). Prose, charts and derived data: CC BY 4.0 (`LICENSE-CONTENT`). See `NOTICE`.

Not affiliated with or endorsed by the Centers for Medicare & Medicaid Services.
