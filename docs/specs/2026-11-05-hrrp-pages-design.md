# Readmissions (HRRP) pages: design

The second note on rebuilding Thirty Day Readmissions (`thirty-day-readmissions@33d1959`, MIT) as the family's
Readmissions site at `/hrrp/`. The first note (`2026-11-05-hrrp-fold-in-design.md`) covered the data pipeline and
the engine. This one covers the pages: what each page must carry, the form each figure takes, and the new analyses.

## The bar

- **Parity is the floor.** A reader must be able to get every piece of information Thirty Day Readmissions gives and
  do everything it lets them do. Parity is about information and interactions, not the same chart: where this note
  changes a figure's form, the row is met when the new form shows the same numbers (or more) and keeps the same
  interactions.
- **Better than the old site on every page.** Thirty Day Readmissions is one 2.7 MB page that draws itself in the
  browser. Here every view is its own page, drawn on the server: shareable, readable with no JavaScript, indexable,
  with its own title and description. About 3,400 pages: the program page, 2,912 hospital pages, about 470 place pages,
  Methods and the data dictionary.
- **Each figure gets the form that answers its question** (the table below): the family kit (`web/charts/`) where a
  form fits, a new chart where none does.
- **Never at the cost of accuracy.** Every number comes from the data. A later check compares the numbers printed on
  about 40 of the old site's views with the new pages.

## What must not change

Worksheet R and its exact replication of CMS's factor; the plain-English verdict sentence and the rank line; the
government-form look (numbered fields, the stamp, green-bar tables, typewriter figures); "Bring all to median"; the
honesty markers (estimate tags, the cost-report dollar check, the inactive note, the COVID shading); the research
section saying where researchers disagree; the five-step "How it works" told with the real numbers.

## Addresses

| Old view | New page |
|---|---|
| Home and its six sections (`how`, `picture`, `map`, `history`, `explore`, `research`) | `/hrrp/`, with those six element ids |
| A hospital (2,912) | `/hrrp/hospital/<ccn>/` (CCN in lowercase) |
| A state: 49 states and DC (Maryland and Puerto Rico have no hospitals in the program and get no page) | `/hrrp/state/<code>/` |
| A metro area (406) | `/hrrp/metro/<cbsa>/` |
| A census division (9) | `/hrrp/division/<slug>/` |
| A census region (4) | `/hrrp/region/<slug>/` (`northeast`, `midwest`, `south`, `west`) |
| Methods, and its dollar assumptions | `/hrrp/methods/`, with the element id `methods-dollars` |
| Not found | the family 404, plus a line on who isn't in the program |

A place with no hospitals has no page. Every page has its own `<title>` and meta description.

## The program page, `/hrrp/`

Parts, numbered, with the section menu (the six Parts plus Methods; the `picture` Part named for the edition).
Each Part has "Part N", a heading and a lede; each figure has "Fig. N", a title, a one-line takeaway that varies
with the data, and a source line.

1. **Hero.** Kicker (the edition and "year N of penalties"), the title "Readmissions", a deck with the payment start
   date and "X of the N hospitals CMS evaluated take a cut: P% of the M measured on at least one condition". The
   family search box, with hint links picked by property (the state and the metro with the most hospitals, every
   hospital, how it works).
2. **At a glance** record card, eight numbered fields with their notes: hospitals evaluated; penalized (with % of
   measured); average cut, all; average cut, penalized; at the 3% maximum; estimated dollars (estimate tag, CMS's own
   rule-time estimate, the count with no estimate); data window; payment year. The stamp "Final · posted <date>".
   "All figures from CMS unless marked".
3. **How it works** (`how`). "New for <FY>" (shown only when the notes are for the build year) and "Who is in the
   program" (the count rounded to the hundred; who is out: critical access, children's, cancer, psychiatric,
   rehabilitation and long-term care hospitals; Maryland; Puerto Rico). Five steps:
   1. Six kinds of stays, a hospital counts on a condition with 25 or more cases.
   2. Each hospital's excess readmission ratio for one condition, with a six-condition switch (heart failure first).
   3. Peer groups by dual-eligible share: 1-point bins, five labeled bands, cutoffs from the data.
   4. The bar to clear is the peer group's median: the 5 × 6 table, rows labeled with the dual range, 4 decimals.
   5. **Worksheet R** for one hospital: fields A–C (hospital, peer group, neutrality modifier), lines 1–6 per
      condition with the reason a row doesn't count, lines 7–9, CMS's published factor with "· matches" or "· differs
      by", and the dollars line. The four-decimal note. Line 4 prints "< 0.0001" for a sliver. The default hospital:
      factor below 1, three or more flagged conditions, 150 or more beds, the median of those by cut; the same
      hospital is Step 2's highlight. (The picker that swaps it is browser work.)
