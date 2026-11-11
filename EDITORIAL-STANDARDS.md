# Editorial standards

How Paid & Penalized words and shows what it publishes. Each section says which pages it covers. Tests enforce the
rules a test can check: the house word list (`web/test/house-words.test.js`) and the copy gate
(`pipeline/test/copy-gate.test.js`: no digits in copy, every sourced sentence tied to a checked claim). A person
checks the rest before each launch (`LAUNCH-CHECKLIST.md`).

## What kind of number it is

On every page, each number is one of these, and the page says which:

- **CMS's value**, shown exactly as CMS published it. It carries no label.
- **Recomputed**: "This site recomputes". The site's arithmetic on CMS's files, tested to equal CMS's value wherever
  CMS publishes one.
- **Estimate**: dollars the site works out from CMS's files, labeled "Estimate", with how it is worked out on Methods.
- **Scenario**: what a policy could do under stated assumptions. Every scenario number carries the tag
  `SCENARIO · 2023 $` (the year is the one its dollars are in), and its charts are labeled "Hypothetical". The one
  exception is the family footer's Programs list, where the range sits on one line with the word "scenario" and its
  full meaning, with the year of its dollars, is the figure's title and hidden words for screen readers.
- **Measured**: a number read from a hospital's own cost report, tagged `MEASURED` with "as filed" or "settled",
  the report's status in the CMS file the page was built from.

No number in the pages' words or code is typed by hand: each comes from data, except method constants and stated
tolerances.

## House words

On every page:

- The pages say "CMS reports" and "this site recomputes"; never that a hospital was "caught", "failed", "dodged" or
  "cheated", and never "worst hospitals".
- The standard line for a penalty: "A penalty reflects how CMS's formula scored relative performance; it is not a
  verdict on the quality of care." The Hospital-Acquired Condition pages carry it, and the family's hospital pages
  (`/hospital/<ccn>/`) a close wording of it.
- Every page links the general feedback form. Verified errors are corrected and logged in `corrections/`. No page
  promises a reply or fix time.

## Politically sensitive sites

These rules apply to sites about contested policy, such as the Medicaid work requirement:

- **A scenario is never a payment.** It is never added to a payment, a net or any program's dollars. On a hospital's
  page it sits in its own band, "Medicaid scenario (not a payment)", apart from the Medicare net.
- **Ranges, never a single number.** Every headline runs from the low case to the high. The middle case is the default
  drawing, not a forecast of what is most likely. Where a government projection exists, a small note shows which
  case it sits nearest; it is not the headline.
- **Neutral verbs.** Enrollment and revenue "decline" or are "reduced", and people "lose coverage". No "cut", "take",
  "remove" or other words that give the policy or a state a motive. (The Medicare program pages say "cut" for a
  payment reduction a program applies by rule.) The law is named by its public law and section number; others'
  report titles are quoted as published.
- **Limits stated.** Methods gives every step and parameter, what the method can't tell you, and how far the totals
  move under other choices. A hospital or state the method doesn't cover shows the reason, never a number: no $0,
  no blank bar.
- **Sources quoted and dated.** Each sentence that states a fact about the law or a program has a row in the site's
  claims register (`sites/<site>/CLAIMS.md`): the primary source, a short quotation and the date it was checked.
  Source files are pinned with their SHA-256 (`data/pinned/manifest.json`), their terms are in `DATA-TERMS.md`, and
  each page closes on the date of every source it uses.

## Named hospitals

These rules apply to the scenario and finance pages: the work-requirement site and the sites built after it.

- **The same rule for every hospital.** No hospital is singled out by hand.
- **A named hospital appears only** when a reader looks it up (Find, or its page), when a reader picks it (a click in
  a chart, a random pick), or in a table sorted by share and collapsed until the reader opens it. A table sorted by
  share orders hospitals by the share of their own revenue, largest first, then by name, so size alone puts no
  hospital at the top. A page that needs one hospital to show its method opens on one picked at random, never one
  chosen for its result.
- **No published top or worst lists**, and no ranked headline about a hospital. A table that lists every hospital
  sorts alphabetically or by state; a reader may re-sort any table.
- **Words.** A hospital is "exposed", never "worst". Where a number rests on few cases, the page says so.
- **States are not covered by this rule.** States may be compared and ranked.

## Medicare or all-payer

These rules apply to the same scenario and finance pages.

Every chart's caption says whether its numbers are "all-payer" or "Medicare", and a chart with both says both. A
hospital's cost report is filed with Medicare but covers every payer: its patient revenue, margins and
uncompensated care are all-payer. Penalties, program dollars and inpatient pay are Medicare. "Medicare cost report"
names the source, not the payer, so it doesn't meet this rule. Charges are never shown as payments.
