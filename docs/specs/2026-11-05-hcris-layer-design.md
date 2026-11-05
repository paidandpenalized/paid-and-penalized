# The HCRIS layer: design and how sites read it (2026-11-05)

Medicare hospital cost reports (HCRIS, Form CMS-2552-10) as one table per HCRIS year, shared by every site that needs
a hospital's finances, payer mix, beds, staffing or uncompensated care. Code: `engine/py/pp_engine/hcris/` (rules,
pure) and `pipeline/py/pp_pipeline/hcris/` (files). Stdlib Python; CSV and JSON only.

## Data flow

1. **CMS's zip** (`HOSP10FY<YYYY>.ZIP`, ~136 MB, downloads.cms.gov). Out of git. Archived by content address
   (`sha256/<hex>`) in an R2 bucket; `cli.py archive-plan` is the dry run.
2. **Pinned cells table**, `data/pinned/hcris-fy<YYYY>/hcris_fy<YYYY>_cells.csv` (~1.35 MB a year). One row per
   report from an acute or critical access hospital, with the report's identity and every cell in
   `pp_engine/hcris/cells.py`. `cli.py pin` derives it; the manifest's `derivedFrom` names the zip. Anyone with the
   zip gets the same bytes.
3. **Emitted year**, `data/emitted/hcris/fy<YYYY>/hcris.json` (~2.0 MB a year, ~29 MB for FY2011 to FY2026). The data
   contract's envelope, the year's facts, `columns`, and one array per hospital. The golden test rebuilds it from
   the pin, offline.
4. **Downloads** (`cli.py downloads <dir>`): `hcris_wide.csv` and `hcris_long.csv` for readers. Build-time only,
   never committed.

## Rules

- **Year.** A year's file holds the reports whose period *begins* in that federal fiscal year. Pages say "cost
  reports beginning in FY2024" (`reader.label`) and show each hospital's period dates beside its numbers, since one
  year spans periods ending from late 2023 to late 2025.
- **Scope.** Acute (CCN ending 0001 to 0879) and critical access (1300 to 1399) hospitals, per CMS's HCRIS
  facility-numbering table. These are the hospitals that fill in S-10; psychiatric, rehabilitation and
  long-term care hospitals barely do.
- **Identity.** A hospital-year is (CCN, year). A report is (CCN, period begin, period end). CMS gives a report a new
  `rpt_rec_num` when it settles it, so record numbers are kept for audit only, never as a key.
- **More than one report in a year.**
  - Periods that don't overlap and cover at most 366 days are added up (`basis: sum`): a change of ownership, a short
    period. Flows add; stocks (beds, FTEs, the cost-to-charge ratio) come from the last period that has them.
  - Otherwise (`shape: long`, a change of fiscal year that puts two periods' starts in one year; `overlap`; a `gap`
    over 366 days), adding would overstate the year by up to ~90%. The row keeps the **fullest report** alone
    (`basis: fullest`): real filed numbers for one period, with one status. It applies to 0.5 to 1.6% of a year's rows
    (26 to 75 a year).
  - `hospital_years(..., long_rule="sum")` still gives the raw sum.
- **Status.** Every row carries CMS's codes (`status`) and the reader label (`status_label`):
  - "settled": codes 2, 3 and 4 (settled, with or without audit, and settled then reopened);
  - "as filed": codes 1 and 5 (as submitted, and amended by the hospital).
  - A row is settled only when every report behind it is.
- **Early years.** A year with under 80% of hospital-years settled is `early`. Settlement revises S-10
  (uncompensated care) most and G-3 (margins) least, so `reader` marks only S-10 values (`cells.S10_METRICS`) in an
  early year. On the 2026-10-05 posting, FY2022 (79.9% settled) through FY2026 are early.
- **Still filing.** `stillFiling` is true while CMS can still receive a year's regular reports. A report is due by the
  last day of the fifth month after its period ends, or 150 days after a period that ends mid-month
  (42 CFR 413.24(f)(2)(i)). On the 2026-10-05 posting, FY2025 and FY2026 are still filing; their hospitals are
  incomplete.
- **Blanks.** HCRIS stores no zeros. A null is zero *or* not reported; the cost report can't tell them apart.
- **Check against CMS.** CMS's Provider Cost Report PUF (data.cms.gov) must equal the cells table on every report
  the two share (same record number). `cli.py puf-check` runs it on whole PUF files. The golden test runs it offline
  on a pinned 2% sample (`hcris-puf-sample`, no names).

## How a site reads the layer

```python
from pp_engine.hcris.reader import Panel, Year, label
from pp_pipeline.hcris.emit import load_years      # the file I/O; pp_engine stays pure

panel = Panel(load_years())                          # every year, oldest first
fy23 = panel.year(2023)
v = fy23.value(ccn, "medicaid_revenue_share")        # Value(year, value, status_label, period_begin, period_end, early)
trend = panel.series(ccn, "total_margin")            # one Value per year the hospital filed
```

