# Data dictionary: hacrp-hospitals.csv

`hacrp-hospitals.csv` holds what CMS reports for every hospital in its Hospital-Acquired Condition Reduction Program (HACRP) file for fiscal year {fy}: the Total HAC Score, the payment reduction decision, each measure's value and z-score, CMS's footnote codes and the measurement periods. Its last columns, each named `_modeled`, are this site's own estimates of the dollars: what traditional Medicare pays the hospital for inpatient stays (with the teaching payments Medicare makes on its Medicare Advantage patients' stays), what the readmissions, value-based purchasing and HAC programs move, and the HAC cut's likely range. It is a file from Paid & Penalized (paidandpenalized.org). It holds no patient information.

schema_version: 3

## Source

- CMS Provider Data Catalog, "{source_title}", dataset {source_id}, released {pdc_released}. The site's pages give the same dataset id and release date.
- CMS's footnote crosswalk, dataset y9us-9xdf, holds the text of each footnote code.
- Name, city, state and county come from this site's hospital master, built from CMS and U.S. Census Bureau files.
- The `_modeled` columns are this site's estimates, built from CMS's FY{fy} IPPS final rule files (the impact file, the rate tables and the value-based purchasing factors in Table 16B) and CMS's FY{fy} HRRP supplemental file. They are not CMS's numbers. The site's Methods page gives every assumption.

## Format

- UTF-8 without a byte-order mark. Comma-separated (RFC 4180), CRLF line ends, one header row, one row per hospital. A cell holding a comma, a quote or a line break is quoted.
- CMS's values are written as CMS wrote them: the same text and the same decimals, with a plain hyphen-minus for a negative number. Nothing is rounded or recomputed.
- A text cell that begins with `=`, `+`, `-`, `@` or a tab gets a leading `'`, so a spreadsheet reads it as text, not a formula. Number columns are written as they are.
- Where CMS has no value it writes `N/A`; the file keeps that word. A footnote column is blank when CMS gave no footnote.

## Columns