4. **The picture** (`picture`). Lede: the median cut, how many lose 1% or more, how many hit the cap. Figures: the
   size of the cuts; conditions measured against share penalized; which conditions cost the most; penalties by peer
   group; penalties by hospital type (teaching, beds `<100` `100–299` `300–499` `500+`, urban/rural, three ownership
   classes; empty groups hidden); the largest penalties (top 10 by cut, then dollars; its CSV has the hospital CSV's
   columns).
5. **Map** (`map`). A state map with four measures (average cut, share penalized, estimated dollars, share cut 1% or
   more), five bins per measure applied to the shown (rounded) value, no color where nothing is measured, Maryland
   marked "Exempt: Maryland's own payment model", other missing states "No hospitals in the program"; hospital dots
   as a toggle, off by default, dot area by base payments. "Every state": average cut descending, 15 per page, with a
   CSV of 8 columns including the counts behind each share. "Browse by region": regions, then each division with its
   states inline as links.
6. **History** (`history`). Share penalized by year, average cut (penalized and all), estimated total penalties (CMS's
   estimates dark, KFF's light; years with none are listed), with the marks: the cap steps (from the data), peer
   groups from FY2019, pneumonia paused in FY2023, Medicare Advantage added in FY2027, the COVID years FY2022–FY2024
   shaded with their note. The timeline (dated entries with sources; future years marked; only https links).
7. **Every hospital** (`explore`). Filters (text including aliases, state, peer group, penalized on, teaching, beds,
   location, penalized only = factor below 1), the table (hospital with inactive tag and place · CCN, cut with bar,
   estimated dollars, peer group, the six-condition strip with a text alternative, beds with "cost rpt"), 25 per
   page, sort (name A→Z first, others high to low, blanks last), status "1–25 of N", the empty state. Copy and
   download CSV of the filtered rows in the current sort. The rows load near scroll, not in the HTML.
8. **What the research says** (`research`). The findings grouped by theme, each cited; it keeps saying where
   researchers disagree.

## The hospital page, `/hrrp/hospital/<ccn>/`

- Breadcrumb: Nation › Region › Division › State › Metro › hospital (the last crumb `aria-current`).
- Record card "Hospital record · <FY>" with the CCN: name and "also listed as"; city, ZIP and the county's full name;
  metro or "outside metro areas" with its link; the type line (teaching, beds with "(cost report)", ownership,
  urban/rural, special types spelled out), joined with " · ", "—" when empty; peer group and dual share; Care Compare
  stars with an "Open on Medicare.gov" link, or "Not rated".
- The verdict: the stamp ("Cut X%", "No cut", plus "Inactive"), the summary sentence in its variants (none measured;
  all at or below the median; flagged but rounded to zero; penalized; inactive), the inactive paragraph.
- Fields: the payment adjustment factor (4 decimals, "CMS, final"); estimated dollars (estimate tag, base payments,
  "no volume data"); the rank line (against the nation, the state and the peer group; floored, capped at 99; "like N
  other hospitals" for no cut). "Report a problem with this hospital's data".
- Figures: where the penalty came from; the what-if (one slider per measured condition, Reset, "Bring all to median",
  the hypothetical cut, factor and dollars; "nothing to simulate" when none is measured); penalty history (the cut
  each year, the all-hospital average, "n/a" where the hospital isn't in the file, "penalized in X of N years with
  data"); "Show the full worksheet" (a disclosure); other hospitals in the metro (or outside metro areas in the
  state), only when there's more than one, the current row marked, cut descending, with its CSV.
- Flags by property: inactive, no estimate, cost-report beds, rounded to zero, payment weight not published, under 25
  cases.

## Place pages

Breadcrumb, kind kicker, name (metros that span states marked "(XX part)" on state pages and "spans XX, YY" on metro
pages; a metro's breadcrumb follows the state with most of its hospitals). Deck: N of M take a cut, the share of
measured, the average cut, the state's rank among the states in the program, the estimated total with its estimate
tag. A record card against the nation, six fields. A map of the area's hospitals (a metro's other in-state hospitals
faint). The size of the cuts, area against all hospitals. Which conditions drive the penalties here. Peer groups.
Average cut over time, area against all. The child table (divisions, states or metros; state pages add an "Outside
metro areas" row that isn't a link; none on metro pages), 25 per page, with its CSV. The area's hospitals in the
explorer (its state filter only when the list spans more than one state), with its CSV.

## Methods, `/hrrp/methods/`

Kicker "Methods & sources", heading "How this was made". About; the formula (neutrality modifier × payment weight ×
(ratio − peer median)) as a preformatted block, the neutrality modifier to 4 decimals; the replication statement;
the dollar formula and the modeled totals against CMS's; `#methods-dollars`: the accuracy line (the cost-report check)
and the assumptions table (the fixed rows plus the conditional ones, each from data or a cited method constant); how
to read a penalty; places (geocode counts); history (the FY2013–FY2018 exclusions, the FY2025 simulation); feedback and
privacy (Google sees form submissions and the IP; no promised reply time; the privacy claims, including how visits are
counted with Cloudflare Web Analytics, live on the family privacy page, which Methods links); accessibility; the sources
(every pin the site reads, with its hash and size); the 14-term glossary; reuse (licenses, CSV conventions: the family
writes a CCN as plain text, so the reuse note says to open its column as text to keep the leading zero, not `="010001"`,
which engine/js/csv.js's formula guard would break). The data dictionary is its own page.

## Everywhere

Family search (hospitals, states, metros; accent and punctuation folding; saint/st, mount/mt, fort/ft; exact CCN
first; 10 results); family theme, skip link, focus, table semantics and figure tables; the feedback link on every page
(site and page address only); the `/hrrp/` share card (kicker, title, deck, three fields); the family security headers;
no console errors, no sideways scroll at 360 px, no "NaN", "undefined" or "[object Object]".

## Figure forms

| Old figure | Form here, and why |
|---|---|
| Step 1: hospitals per condition | Punch card (`punchCard.js`) of which condition *sets* hospitals have: the common set is heart failure, pneumonia, COPD and heart attack, and CABG is rare, which explains who can be penalized on what |
| Step 2: ratios against 1.0 | The old chart drew 1.0 as the line, but the line is each peer group's median. Plot ratio − peer median so all five groups share one line at 0: a unit swarm (`scoreSwarm.js`), penalty ink past 0, a magnifier on ±0.01 |
| Step 3: dual-share bands | Columns with five shaded bands (`columns.js`) |
| Step 4: medians table | The table stays, collapsed below the step, and goes in Methods too (charting 0.98–1.00 would exaggerate tiny differences) |
| Step 5: Worksheet R | Exactly as it was, plus a waterfall (`waterfall.js`) beside it: the parts summed against the 3% cap |
| The size of the cuts | A unit swarm, one dot per hospital, clickable; the pile at zero is the annotation. Place pages stack their own hospitals first |
| Conditions measured | Observed share penalized by number of conditions against 1 − 0.5^k (`shareDots.js`): conditions move together. It must not claim independence |
| Which conditions cost the most | Paired bars (`pairBars.js`): share penalized on each condition against share of dollars (heart failure and pneumonia lead on dollars because of the payment weight) |
| Penalties by peer group | Ridges (`ridges.js`), share penalized at the right: how flat it is is the story |
| Average cut by type | Share-penalized dots against the national share, dot area = n (`shareDots.js`): an average cut mixes zeros with the cap |
| Largest penalties | The table, plus a six-cell measured-conditions glyph (`miniCards.js`) |
| Map | The choropleth with the four-measure switch; dots as a toggle |
| History | Small multiples (`smallLines.js`) with the rule changes as dashed rules, plus a roll call (`rollCall.js`): every hospital, every year; an absent year is blank, never "not cut" |
| Timeline | Paired with the data windows (`periods.js`) |
| Hospital: where the penalty came from | One ruler per condition (`ruler.js`): the peer group's distribution, the median tick, this hospital marked, the gap ("+0.004 over") and the modeled dollars per 0.01 |
| Hospital: what-if | Drives a waterfall; each condition's "escape value" (the ratio that reaches the median) and what it would save |
| Hospital: penalty history | Bars for the cut, plus percentile by year (`rankYears.js`): raw cuts aren't comparable across the 1 → 2 → 3% cap years. FY2027 carries "the measure changed" |
| Hospital: neighbors | The table, plus the kit's nearby map |

Where § Figures below names a picked form, it replaces the form in this table (the peer-group ridges, the
coin-flip reference, the type dots and the history roll call are not built).

## New analyses (beyond parity, in this order unless re-ordered)

Each carries its accuracy trap in its Methods note.

1. **How close was it?** The hospitals nearest the median (`acrossLine.js`), area = dollars, filled when over. Show 4
   decimals, never 2: CMS compares stored values.
2. **What is 0.01 of ratio worth?** base × payment weight × neutrality modifier × 0.01: a table on the hospital page,
   `contribBars.js` nationally. Modeled dollars; $0 at the cap; blank where the weight is missing.
3. **Is a penalty near-guaranteed?** The conditions-measured figure above. A flag can round to a 0% cut.
4. **Are small hospitals let off?** A funnel: ratio against discharges (log x), the median line, one panel per
   condition (a new chart). Ratios come from a shrinkage model, not raw rates; CMS publishes no intervals.
5. **Which stays caused this year's cut?** The overlapping performance windows, the COVID exclusion and the payment
   year (`periods.js`).
6. **Has this hospital ever escaped?** The roll call. CCN changes and mergers; blank, not "not cut".
7. **Did the hospital get better, or did the ruler change?** FY2026 → FY2027 movers (a transition grid; ratio slopes
   per condition), from the pinned FY2026 supplemental file; plus how many hospitals changed peer group. Medicare
   Advantage stays, the window change and the COVID stays coming back break comparability: label it "the measure
   changed", never "improved".
8. **Who pays the total?** A treemap by state or peer group of modeled dollars, with CMS's own total beside it.
9. **Hit twice?** HRRP, HACRP and HVBP for one fiscal year (`contribBars.js` per hospital, `agree.js` across
   hospitals). Align the years; HVBP is two-sided.
10. **What did peer grouping change?** Flags re-drawn against the national median, by group: only who flips; no
    counterfactual dollars.

Two more wait for data the repo doesn't pin yet: the penalty per excess readmission (Care Compare's HRRP dataset)
and the penalty against margin (cost reports).

## Switch-off and what comes later

On the build branch the new site owns `/hrrp/` and the hub stops drawing its slim Readmissions pages; nothing else in
the hub changes. Later steps: the browser features (explorer, search, what-if, worksheet picker, map switches), the
hub reading the emitted file and linking the new pages, the browser checks for these rows, the 40-page comparison,
and the old address's "moved" page.

## Figures

Drawn first with the real FY2027 data at both widths (about twenty forms for each figure whose form is new here),
before any is built. The forms below are the ones picked on 2026-11-05 from the options (the option id in brackets), amended from the
recommended set. Where the old site had a figure for the same question, its form is kept unless a row says otherwise.
Every figure keeps the frame: "Fig. N", a title, a one-line takeaway built from the data, the source line, and a
table holding every plotted value. Colors follow the family: the penalty ink only for what is over the line or cut,
grays for the rest, never color alone (every encoding is labeled or keyed).

What drawing the data showed, and the words must respect:

- A 1.0 line misjudges 140 of 2,624 heart-failure hospitals (66 penalized sit under 1.0; 74 over 1.0 are not), which
  is why Step 2 plots ratio − peer median.
- CMS's peer medians are not the medians of the hospitals in this file, so the share over the line runs 43–58% by
  group and condition: "about half", never "half".
- The coin-flip reference (1 − 0.5^k) is not a model of the data. At one or two conditions the gap below it is the
  lower flag rate; conditions moving together shows from three up. The words never claim independence and never
  credit the whole gap to co-movement.
- Each condition flags about half of its own measured hospitals by construction; the like-for-like pair for "which
  conditions cost the most" is the share of all flags against the share of dollars (both sum to 100%).
- "Are small hospitals let off?" depends on the condition: small hospitals are flagged less often on COPD and
  pneumonia and more often on heart attack, bypass surgery and hip/knee replacement.
- The roll call covers today's hospitals, so its yearly shares run above CMS's national share; its words say "of
  today's hospitals". "Cut every year it was in the file" and "cut in all years" are different counts.
- A condition under 25 cases can still carry a published ratio; it is not counted, and its dollars per 0.01 are blank.

| Figure | Encodings | Takeaway (from data) | Table | Phone |
|---|---|---|---|---|
| Step 2: each hospital against its own peer median [S2-09] | A quiet unit swarm of ratio − peer median for one condition, one dot per measured hospital, penalty ink past 0; the line named on the chart as the peer median; a lens below magnifying ±0.01 (a dot per hospital) with the counts just over and just under in words; the closest gap at 4 decimals; the example hospital's ▲. The old site's six-condition switch stays: one swarm per condition, heart failure shown first | "Of N hospitals measured on <condition>, X are over their own peer group's median; Y sit within 0.01 of it" | Bins of the difference (0.05 wide) with counts over and at or under, per condition | The same swarm in fewer, taller bins; the lens under it full width; clipped tails counted in a note |
| Step 5: the parts against the 3% cap, beside Worksheet R [WF-12] | Focus and context: the worksheet's six lines as rows on a named zoomed scale (wide label column), each zero row saying why (at or under the median, under 25 cases); the sum redrawn on the true 0–3% scale against the cap, with beams showing where the zoom sits; no broken axis | "N conditions add X%, about <fraction> of the 3% cap; <condition> alone is <share> of it" | Condition, part, running total; sum; cap; factor | Rows stacked with their words over the bars; the cap strip under them |
| The size of the cuts | The Step 2 swarm form on the cut (0 to 3%), the pile at zero labeled with its count | "Half of hospitals lose less than X%; Y lose 1% or more; Z hit the 3% cap" | Bins of the cut | As Step 2 |
| More conditions measured, more ways to be penalized [CF-11, no coin line] | Per number of conditions measured (1–6): the share cut as a dot (area = hospitals) with its 95% interval. No coin-flip reference and no words about it | "Measured on one condition, X% are cut; on five or six, Y%" | k, hospitals, cut, share, interval | Rows with the words over each track |
| Penalties by peer group [the old site's figure, ported] | The old site's strip plot: one row per peer group, a dot per hospital at its cut (0 to 3%), shaded by cut, each group's median cut as a thick tick | "Group 1 serves the fewest dual-eligible patients, group 5 the most. X% to Y% of each group's measured hospitals is cut; the lowest-dual group is cut least" (the shares from data) | Group, dual range, hospitals, share cut, median cut | The rows narrower; the axis ticks thinned |
| Penalties by hospital type [TD-10] | Each trait (teaching, ownership, size, urban/rural) as a range bar from its lowest to its highest group's share cut, sorted by spread, the spread in large type; the traits read as groups by a family color or a group rule and label; the row labels set vertical where the axis needs them | "<trait> spreads the share cut widest (X points, <lo> to <hi>); <trait>, only Y" | Trait, group, hospitals, share cut | Traits stacked, labels over the bars |
| Which conditions cost the most [PB-02] | The kit's paired bars fed the like-for-like pair: each condition's share of all flags against its share of modeled dollars (both sum to 100%) | "<condition> is X% of flags but Y% of the dollars" | Condition, flags, share of flags, dollars, share of dollars | Bars stacked under each label |
| Hospital: where the penalty came from [RU-02] | The kit's ruler (`ruler.js`), one per condition, each on its own peer group's scale (1st to 99th percentile) with its end labels: the distribution, the median tick, the hospital's ▲, the gap in the penalty ink when over; the exact ratio, median, gap, dollars per 0.01 and the modeled cut in columns at the right | "<condition> costs the most: +X over its median, $Y, because each 0.01 of its ratio is worth $Z" | Built in (the columns) | Each ruler's numbers over it |
| History [HI-09] | Small multiples, the share-cut line large with each rule change written in words at its point (the axis start said on the chart); the average cut and the estimated totals small beside it; family colors for the series, the penalty ink keeping its meaning; the COVID years shaded | "X% of hospitals are cut in FY<year>" | Year, hospitals, share cut, average cut, estimated total and its source | The panels stacked |
| Are small hospitals let off? (new analysis, only if ordered) [FN-08] | A small chart per condition of the share flagged in each size band (25–49 cases to 800+), plus a bar around each band's average showing the middle half of hospitals (25th to 75th percentile of ratio − peer median), labeled "middle half of hospitals": observed, not a CMS interval | "Against the largest size band, hospitals with 25–49 cases are flagged less often on <conditions> and more often on <conditions>" | Condition, size band, hospitals, share flagged, middle half | Six short panels stacked |
