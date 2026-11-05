# Data dictionary: Readmissions files

These files hold what the Readmissions pages show for the {edition} edition of the Hospital Readmissions Reduction Program (HRRP). `{file}` has one row for each hospital in the program's file: its place, its payment adjustment factor and cut, this site's estimate of the dollars, and, for each of the six conditions, the hospital's cases, its excess readmission ratio and whether it was penalized on the condition. The area files list states, metro areas, divisions or regions the same way. They are files from Paid & Penalized (paidandpenalized.org). They hold no patient information.

schema_version: 1

## Source

- The payment adjustment factors, cases and excess readmission ratios are CMS's, from its HRRP files for the {edition} payment year. The Methods page lists every file this site read, with its checksum.
- The hospital's name, place and metro area come from this site's hospital master, built from CMS and U.S. Census Bureau files.
- The estimated penalty is this site's own estimate, not CMS's number. The Methods page gives every assumption.

## Format

- UTF-8 without a byte-order mark. Comma-separated (RFC 4180), CRLF line ends, one header row, one row for each hospital (or area). A cell holding a comma, a quote or a line break is quoted.
- The CCN is plain text. A spreadsheet may drop its leading zero on opening; import or open the column as text to keep it.
- Header names carry their units: percent, dollars, a Y/N flag or a date.
- A text cell that begins with `=`, `+`, `-`, `@` or a tab gets a leading `'`, so a spreadsheet reads it as text, not a formula. Number columns are written as they are.
- A blank cell means the file has no value; it is never written as 0. A condition's penalized column is blank when the hospital had fewer than {minCases} cases of it.

## Hospital files

`{file}` and the largest-penalties file on the program page share these 31 columns, in this order.

