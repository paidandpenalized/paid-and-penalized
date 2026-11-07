# Readmissions pages against Thirty Day Readmissions: the number comparison

Every number printed on 44 of Thirty Day Readmissions' pages, compared with the rebuilt page for the same address. Run
2026-11-06 on the `hrrp-pages` branch's final build (served locally), against Thirty Day Readmissions' built artifact (served
locally, so no run touched the live site). Pages were picked by property, never by name.

**Result: 44,394 numbers on the old pages; 43,833 match on the new page as printed. Every one of the other 561 has a
reason below. No number differs because of an error.** Two did, in the first run, and were fixed before this one (§ Fixed).

## How it was compared

- Each page's main text was read in a browser after scrolling (lazy parts load), opening every `<details>`, showing every
  page of a paged table, and paging the old site's tables to the end. Site header and footer were left out.
- Both texts were normalized first: the true minus sign and en-dash minus to `-`, curly quotes and apostrophes to straight
  ones, narrow and no-break spaces to spaces. The new site uses the true minus and curly apostrophes by design.
- Numbers were matched as tokens (dollars, percents, decimals, counts, fiscal years, dates, ranks), counted: a number the old
  page prints twice must be on the new page twice.

## The pages

| Property | New address |
|---|---|
| Largest cut | `/hrrp/hospital/050030/` |
| At the 3% cap (two) | `/hrrp/hospital/190256/`, `/hrrp/hospital/190298/` |
| A cut under 0.1% | `/hrrp/hospital/010001/` |
| A cut from one flagged condition; from four or more | `/hrrp/hospital/010005/`, `/hrrp/hospital/010006/` |
| No cut, every measured condition under its median | `/hrrp/hospital/010021/` |
| Measured on no condition | `/hrrp/hospital/010051/` |
| Flagged, yet the cut rounds to zero | `/hrrp/hospital/010022/` |
| Inactive | `/hrrp/hospital/010062/` |
| Medicare-dependent hospital with the add-on (two) | `/hrrp/hospital/030101/`, `/hrrp/hospital/070021/` |
| No dollar estimate; the dollar file's "no inputs" | `/hrrp/hospital/420117/`, `/hrrp/hospital/050350/` |
| Peer groups 1 to 5, each with a cut; group 5 cut 1% or more | `/hrrp/hospital/010016/`, `010011`, `010012`, `010007`, `010118`, `050091` |
| Under 25 cases on a condition; measured on all six | `/hrrp/hospital/010019/`, `/hrrp/hospital/010023/` |
| In a metro that spans states; outside any metro | `/hrrp/hospital/010168/`, `/hrrp/hospital/010035/` |
| A former name on CMS's file; no Care Compare stars; no cut on 3+ measured | `/hrrp/hospital/010044/`, `010034`, `010049` |
| Largest and second-largest states; smallest state; DC | `/hrrp/state/ca/`, `/tx/`, `/de/`, `/dc/` |
| Metros: two spanning states, one state, the largest, one hospital | `/hrrp/metro/17980/`, `22900`, `13820`, `31084`, `12220` |
| Divisions; regions | `/hrrp/division/new-england/`, `/pacific/`; `/hrrp/region/northeast/`, `/midwest/`, `/south/`, `/west/` |
| The nation; Methods | `/hrrp/`; `/hrrp/methods/` |

## The 561 that don't match as printed

| Reason | Count | What it is |
|---|---|---|
| Same value, other format | 114 | e.g. `0.50-0.99%` vs `0.50%-0.99%` in a legend; a count with and without its separator. |
| Rounding | 10 | The same value at another precision beside the same words. One case: a ratio of 0.05125 prints 0.0512 on the old page (its `toFixed` rounds the binary value down) and 0.0513 on the new (the decimal half rounds up). |
| On the new page, not in its visible text | 23 | The number is in the page (a table behind "Show table", a tooltip) but not on screen. |
| The old page's chart axis numbers | 239 | Tick labels (0.80, 0.90 …) of old charts the new pages draw another way. |
| **Read by hand** | 175 | Below. |

The 175, grouped (the counts are approximate where a group's rows share a section of the page):

- **The cut's history figures, "early-2020" (about 50).** The old captions say the shaded years "set aside early-2020 claims";
  the new say "the claims of January 1, 2020 to June 30, 2020". The dates are stated in full; the token `2020` is counted
  fewer times.
- **The rulers' band (21).** The old "Where the penalty came from" strips shade "the middle 80% of peer hospitals". The
  rulers chosen for the new hospital page draw each condition's ratio, the peer median and the gap without that band.
- **Bed bands as menu options (about 30).** The old place tables show the bed bands (`<100`, `100-299` …) as buttons; the new
  tables offer the same four bands in a menu, whose options are not visible text.
- **Rows on later table pages (about 40).** Rows the old site's paged tables show on a later page, matched against rows the new
  tables show in another order (both open largest cut first, but hospitals with the same cut fall differently: the new tables
  break a tie by dollars, then CCN; the old kept its file's order). Each one checked
  is on the new page with the same value, or is one of the Medicare-dependent hospitals below.
- **Medicare-dependent hospitals' dollars (included above).** The new pipeline prices the Medicare-dependent hospital add-on
  with the hospital-specific case mix (`hrrp methods_version 2`), which moves 101 hospitals' modeled dollars by at most
  0.70% (e.g. $638 → $639, a base of $761K → $763K). Expected.
- **The sepsis measure's dates (6).** The old timeline and a note give "confidential reports for FY2028 and FY2029; counts
  toward penalties starting FY2030". The new pages say the FY2027 rule adopted the measure and hospitals get confidential
  reports first, without those years: the sources disagreed on them.
- **Methods (8).** The old Methods' worked example ("a factor of 0.9886 means a 1.14% cut"), its "2022-23 readmissions" and
  "pre-2019 method" phrases, and "30 days". The new Methods gives the formula with the data's own numbers, and spells out
  "thirty days" (its copy holds no digits by rule).
- **KFF's counts (3).** The old History caption notes that KFF Health News reported lower counts for FY2015, FY2016 and
  FY2018 (2,610, 2,592, 2,573). The new History counts CMS's files and does not carry that aside.
- **Other (about 15).** Timeline dates printed in full where the old timeline printed a year; a figure number (`Fig. 4`)
  that runs differently; a pager's "1-6 of 6" (the new tables show no pager for one page); a research note's year; a legend's
  "0.50" printed "0.50%".

## Fixed after the first run

- A place's condition share that is exactly a half at the last place shown (207 of 360, 57.5%) printed 57% from float noise;
  it now prints 58%, as the old site did.
- The traits table now counts each group's hospitals (1,611 and so on), as the old site's figure did, beside those measured.

## Reproducing it

The harness (Playwright, the repo's own dependency) and its raw text dumps stay out of the repo. The picks above, the
normalization and the matching rule are enough to repeat it: build, serve `dist/` and the old artifact on loopback, read
each pair, normalize, and compare counted tokens.