| Column | Type | Meaning | CMS source column | Notes |
|---|---|---|---|---|
| `ccn` | text | The hospital's CMS Certification Number, the ID CMS's files use for it. | Facility ID | The key to join on. Keep it as text, so a leading zero survives. |
| `fiscal_year` | text | The fiscal year of CMS's file. | Fiscal Year | CMS's text, unchanged. |
| `name` | text | The hospital's name. | (hospital master) | Not CMS's `Facility Name`: the name this site shows, from its hospital master, built from CMS files. |
| `city` | text | The hospital's city. | (hospital master) |  |
| `state` | text | The hospital's state or territory, as a two-letter code. | (hospital master) |  |
| `county` | text | The hospital's county. | (hospital master) | Blank when the master has none. |
| `total_hac_score` | number | CMS's Total HAC Score: the average of the hospital's z-scores. | Total HAC Score | CMS's text, unchanged. `N/A` when CMS published no score. |
| `payment_reduction` | text | CMS's payment reduction decision. | Payment Reduction | `Yes`, `No` or `N/A`, as CMS writes it. `N/A` is how CMS marks Maryland's hospitals, which are scored but not subject to the reduction. A `Yes` can come with no score; the file keeps CMS's words. |
| `payment_reduction_footnote` | text | CMS footnote code(s) on the payment reduction decision. | Payment Reduction Footnote | See Footnotes below. |
| `total_footnote` | text | CMS footnote code(s) on the Total HAC Score. | Total HAC Score Footnote | See Footnotes below. |
| `psi90_value` | number | CMS's composite value for the PSI 90 patient-safety composite. | PSI 90 Composite Value | CMS's text, unchanged (CMS's decimals). `N/A` when CMS published no value. |
| `psi90_value_footnote` | text | CMS footnote code(s) on the PSI 90 composite value. | PSI 90 Composite Value Footnote | See Footnotes below. |
| `psi90_z` | number | CMS's z-score for PSI 90 composite: how the hospital compares with all hospitals scored on the measure. | PSI 90 W Z Score | CMS's text, unchanged. `N/A` when CMS published none. A z-score can be CMS-assigned with no value (see its footnote). |
| `psi90_z_footnote` | text | CMS footnote code(s) on the PSI 90 composite z-score. | PSI 90 W Z Footnote | See Footnotes below. |
| `clabsi_value` | number | CMS's standardized infection ratio (SIR) for central line–associated bloodstream infections. | CLABSI SIR | CMS's text, unchanged (CMS's decimals). `N/A` when CMS published no value. |
| `clabsi_value_footnote` | text | CMS footnote code(s) on the CLABSI value. | CLABSI SIR Footnote | See Footnotes below. |
| `clabsi_z` | number | CMS's z-score for CLABSI: how the hospital compares with all hospitals scored on the measure. | CLABSI W Z Score | CMS's text, unchanged. `N/A` when CMS published none. A z-score can be CMS-assigned with no value (see its footnote). |
| `clabsi_z_footnote` | text | CMS footnote code(s) on the CLABSI z-score. | CLABSI W Z Footnote | See Footnotes below. |
| `cauti_value` | number | CMS's standardized infection ratio (SIR) for catheter-associated urinary tract infections. | CAUTI SIR | CMS's text, unchanged (CMS's decimals). `N/A` when CMS published no value. |
| `cauti_value_footnote` | text | CMS footnote code(s) on the CAUTI value. | CAUTI SIR Footnote | See Footnotes below. |
| `cauti_z` | number | CMS's z-score for CAUTI: how the hospital compares with all hospitals scored on the measure. | CAUTI W Z Score | CMS's text, unchanged. `N/A` when CMS published none. A z-score can be CMS-assigned with no value (see its footnote). |
| `cauti_z_footnote` | text | CMS footnote code(s) on the CAUTI z-score. | CAUTI W Z Footnote | See Footnotes below. |
| `ssi_value` | number | CMS's standardized infection ratio (SIR) for surgical site infections after colon surgery or abdominal hysterectomy. | SSI SIR | CMS's text, unchanged (CMS's decimals). `N/A` when CMS published no value. |
| `ssi_value_footnote` | text | CMS footnote code(s) on the SSI value. | SSI SIR Footnote | See Footnotes below. |
| `ssi_z` | number | CMS's z-score for SSI: how the hospital compares with all hospitals scored on the measure. | SSI W Z Score | CMS's text, unchanged. `N/A` when CMS published none. A z-score can be CMS-assigned with no value (see its footnote). |
| `ssi_z_footnote` | text | CMS footnote code(s) on the SSI z-score. | SSI W Z Footnote | See Footnotes below. |
| `cdi_value` | number | CMS's standardized infection ratio (SIR) for Clostridioides difficile (C. diff) infections. | CDI SIR | CMS's text, unchanged (CMS's decimals). `N/A` when CMS published no value. |
| `cdi_value_footnote` | text | CMS footnote code(s) on the CDI value. | CDI SIR Footnote | See Footnotes below. |
| `cdi_z` | number | CMS's z-score for CDI: how the hospital compares with all hospitals scored on the measure. | CDI W Z Score | CMS's text, unchanged. `N/A` when CMS published none. A z-score can be CMS-assigned with no value (see its footnote). |
| `cdi_z_footnote` | text | CMS footnote code(s) on the CDI z-score. | CDI W Z Footnote | See Footnotes below. |
| `mrsa_value` | number | CMS's standardized infection ratio (SIR) for MRSA bloodstream infections. | MRSA SIR | CMS's text, unchanged (CMS's decimals). `N/A` when CMS published no value. |
| `mrsa_value_footnote` | text | CMS footnote code(s) on the MRSA value. | MRSA SIR Footnote | See Footnotes below. |
| `mrsa_z` | number | CMS's z-score for MRSA: how the hospital compares with all hospitals scored on the measure. | MRSA W Z Score | CMS's text, unchanged. `N/A` when CMS published none. A z-score can be CMS-assigned with no value (see its footnote). |
| `mrsa_z_footnote` | text | CMS footnote code(s) on the MRSA z-score. | MRSA W Z Footnote | See Footnotes below. |
| `psi90_start` | text | First day of the PSI 90 measurement period. | PSI 90 Start Date | CMS's MM/DD/YYYY text, unchanged. |
| `psi90_end` | text | Last day of the PSI 90 measurement period. | PSI 90 End Date | As above. |
| `hai_start` | text | First day of the infection measures' measurement period. | HAI Measures Start Date | As above. |
| `hai_end` | text | Last day of the infection measures' measurement period. | HAI Measures End Date | As above. |
| `dollars_status` | text | Whether this site has a dollar estimate for the hospital, and if not, why. | (this site's estimate) | `estimated`; `maryland` (Maryland's hospitals are exempt from the HAC cut, and the dollar columns are blank); `parhm` (a hospital in Pennsylvania's Rural Health Model: no estimate); `no-inputs` (no usable row in CMS's IPPS impact file: no estimate). |
| `inpatient_payment_modeled` | number | This site's estimate of what traditional Medicare pays the hospital for a year of inpatient stays, with the teaching payments Medicare makes on its Medicare Advantage patients' stays (which the HAC cut is also taken on), before the three programs, in whole dollars. | (this site's estimate) | Blank without an estimate. Volume is the impact file's (two years before the fiscal year); the rates are the fiscal year's. |
| `hrrp_dollars_modeled` | number | The readmissions program's adjustment: the base payment times its factor minus 1, in whole dollars. | (this site's estimate) | Zero or negative: negative is money Medicare keeps. Blank without an estimate. |
| `hvbp_dollars_modeled` | number | The value-based purchasing adjustment: the base payment times its factor minus 1, in whole dollars. | (this site's estimate) | Negative is money Medicare keeps; positive, a bonus. Blank without an estimate. |
| `hac_at_stake_modeled` | number | 1% of the payment after those two adjustments, in whole dollars: what the HAC cut takes from a hospital CMS cuts. | (this site's estimate) | For every estimated hospital, cut or not. Blank without an estimate. |
| `hac_dollars_modeled` | number | The HAC cut, in whole dollars. | (this site's estimate) | Minus `hac_at_stake_modeled` where `payment_reduction` is `Yes`, else 0. Blank without an estimate. |
| `hac_dollars_low_modeled` | number | The low end of the HAC cut's likely range, in whole dollars: the larger cut. | (this site's estimate) | Same sign as `hac_dollars_modeled`. For a hospital CMS cut, minus the high end of the dollars at stake's likely range; 0 where `payment_reduction` is not `Yes`. Blank without an estimate. In the site's check against an earlier year's cost reports, 80% of hospitals of the same size and kind had an actual cut inside a range this wide around the estimate. |
| `hac_dollars_high_modeled` | number | The high end of the HAC cut's likely range, in whole dollars: the smaller cut. | (this site's estimate) | Same sign as `hac_dollars_modeled`; 0 where `payment_reduction` is not `Yes`. Blank without an estimate. |
| `net_dollars_modeled` | number | The three programs together, in whole dollars. | (this site's estimate) | `hrrp_dollars_modeled` + `hvbp_dollars_modeled` + `hac_dollars_modeled`; each row adds exactly. Blank without an estimate. |

## Footnotes

A footnote column holds CMS's footnote code exactly as CMS writes it. When a cell holds more than one code, they are separated by commas and the cell is quoted. The text of each code is in CMS's footnote crosswalk (dataset y9us-9xdf in the Provider Data Catalog). Footnotes tell how to read a value: for example, that CMS assigned a z-score because the hospital had no measured result.

## Reading the file

- The Total HAC Score is not a grade of the quality of care. It compares hospitals with each other on the measures each was scored on.
- Every column but the `_modeled` ones reports what CMS published. The `_modeled` columns are this site's estimates, in whole dollars that add exactly across a row; the estimate is not that precise. The file holds no what-ifs.

## License

The file is licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/), with credit to Paid & Penalized (paidandpenalized.org). The CMS data behind it are U.S. government works in the public domain. This project is not affiliated with or endorsed by CMS.