| Column | Type | Meaning | Notes |
|---|---|---|---|
| `CCN` | text | The hospital's CMS Certification Number, the ID CMS's files use for it. | The key to join on. Written as plain text, with its leading zero, so open its column as text in a spreadsheet to keep the zero. |
| `Hospital` | text | The hospital's name, as this site shows it. |  |
| `City` | text | The hospital's city. |  |
| `State` | text | The hospital's state or territory, as a two-letter code. |  |
| `Metro area` | text | The name of the metro area (core-based statistical area) the hospital is in. | Blank for a hospital outside any metro area. |
| `Beds` | number | The hospital's bed count. | Blank when no source gives one. Certified beds can differ from licensed beds. |
| `Beds source` | text | Where the bed count comes from. | `certified (Provider of Services file)` or `cost report` (the count from the Medicare cost report, used for the few hospitals without a certified count). Blank when Beds is blank. |
| `Inactive (date)` | text | The date CMS lists the hospital's Medicare agreement as ended, as YYYY-MM-DD. | `date not listed` when CMS lists the agreement as ended with no date. Blank for a hospital CMS lists as active. |
| `Payment adjustment factor` | number | The factor CMS applies to the hospital's base payments for the {edition} payment year. | Four decimals. 1 is no cut. |
| `Payment reduction (%)` | number | The cut the factor makes, in percent: 100 minus 100 times the factor. | Two decimals. 0 is no cut. |
| `Estimated penalty ($, modeled)` | number | This site's estimate of the dollars the cut takes, in whole dollars. | An estimate, not CMS's number; the Methods page gives the assumptions. Blank when the hospital has no estimate. |
| `Peer group` | number | The hospital's peer group, 1 to 5, by the share of its patients who are dually eligible for Medicare and full Medicaid. | Group 1 has the lowest share. |
| `Dual proportion` | number | The share of the hospital's patients who are dually eligible, as a fraction. | Four decimals. 0.2351 is 23.51%. |
| `AMI discharges` | number | The hospital's cases for heart attack (acute myocardial infarction) in the {edition} data window. | Cases are counted whether or not the hospital had enough to be measured. |
| `AMI ERR` | number | The hospital's excess readmission ratio for heart attack (acute myocardial infarction): its readmissions against what its patients' mix would predict. | Above 1 is more readmissions than predicted. Blank when CMS gave none. |
| `AMI penalized (Y/N)` | text | `Y` when the hospital's ratio for heart attack (acute myocardial infarction) was above its peer group's median, so the condition counted toward its cut; `N` when it was measured and was not. | Blank, not `0`, when the hospital had fewer than {minCases} cases of the condition, so it was not measured on it. |
| `COPD discharges` | number | The hospital's cases for chronic obstructive pulmonary disease in the {edition} data window. | Cases are counted whether or not the hospital had enough to be measured. |
| `COPD ERR` | number | The hospital's excess readmission ratio for chronic obstructive pulmonary disease: its readmissions against what its patients' mix would predict. | Above 1 is more readmissions than predicted. Blank when CMS gave none. |
| `COPD penalized (Y/N)` | text | `Y` when the hospital's ratio for chronic obstructive pulmonary disease was above its peer group's median, so the condition counted toward its cut; `N` when it was measured and was not. | Blank, not `0`, when the hospital had fewer than {minCases} cases of the condition, so it was not measured on it. |
| `HF discharges` | number | The hospital's cases for heart failure in the {edition} data window. | Cases are counted whether or not the hospital had enough to be measured. |
| `HF ERR` | number | The hospital's excess readmission ratio for heart failure: its readmissions against what its patients' mix would predict. | Above 1 is more readmissions than predicted. Blank when CMS gave none. |
| `HF penalized (Y/N)` | text | `Y` when the hospital's ratio for heart failure was above its peer group's median, so the condition counted toward its cut; `N` when it was measured and was not. | Blank, not `0`, when the hospital had fewer than {minCases} cases of the condition, so it was not measured on it. |
| `PN discharges` | number | The hospital's cases for pneumonia in the {edition} data window. | Cases are counted whether or not the hospital had enough to be measured. |
| `PN ERR` | number | The hospital's excess readmission ratio for pneumonia: its readmissions against what its patients' mix would predict. | Above 1 is more readmissions than predicted. Blank when CMS gave none. |
| `PN penalized (Y/N)` | text | `Y` when the hospital's ratio for pneumonia was above its peer group's median, so the condition counted toward its cut; `N` when it was measured and was not. | Blank, not `0`, when the hospital had fewer than {minCases} cases of the condition, so it was not measured on it. |
| `CABG discharges` | number | The hospital's cases for coronary artery bypass graft surgery in the {edition} data window. | Cases are counted whether or not the hospital had enough to be measured. |
| `CABG ERR` | number | The hospital's excess readmission ratio for coronary artery bypass graft surgery: its readmissions against what its patients' mix would predict. | Above 1 is more readmissions than predicted. Blank when CMS gave none. |
| `CABG penalized (Y/N)` | text | `Y` when the hospital's ratio for coronary artery bypass graft surgery was above its peer group's median, so the condition counted toward its cut; `N` when it was measured and was not. | Blank, not `0`, when the hospital had fewer than {minCases} cases of the condition, so it was not measured on it. |
| `THA_TKA discharges` | number | The hospital's cases for elective hip or knee replacement in the {edition} data window. | Cases are counted whether or not the hospital had enough to be measured. |
| `THA_TKA ERR` | number | The hospital's excess readmission ratio for elective hip or knee replacement: its readmissions against what its patients' mix would predict. | Above 1 is more readmissions than predicted. Blank when CMS gave none. |
| `THA_TKA penalized (Y/N)` | text | `Y` when the hospital's ratio for elective hip or knee replacement was above its peer group's median, so the condition counted toward its cut; `N` when it was measured and was not. | Blank, not `0`, when the hospital had fewer than {minCases} cases of the condition, so it was not measured on it. |

## Area files

The "Every state" file on the program page has these 8 columns, in this order. Every share is over the hospitals measured on at least one condition.

| Column | Type | Meaning | Notes |
|---|---|---|---|
| `State` | text | The area's name. The column is named for the kind of area the file lists: `State`, `Metro area`, `Division` or `Region`. | Which hospitals are in an area is as the area's page lists them. |
| `Hospitals` | number | The hospitals in the area. |  |
| `Hospitals measured` | number | Those measured on at least one condition (with {minCases} or more cases of it). | A hospital measured on nothing cannot take a cut, so every share below is over this count. |
| `Hospitals penalized` | number | Those with a cut. |  |
| `Penalized (% of measured)` | number | Hospitals penalized as a percent of hospitals measured. | One decimal. |
| `Average cut (%)` | number | The average payment reduction across the area's hospitals, in percent. | Two decimals. |
| `Cut 1% or more (hospitals)` | number | The hospitals whose cut is 1% or more. |  |
| `Estimated penalties ($, modeled)` | number | The sum of the hospitals' estimated penalties, in whole dollars. | Over the hospitals that have an estimate. |
