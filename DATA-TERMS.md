# Data sources and terms

One row per data source this repository uses. "Date checked" is the last day a person or session looked for the
source's terms; where none were found, the row says so rather than supplying language. For the repository's own
licenses (code MIT, prose and derived data CC BY 4.0) and the files they do not cover, see `NOTICE`. Pinned files and
their SHA-256 hashes are listed in `data/pinned/manifest.json`.

"Treated as a U.S. government work" means: the publisher is a U.S. federal agency, no terms page was found that says
otherwise, and the data is handled as public-domain federal data (17 U.S.C. 105). It is this project's reading, not a
statement from the agency.

| Source | URL | Terms or license note | Date checked |
|---|---|---|---|
| HAC Reduction Program hospital files (HACRP), FY2015 to FY2026, with the FY2015 and FY2016 cut lists | https://data.cms.gov/provider-data/dataset/yq43-i98g | CMS data. Terms not found on 2026-11-10; treated as a U.S. government work. | 2026-11-10 |
| Care Compare healthcare-associated infection results (HAI), CY2017 to CY2024 | https://data.cms.gov/provider-data/archived-data/hospitals | CMS data. Terms not found on 2026-11-10; treated as a U.S. government work. | 2026-11-10 |
| Provider Data Catalog footnote crosswalk | https://data.cms.gov/provider-data/dataset/y9us-9xdf | CMS data. Terms not found on 2026-11-10; treated as a U.S. government work. | 2026-11-10 |
| Hospital Readmissions Reduction Program (HRRP) supplemental data files, FY2024, FY2026, FY2027, and Table 15 | https://www.cms.gov/medicare/payment/prospective-payment-systems/acute-inpatient-pps | CMS data. Terms not found on 2026-11-10; treated as a U.S. government work. | 2026-11-10 |
| Hospital Value-Based Purchasing Program Table 16B, FY2024 and FY2026 | https://www.cms.gov/medicare/payment/prospective-payment-systems/acute-inpatient-pps | CMS data. Terms not found on 2026-11-10; treated as a U.S. government work. | 2026-11-10 |
| Thirty Day Readmissions published data (HRRP FY2013 to FY2027 history, annual totals, dollar check, street-address geocodes) | https://github.com/daltonhaslam/thirty-day-readmissions | This project's own MIT-licensed site, built from CMS files; copies are pinned at a recorded commit (see `NOTICE`). | 2026-11-10 |
| Dollars: IPPS final rule impact files (FY2024, FY2026, FY2027) and Tables 1A to 1E, the county-to-CBSA crosswalk | https://www.cms.gov/medicare/payment/prospective-payment-systems/acute-inpatient-pps | CMS data, published with the Federal Register final rules. Terms not found on 2026-11-10; treated as a U.S. government work. | 2026-11-10 |
| Hospital master: Hospital General Information (Care Compare) | https://data.cms.gov/provider-data/dataset/xubh-q36u | CMS data. Terms not found on 2026-11-10; treated as a U.S. government work. | 2026-11-10 |
| Hospital master: Provider of Services file, Q2 2026 (a row and column subset) | https://data.cms.gov/provider-characteristics/hospitals-and-other-facilities/provider-of-services-file-hospital-non-hospital-facilities | CMS data. Terms not found on 2026-11-10; treated as a U.S. government work. | 2026-11-10 |
| Hospital master: U.S. Census Bureau 2024 Gazetteer (ZIP Code Tabulation Areas) | https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.html | Census Bureau data. Terms not found on 2026-11-10; treated as a U.S. government work. | 2026-11-10 |
| Hospital master: U.S. Census Bureau Geocoder results | https://geocoding.geo.census.gov/geocoder/ | Census Bureau service. Terms not found on 2026-11-10; treated as a U.S. government work. Only the result files are kept. | 2026-11-10 |
| County boundaries: us-atlas 3.0.1 (TopoJSON from Census cartographic boundary files) | https://github.com/topojson/us-atlas | ISC license, copyright Michael Bostock; the notice is quoted in `NOTICE`. The underlying Census boundaries are treated as a U.S. government work. | 2026-11-10 |
| HCRIS: Medicare hospital cost reports (Form CMS-2552-10), FY2011 to FY2026 files | https://www.cms.gov/data-research/statistics-trends-and-reports/cost-reports/hospital-2010-form | CMS data, treated as a U.S. government work (terms not found on 2026-11-10). Per-year extracts are pinned in git; CMS's raw zips are not, and are archived by SHA-256 in a private R2 bucket (`pp-sources`). | 2026-11-10 |
| CMS Hospital Provider Cost Report public use file (sample used as a cross-check) | https://data.cms.gov/provider-compliance/cost-reports/hospital-provider-cost-report | CMS data. Terms not found on 2026-11-10; treated as a U.S. government work. | 2026-11-10 |
| CMS-64 New Adult Group Expenditures (Medicaid Budget and Expenditure System), dataset 00505e90-f8ac-5921-b12f-5e23ba7ffcf3 | https://data.medicaid.gov/dataset/00505e90-f8ac-5921-b12f-5e23ba7ffcf3 | CMS data on data.medicaid.gov. Terms page not found on 2026-11-10 (the usual terms-of-use paths returned 404); treated as a U.S. government work. Pinned byte for byte. | 2026-11-10 |
| Medicaid Financial Management Report (FMR), FY2023, MAP tab and DSH rows | https://www.medicaid.gov/medicaid/financial-management/downloads/financial-management-report-fy2023.zip | CMS data on medicaid.gov. Terms page not found on 2026-11-10 (the usual terms-of-use path returned 404); treated as a U.S. government work. A small derived extract is pinned; the workbook is not. | 2026-11-10 |
| Urban Institute / Robert Wood Johnson Foundation, "Projected Reductions in Medicaid Expansion Enrollment Under OBBBA's Work Requirements and Six-Month Redeterminations: National and State Estimates for 2028" (Buettgens, Karpman, Haley, Carter, Kenney; March 2026), Appendix Table A.2 | https://www.rwjf.org/content/dam/farm/reports/reports/2026/rwjf485284 | Not a government work. Cited, not republished: a 42-row table of the three work-requirement columns is transcribed into one small CSV, and the report itself is not stored. Terms page not checked on 2026-11-10. | 2026-11-10 |
