"""The HCRIS layer: Medicare hospital cost reports (Form CMS-2552-10) as a tidy hospital-by-year table.

`cells` names every cell read (worksheet, line, column) and how it combines; `tidy` turns the report and numeric
files' rows into hospital-year rows. Pure: the pipeline (pp_pipeline.hcris) reads the files.
"""
