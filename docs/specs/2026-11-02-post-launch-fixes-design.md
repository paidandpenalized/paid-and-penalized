# Post-launch fixes: design

2026-11-02. Branch `post-launch-fixes`, off `main` at `105a045`.

## Intent

The site went live on 2026-10-30. The owner's read-through and the launch checks left a list of small defects and
loose ends: words that say less (or more) than the data, numbers that differ from page to page without saying why, a
dead source link, two browser races, and a few pieces deferred at launch. This batch fixes them without changing the
approved look of any page. Anything that would restructure a page is proposed, not built. Nothing here promises a
date, and no sentence ranks a named hospital.

Out of scope: the program page's "every hospital" table leaving the HTML (a separate change), the hub's claims pass,
pages for hospitals outside these programs, and the broader Methods rewrite.

## Goals

1. **Words.**
   - Hub hospital page: the fairness line keeps "A cut is a program's formula at work, not a verdict on a hospital's
     care." and drops the clause about ranking.
   - Home, "Methods, in brief": the heading keeps "estimate" and adds one clause of confidence the code earns (the
     national checks against CMS's totals, the back-test against cost reports). No promise, no overclaim; the owner
     approves the wording before merge.
   - Home directory: two programs live (Readmissions, hospital-acquired conditions), one under construction
     (value-based purchasing), six under consideration. The value-based purchasing placeholder page and the hospital
     page's link to it say "under construction" too. No dates.
   - HACRP program page, the states map: its keyboard note says what Enter does (opens the state's page).
2. **Numbers that differ across pages**, each traced to its cause, and the page says why beside the number:
   - The front page counted 710 hospitals cut by the HAC program; the HACRP pages count 718 (scored hospitals CMS
     cut), 709 of them with an estimate. The 710th is the one hospital CMS cut without a score. The front page's
     step now uses the HACRP pages' population ("709 of the 718 hospitals CMS cut have an estimate here"); its scale
     line says what the site does ("This site estimates pay to 2,971 hospitals"); the family Methods page explains how
     the counts differ.
   - Readmissions (−$337M against −$336,437,747) and value-based purchasing (net −$3.1M against −$3,186,997): not a
     bug. The front page sums all 2,971 hospitals with an estimate; the HACRP page's "Three programs" figure sums the
     2,871 that program scored with a payment decision. Both round correctly. The figure's note now says which
     hospitals it covers and why the front page's totals differ.
   - A hospital page's state peers (e.g. "29 with the 1% cut … of 74") against the HACRP pages' "29 of 68 with a
     payment decision": the hub's peers include hospitals CMS didn't score, which take no cut. The hub's line now
     counts them apart ("… 39 with no cut, 6 that CMS didn't score"), so the two pages' numbers add up.
   - The readmissions factor: the hub shows FY2026 (the year all three programs share), the interim Readmissions
     page FY2027. The hub now names the year beside the factor, and its Readmissions row says why the hospital's
     Readmissions page shows a different one.
3. **Pages that say too little.**
   - A hospital CMS cut that has no dollar estimate: its hub page says CMS's decision (cut or not), not only "No
     estimate".
   - Family Methods: a line that dollar figures are for each CCN as CMS listed it in the year's files (a hospital
     that later closed or merged keeps that year's figures).
   - The hub hospital page's empty band under the net: the likely range the HACRP pages already show for the same
     hospital's net (the back-test's net band for its group: the net times its stratum's two multipliers). Dollars
     only, labeled an estimate, linked to the back-test.
4. **The what-if's ramp shows that the line moves:** CMS's line in each earlier year scored by the same formula as
   today's (equal weights, z-scores) as a faint tick, from the history data.
5. **Source link:** the HCRIS FY2024 landing page moved; the manifest points to CMS's current page for that file.
6. **Browser races, with checks that fail without the fix:**
   - The front page opened at `#state=XX` could, now and then in WebKit, leave the map unclickable for a moment: the
     stage passes the pointer to a panel only once it is half faded in, and the map is pinned (and the checks start)
     before then. The pointer now goes to the panel of the step being read.
   - The search box: a slow first index load no longer opens the list after the reader has left the box; a press on
     the list's scrollbar or its "No matches" row no longer closes it. The 120 ms close delay is decided from what the
     browsers do (plan, Milestone 3).
7. **Favicon:** the ink "&" in a red-bordered box, the glyph as an SVG outline of the self-hosted Alfa Slab One.
8. **Housekeeping:** README and CLAUDE.md current; a dependencies section; NOTICE carries us-atlas's copyright line
   and says truthfully which build tools' code reaches the browser; a CHANGELOG entry.

## Data

No emitted file changes. The hub reads one more emitted file at build time (the HACRP site's, for which hospitals CMS
scored) and its browser asset gains one flag column for the same fact. The dollar file's existing `bands.measures.net`
gives the net's range; the range arithmetic moves to the engine so the HACRP pages and the hub share one copy.
