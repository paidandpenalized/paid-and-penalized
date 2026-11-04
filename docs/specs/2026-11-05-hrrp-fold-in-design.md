# Readmissions (HRRP) joins the family: data pipeline and engine

Thirty Day Readmissions (`daltonhaslam/thirty-day-readmissions`, MIT) is rebuilt here under `/hrrp/` as the
family's Readmissions site. This note covers the parts that are code and data: the pipeline port, the engine, the
fiscal-year rule and the page budgets. The pages come later and get their own notes.

## Copy with provenance, not history

Formulas, prose and tests are copied from Thirty Day Readmissions at `33d195927241514a671ca34073a7d7870c555baf`
(`thirty-day-readmissions@33d1959`). Every copied file says so in its header comment, and so does the commit that
adds it. No git history is imported.

## Pipeline port

| Thirty Day Readmissions (`pipeline/`) | Here |
|---|---|
| `hrrp/model.py`: the formula, the replication status, the base-payment and MDH add-on estimate | `engine/py/pp_engine/hrrp.py` (pure); the MDH share is `dollars.MDH_SHARE` |
| `hrrp/parse.py`: the supplemental file (Excel workbook and tab export), Table 15, the rates | `pp_engine/xlsx.py`, `pp_engine/parse.py`, `pp_engine/ipps.py` |
| `build_data.py`: stored decimals, the replication gate, the Table 15 and workbook-vs-export checks, the PAF range check, the hospital record, the fiscal-year share, the MDH shortfall, the dollar-check fields | `pp_engine/hrrp.py` (pure parts), `pipeline/py/pp_pipeline/emit_hrrp.py` (files, orchestration) |
| `hrrp/history.py` and the FY2013–FY2026 history CSVs | `pp_engine/hrrp_history.py`; the CSVs and their `PROVENANCE.md` pinned as derived inputs |
| `content/annual_totals.json`, `content/dollar_check.json` | pinned curated inputs (numbers go through the manifest) |
| `content/research.json`, `timeline.json`, `whats_new.json` | `sites/hrrp/content/` (copy) |
| `fetch.py`'s zip path-traversal guard | `pp_pipeline/files.py`, on every pinned zip read |

Names, locations, beds, teaching, ownership, provider types and Medicare status come from the hospital master by
CCN; they are not recomputed. (They already equal Thirty Day Readmissions' values for every hospital.)

**New pins**, each checked against the SHA-256 Thirty Day Readmissions recorded for it: the FY2027 HRRP
supplemental data file, FY2027 Table 15, FY2027 IPPS Tables 1A–1E, the FY2013–FY2026 payment-factor history and its
summary, the history's provenance note, the annual penalty totals and the dollar check.

## The emitted file

`data/emitted/hrrp/fy2027/hrrp.json`, schema `schemas/hrrp.schema.json`, `methods_version` 1. Its body is Thirty Day
Readmissions' `meta`, `conditions`, `hospitals` and `history`, with the same keys and field names, except:
`meta.sources` lists the manifest's pins; `meta.whatsNew` moves to the site's content with the timeline and the
research findings; the map geometry (`geo`) is dropped, since the family map draws from the pinned atlas.

## The golden

In `make test`, always: the emitted body equals the pinned Thirty Day Readmissions file (`data/pinned/tdr/hrrp.json`)
on `meta` (less `sources` and `whatsNew`), `conditions`, all 2,912 `hospitals` with every field, and `history`; and a
fresh emit equals the committed file. The formula reproduces CMS's payment adjustment factor for every hospital and
CMS's worked example (0.34%), in Python and in JavaScript.

## Engine (JavaScript)

`engine/js/hrrp/`: the formula and the what-if, ported from Thirty Day Readmissions' `web/src/js/model.js` with its
tests, so the page build and the browser share one copy. Wording and number formatting stay with the site.

## Which fiscal year a page shows

One pure rule, `engine/js/years.js`, with no year written into it:

- `shownYear(program)`: a program page shows the newest fiscal year the program has results for.
- `hubYear(programs)`: the hub shows, for every page, the fiscal year for which the most of the programs in its dollar
  estimate have results; the later year on a tie. One year for every hub page, so two hospitals' totals compare.

## Page budgets

Page types that belong to a program (program, hospital, place, Methods, data dictionary) take the program's id, and
each program has its own budgets. Readmissions starts at the hospital-acquired-conditions site's: program 330 KB,
hospital 120 KB, place 150 KB, Methods 100 KB, dictionary 50 KB. The interim Readmissions page types stay until the
new pages replace them. Any raise is recorded beside the number.

## Not in this step

The pages, the hub's switch to the emitted file, the hospital master reading it instead of the pin, a
`make refresh` source for CMS zip files, and re-deriving the history from CMS's archived files.