- **One reader.** A site's own emitter (Python) reads the layer through `reader` and writes its own site JSON; the
  site's pages never parse HCRIS files. Sites join on CCN to the hospital master for names and locations.
- **Stable columns.** `columns` is fixed by `schemas/hcris.schema.json` (a `const`). Adding a cell changes the schema
  version and the methods version, and re-derives every pin. Names never change meaning.
- **Units** (`cells.UNITS`): `dollars` (as filed, nominal), `days`, `discharges`, `beds`, `fte`, `ratio` (a fraction
  to 4 places: 0.0500 is 5%).
- **What a page shows beside a number:** the period dates, "as filed" or "settled", and for an S-10 value in an early
  year, that it is early. These are the only two reader-facing labels.
- **Shape on a page.** A `fullest` row covers one report's period (`period_days`), which may be shorter than a year.
  A page that adds dollars across hospitals should say so, or use ratios.

## Cells worth adding next

Each needs a new `Cell` in `cells.py`, a schema and methods bump, and re-derived pins. Line and column numbers are
from PRM-II chapter 40 (Transmittal 25); section numbers are given.

| Cells | Where (PRM-II ch. 40) | The reader question it answers |
|---|---|---|
| Type of control, codes 1 to 13 (voluntary nonprofit, proprietary, governmental by level) | S-2 Part I line 21 col 1 (4004.1); also in the report file as `control` (already carried) | "Do for-profit, nonprofit and public hospitals differ on margins and Medicaid?" Needs only a code-to-name table. |
| Urban/rural at period start and end; SCH and MDH periods; CAH flag | S-2 Part I lines 26, 27, 35, 36, 37, 105 (4004.1) | "How do rural hospitals' margins compare, and which depend on special Medicare status?" |
| Teaching: approved GME programs; FTE interns and residents | S-2 Part I line 56 (4004.1); S-3 Part I col 9, line 14 (4005.1) | "Do teaching hospitals carry more Medicaid and uncompensated care?" |
| Medicare DSH: SSI %, Medicaid %, DSH patient %, DSH adjustment; uncompensated care payment | E Part A lines 30 to 34; lines 35 to 36 (4030.1) | "What does Medicare pay this hospital for serving low-income patients, against what its S-10 says it gives?" This joins the layer to DSH Factor 3. |
| IME payment | E Part A lines 22, 22.01, 28, 29 (4030.1) | "How much of Medicare's payment is for teaching?" |
| Balance sheet: cash, total current assets, total assets, current liabilities, total liabilities, fund balance | G lines 1, 11, 36, 45, 51, 59 (4040.1) | "How many days of cash does this hospital have? How fragile is it?" Days cash on hand and the current ratio come from these. |
| Inpatient and outpatient patient revenue | G-2 Part I line 28, cols 1 and 2 (4040.3) | "How outpatient-heavy is the hospital, and how has that shifted since 2011?" |
| Contract labor and wage data: salaries, paid hours, contract labor | S-3 Part II line 1 (salaries col 4, paid hours col 5, average hourly wage col 6) and lines 11 to 13; S-3 Part V line 1 (4005.2, 4005.5) | "How much did travel-nurse and contract labor grow in 2021 and 2022, and has it come back down?" |
| Cost and charges by department; total cost, total charges | Worksheet C Part I lines 200 to 202, cols 3 and 8 (4023.1); Worksheet A line 200 (4013), cost centers by code in the alpha file (A000000, col 0) | "What does each department cost against what it charges? Where do markups come from?" This needs the alpha file. |
| Medicare Advantage negotiated charges by MS-DRG (weighted medians) | S-12 lines 1 to 997, col 1 (4012.50); periods ending on or after 2026-01-01 | "What do Medicare Advantage plans pay this hospital compared with traditional Medicare?" |
| CAH Medicare inpatient cost and 101% payment | E-3 Part V lines 4, 6 (4033.5) | "What does Medicare's cost-based payment mean for a critical access hospital's margin?" |
| COVID-19 funding beyond line 24.50 | G-3 lines 24.51 to 24.60 (4040.4) | "How much did relief funds prop up 2020 and 2021 margins?" |
| Observation days; CAH outpatient visits | S-3 Part I line 28 col 8; line 15 (4005.1) | "Is observation replacing admissions?" |
| S-10 detail: charity care uninsured vs insured; Medicare bad debt | S-10 Part I lines 20 to 23 cols 1 and 2; lines 27, 27.01 (4012.1) | "How much charity care goes to insured patients' deductibles?" |

What the layer can power, beyond the Medicaid page:
- A hospital finance site: 16-year margin and cash trends for every acute and critical access hospital.
- An uncompensated-care map, with Medicare DSH beside it.
- A rural fragility index from margins, cash and special status.
- A teaching-hospital view.
- An MA vs traditional Medicare rate explorer, from S-12, once the first periods ending in 2026 are filed.
- Contract-labor and staffing trends.
- Peer comparisons (state, kind, bed band) for any of these.

Every one of these is a recompute of cells hospitals file, labeled "as filed" or "settled".
