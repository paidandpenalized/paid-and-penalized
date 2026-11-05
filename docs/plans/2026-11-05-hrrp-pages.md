# Readmissions pages — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `sites/hrrp/`, the family's Readmissions site at `/hrrp/`: the program page, 2,912 hospital pages,
the place pages, Methods, the CSVs and data dictionary and the share card, server-drawn from the emitted HRRP data,
with every parity row of the design note that doesn't need the browser.

**Architecture:** A program site in the HACRP site's shape (`sites/hacrp/` is the reference for every pattern named
here): one loader, pure view builders (data in, plain values out), copy tables with no digits, page renderers on the
shared shell (`web/render/`), figures from the family kit (`web/charts/`), and a generator manifest registered in
`pipeline/site/build.js`. The browser scripts (explorer, search, what-if, worksheet picker, map switches) come in the
next step; this plan draws everything they will drive.

**Tech Stack:** Node 22 ES modules, `node:test`; the existing build dependencies (esbuild, d3-scale, d3-array,
d3-format, d3-geo, topojson-client). No new dependencies.

**Spec:** `docs/specs/2026-11-05-hrrp-pages-design.md` (rows, figure forms, new analyses) and
`docs/specs/2026-11-05-hrrp-fold-in-design.md` (the data). Source for wording, helpers and their tests: Thirty Day
Readmissions at `33d195927241514a671ca34073a7d7870c555baf` (`web/src/js/`: `model.js`, `data.js`, `views/*.js`,
`charts/*.js`, and `web/test/*.test.mjs`). Read the source view before building its page part.

## Global Constraints

- Branch `hrrp-pages` in `.claude/worktrees/hrrp-pages`. No push, no PR. Commit identity is the repo's noreply
  `user.email`. Never commit `.claude/`.
- Sites import the engine and `web/`, never another site: nothing under `sites/hrrp/` imports `sites/hacrp/`. Copy a
  HACRP helper into `web/` (shared) only when both sites need it, and move HACRP onto it in the same task.
- No new dependencies. Name any install or download before running it.
- Every number in copy comes from the data through a placeholder. Copy tables hold no digit (the copy gate). Method
  constants (25 cases, the 3% cap, the five peer groups, the end dates and the outside figures Methods cites) live in
  `sites/hrrp/web/constants.js`, each with a claim id in `CLAIMS`.
- Ported files' header comment: `Ported from Thirty Day Readmissions (<path> at 33d1959).` Ported tests keep the
  source's expected strings.
- Test fixtures name no hospital: synthetic records (CCNs `990001`–`990099`, name `EXAMPLE GENERAL HOSPITAL`); tests
  on the real data pick rows by property.
- Words: no wrongdoer labels and none of the future words (`web/test/house-words.test.js`); "Readmissions" is the
  site's name; the byline is the family's.
- Colors only in `web/styles/tokens.css`. New mark classes go in `web/test/forced-colors.test.js`.
- Page budgets (already set): program 330 KB, hospital 120 KB, place 150 KB, Methods 100 KB, dictionary 50 KB.
- `SITE.sites.hrrp.released` stays `false` on this branch (every page `noindex`).
- `make test` green after every task. `make build` succeeds at every milestone's end.
- Every file is public: restate what you need; no private planning text, names or reasoning.

## Review Focus

1. A hospital with no measured condition, or measured but every condition at or below its median, or flagged on a
   condition whose cut rounds to zero → the verdict, stamp, rank line and Worksheet R each take their own variant,
   never "Cut 0.00%" (Task 3 and Task 9 tests, on records picked by property).
2. A hospital with `pen` null (no impact-file record), `star` null, `cbsa` null, `inactive` with no date, `bedsSrc:
   "cr"`, or a condition flagged with no published payment weight → its page builds with the right words and no
   "NaN", "undefined" or "null" text (Task 6 test over every such hospital in the data).
3. A place with no hospitals (Maryland, Puerto Rico, a territory) → no page and no link to one; a metro spanning
   states → one page, listed under each state it reaches with "(XX part)" (Task 4 tests).
4. Text from CMS or the content files containing `<`, `&` or a quote, a non-https link, or a CSV cell starting with
   `=`, `+`, `-`, `@`, tab or CR → escaped on the page, unlinked, guarded in the CSV (Task 3, Task 13, Task 17 tests).
5. The emitted file missing (a fresh clone before `make emit`, or a future year not yet emitted) → the loader reads
   the pin and the pages build the same (Task 1 test).

---

## Milestone 1: the site exists (every address, server-drawn words, no figures)

### Task 1: The loader (Sonnet)

**Files:** Create `sites/hrrp/web/data.js`, `sites/hrrp/test/data.test.js`. Modify `pipeline/files.js` (add
`hrrpPath(fy)` beside `hacrpPath`).

**Interfaces:**
- Produces: `loadHrrp({ exists = existsSync } = {}) → { source: 'emitted'|'pin', fy, meta, conditions, hospitals,
  history, whatsNew, timeline, research, master, shapes, manifest, pinsUsed, builtFiles, changedOn, cmsReleased }`.
  `hospitals` is the file's array, in file order. `whatsNew`, `timeline` and `research` are always read from
  `sites/hrrp/content/`. `master` is a `Map` of CCN → hospital master record (newest year). `shapes` are the state
  shapes from the family atlas pin (`web/charts/geo.js` `ATLAS_ID`, `stateShapes`). `pinsUsed` is the manifest
  entries named by the file's `sources`, the master's and the atlas.
- `hrrpPath(fy) → 'data/emitted/hrrp/fy<fy>/hrrp.json'`.

- [ ] Write tests: (a) with the emitted file present, `source === 'emitted'`, `hospitals.length === 2912`, `fy ===
      2027`; (b) with `exists: () => false`, `source === 'pin'` and the body (`conditions`, the hospital ids and every
      hospital's keys, `history.years`) equals the emitted read; (c) `whatsNew` equals `whats_new.json`'s `items` in
      both; (d) every `pinsUsed` id is in the manifest and includes `tdr-hrrp-fy2027` only when `source === 'pin'`;
      (e) `cmsReleased` is `meta.fileDate`, `changedOn` the newest `built_at` of the files read.
- [ ] Run `node --test sites/hrrp/test/data.test.js` → FAIL (module missing).
- [ ] Implement, following `sites/hacrp/web/data.js` (newest year via `newestYear('data/emitted/hrrp')`; the pin via
      `readPinned('tdr-hrrp-fy2027')`; master via `masterPath`).
- [ ] Run → PASS. Commit `Readmissions site: the loader (emitted file, else the pin)`.

### Task 2: Formatting and wording helpers, ported (Sonnet; Opus reviewer)

**Files:** Create `sites/hrrp/web/numbers.js`, `sites/hrrp/web/wording.js`, `sites/hrrp/web/copy.js`,
`sites/hrrp/web/constants.js`, `sites/hrrp/test/numbers.test.js`, `sites/hrrp/test/wording.test.js`.

**Interfaces:**
- `numbers.js` (TDR `model.js` semantics, built on `web/render/format.js` where its output is identical):
  `fmtPct(v, dp = 2)`, `fmtInt(n)`, `fmtMoney(x)` ($999, $12K, $1.2M, $120M, $1.2B), `fmtDate(iso, month = 'short')`,
  `roundTo(v, dp)`, `binIndex(v, lo, w)`, `factor4(x)`, `ratio(x, dp)`, `points(x)`. "—" for null or non-finite.
- `wording.js` (strings from `copy.js` keys, never literals): `plural(n, one, many)`, `upFirst`, `ordinal`,
  `inSentence(label)`, `noneMeasured(sm)`, `penalizedOfMeasured(sm)`, `vsLabel(a, b, dp, unit, word)`,
  `noEstimateNote(list)`, `rankLine(h, ctx)`, `summarySentence(h, meta, edition)` (the five variants and the
  inactive lead), `inactiveSentence(h, edition)`, `deckLead(sm, label)`, `penalizedNote(sm, nation)`.
- `copy.js` exports `COPY` (`{ key: { text, claim } }`, placeholders, no digits) and `{ fill, fillKeep, t }` via
  `copyOf` (`web/render/components.js`), as `sites/hacrp/web/copy.js` does.
- `constants.js`: `NTAP_TOTAL`, `NTAP_SHARE`, `PARHM_END`, `ROUND_COUNT_TO` (the "about 2,900" rounding), each in
  `CLAIMS` with an `HRRP-NN` id.

- [ ] Port the source tests for these helpers from `web/test/model.test.mjs`, `review.test.mjs` and
      `hospital.test.mjs` (`plural`/`upFirst`/`penalizedOfMeasured`, `noneMeasured`, `noEstimateNote`, the formatters,
      `rankPct` wording, `inSentence`, `vsLabel`, `binIndex`, the verdict sentence's variants, the inactive sentence,
      `ordinal`), with synthetic records. Keep the source's expected strings.
- [ ] Run → FAIL.
- [ ] Implement. Where the source's string differs from the family's format (minus sign, thin spaces), keep the
      source's and say so in a comment.
- [ ] Run → PASS. Commit `Readmissions site: formatting and wording helpers, ported with their tests`.

### Task 3: Copy gate and claims register for two sites (Sonnet)

**Files:** Move `sites/hacrp/test/copy-gate.test.js` → `pipeline/test/copy-gate.test.js`. Create
`sites/hrrp/CLAIMS.md` (its first rows: the program rules the M1 copy states). Modify the HACRP test imports.

**Interfaces:** `CLAIM_PREFIX = { hacrp: 'HACRP', hrrp: 'HRRP' }`. A copy file under `sites/<id>/` may cite only
`<PREFIX>-NN` ids, each resolving to a checked row of `sites/<id>/CLAIMS.md`; shared copy (`web/`, `hub/`) may cite
either; every register row is used by its own site; each site's `constants.js` `CLAIMS` holds well-formed ids.

- [ ] Tests: the HACRP assertions unchanged, plus the same per site; an `HRRP-` id in a HACRP copy file fails; a row
      unused by HRRP fails.
- [ ] Register rows with an https primary source (law, CFR, Federal Register, CMS) and a quote of 25 words or fewer,
      checked today: the 25-case minimum, the 3% cap, the five peer groups by dual share, the neutrality modifier, the
      payment weight, the six conditions, the payment year, Medicare Advantage stays from FY2027, Maryland's exemption,
      who is out of the program. Every cited URL goes in its "## Link check" table (fetch each, read-only).
- [ ] Run `make test` → PASS. Commit `Copy gate covers each site's own claims register; Readmissions register begun`.

### Task 4: Places and paths (Sonnet)

**Files:** Create `sites/hrrp/web/links.js`, `sites/hrrp/web/places.js`, `sites/hrrp/test/places.test.js`.

**Interfaces:**
- `links.js`: `PROGRAM_PATH` (`SITE.sites.hrrp.path`), `HOSPITALS_PATH`, `hospitalPath(ccn)` (lowercase),
  `KINDS = ['region','division','state','metro']`, `placePath(kind, key)`, `METHODS_PATH`, `DICTIONARY_PAGE`,
  `csvPath(fy, name)` (`/data/hrrp/fy<fy>/<name>.csv`), `DOLLARS_HREF` (`/hrrp/methods/#methods-dollars`).
- `places.js`: `buildPlaces(hospitals, meta) → { list, byKey: Map('kind:key' → place), of(h) → [region, division,
  state, metro|null] }`. A place is `{ kind, key, name, path, hospitals, parent, children, states }`. Keys: region and
  division by `slug(name)` (`engine/js/hrrp/filters.js`), state by lowercase code, metro by CBSA. A metro's parent is
  the state with most of its hospitals (ties: the first code); it is listed under every state it reaches. A place with
  no hospitals is not built.

- [ ] Tests on the data: 4 regions, 9 divisions, 50 states (no `md`, no `pr`), 406 metros; the region slugs are
      `northeast`, `midwest`, `south`, `west`; a multi-state metro (picked by property) is a child of each of its
      states; every hospital's `of(h)` resolves; `scopeFilter` (engine) selects the same hospitals as each place.
- [ ] Run → FAIL. Implement. Run → PASS. Commit `Readmissions site: places and paths`.

### Task 5: Registration and the switch-off (main thread)

**Files:** Modify `web/site.js` (`SITE.sites.hrrp = { path: '/hrrp/', released: false, title: 'Readmissions',
subtitle: 'HRRP' }`), `pipeline/site/build.js` (`SITES = [HACRP, HRRP, HUB]`), `tools/ci/page-types.js`
(`PROGRAM_SITES` gains `hrrp`; the interim `hrrp`/`hrrpHospital` types go), `tools/ci/size-budget.js` (interim
budgets go), `hub/pages.js` (stop emitting the slim Readmissions pages; delete `hub/hrrp/` and its tests),
`tools/e2e/site.js` (drop the interim samples; add the new site's: program, one hospital each of cut / no cut / no
estimate, one place of each kind, Methods), `pipeline/test/helpers.js` `testAssets` (an `hrrp` sheet), and the tests
that list these (`tools/test/page-types.test.js`, `tools/test/size-budget.test.js`, `web/test/programs.test.js`,
`hub/test/promises.test.js`, e2e consumers that named the interim samples). Create `sites/hrrp/web/generate.js`
(manifest `HRRP = { id: 'hrrp', entries: {}, styles: [...KIT_STYLES, 'sites/hrrp/web/styles.css'], generate }`) and
`sites/hrrp/web/styles.css`.

**Interfaces:** `generateHrrp(ctx, { data = loadHrrp(), released = SITE.sites.hrrp.released, log } = {}) → {
updated: { cmsReleased, changed } }`. Before writing anything it checks the formula reproduces CMS's factor for every
hospital (`engine/js/hrrp/formula.js` `contrib`) and throws naming the first that doesn't.

- [ ] Keep the program's `stage` as it is (the hub's own switch is a later step). The hub's links to
      `/hrrp/hospital/<ccn>/` keep working: the new site emits a page for every CCN the hub marks.
- [ ] Test: the page-types table maps `/hrrp/`, a hospital, a place of each kind, Methods and the dictionary to
      program-keyed types with program `hrrp`; a build with a stub generator (a single program page) passes
      `pipeline/test/site-build.test.js`.
- [ ] Run `make test` and `make build` → PASS. Commit `Readmissions site registered; the hub's slim pages switched off`.

### Task 6: Every page, words and record cards (Sonnet; Opus reviewer for the rank and summary lines)

**Files:** Create `sites/hrrp/web/derive.js`, `sites/hrrp/web/view.js`, `sites/hrrp/web/pages/{parts,program,
hospital,place,methods}.js`, `sites/hrrp/web/{program,hospital,place,methods}/copy.js`, tests
`sites/hrrp/test/{derive,view,pages}.test.js`. Modify `generate.js`.

**Interfaces:**
- `derive.js`: `edition(meta, history) → { label, nYears, yearsWord, payShort, payLong, payStart, span, perfLong }`;
  `withDerived(h, meta) → { ...h, cx, flags, place }`; `capMarks(national)`; `meanCutByYear(list, years, paf)`;
  `exampleHospital(list)` (factor < 1, ≥ 3 flags, ≥ 150 beds, the median of those by cut; else the first);
  `nationOf(list)` (`summarize`).
- `view.js`: `hospitalView(h, ctx) → plain strings` for the record card, verdict, fields and rank line, following
  `sites/hacrp/web/view.js`; `placeView(place, ctx)` for the deck and the six-field card.
- Pages use `page()` (`web/render/layout.js`) with `shellOf` from `pages/parts.js` (the six Parts plus Methods, the
  `picture` Part labeled with the edition), `formField`/`formTitle`/`stamp` (`web/render/components.js`) for the
  record cards, the family search box markup (`web/render/shell.js` `searchForm`).

- [ ] Tests (fixtures): each verdict variant renders its sentence and stamp; the rank line's floor and 99 cap and
      "like N other hospitals"; the place deck's take/takes, "one hospital", none measured, the state rank ("the
      largest", "the Nth-largest"); the hero deck and the eight At-a-glance fields with their notes; Methods carries
      the kicker, heading, both formulas and the replication sentence; every page has its own title and description;
      the hospital and place breadcrumbs (the last crumb `aria-current`, region and division only when known); the
      hospital's "Report a problem" feedback link (`web/render/layout.js` `feedbackFor`); the family 404 carries the
      line on who isn't in the program (hub's `notFound`, a sentence from `program/copy.js`).
- [ ] Test (data): a build writes 1 program page, 2,912 hospital pages, every place page and Methods; no page's text
      has "NaN", "undefined", "null" or "[object Object]"; every page is within its budget.
- [ ] Implement; the generator emits every page (Methods last, with the page count).
- [ ] Run `make test` and `make build` → PASS. Commit `Readmissions site: every page, with its words and record cards`.

### Checkpoint M1 (main thread)

- [ ] `/simplify` on the milestone diff, then `make test`.
- [ ] `/code-review` on the diff; fix Critical/Important; repeat until clean.
- [ ] `/security-review` (CMS text and content files rendered on pages).
- [ ] `make build && make serve`: look at the program page, a cut / no-cut / inactive hospital, a state, a metro that
      spans states, Methods, at 360 px and 1280 px.

---

## Milestone 2: the program page's figures

### Task 7: Figure design pass (main thread)

- [ ] Read the dataviz skill. For each figure in the design note's table and new analysis 4 (the funnel), write its
      encodings, its takeaway variants (data-driven), its table columns and its narrow-width form into a "Figures"
      section appended to `docs/specs/2026-11-05-hrrp-pages-design.md`. Draw the Step 2 swarm, the funnel and the
      worksheet waterfall at both widths and look at them before any task builds them.
- [ ] Commit `Readmissions pages design: figure by figure`.

### Task 8: Part `how`, Steps 1–4 and the callouts (Sonnet)

**Files:** Create `sites/hrrp/web/figures/how.js`, `sites/hrrp/test/how.test.js`; modify `pages/program.js`,
`program/copy.js`.

- [ ] Tests: Step 1's punch card rows are the condition sets with their counts (sum = hospitals with any measured
      condition); Step 2's swarm plots `err − peer median` for the chosen condition, one dot per measured hospital,
      the example hospital marked, the six condition switches present (`aria-pressed`, heart failure on), the
      magnifier's ±0.01 band and its count; Step 3's bins are 1 point wide with the five bands and data cutoffs;
      Step 4's table has 5 rows labeled with the dual range and 6 columns at 4 decimals, collapsed (`<details>`);
      "New for" shows only when `whatsNew.fy === fy`; "Who is in the program" rounds the count to the hundred.
- [ ] Implement with `punchCard`, `scoreSwarm`, `columns`, `figure()`. Run → PASS. Commit.

### Task 9: Worksheet R and its waterfall (Sonnet; Opus reviewer)

**Files:** Create `sites/hrrp/web/worksheet.js`, `sites/hrrp/test/worksheet.test.js`; modify `figures/how.js`.

**Interfaces:** `worksheetRows(h, meta) → { fields: [A, B, C], lines: [{ cond, n, err, med, excess, weight, part,
reason|null }], totals: { sum, capped, factor }, cms: { factor, matches, diff } }`; `worksheetHtml(rows, { compact,
dollars })`.

- [ ] Tests: on every hospital in the data, `totals.factor` equals CMS's `paf` (2,912/2,912); a sliver prints
      "< 0.0001"; each reason string ("no cases", "under 25 cases", "at or below median", "rounds to the median; CMS
      counted it", the missing-weight text); line 8 is capped at 3% and rounded; the dollars line only when not
      compact; the waterfall's parts sum to line 7 and its cap line sits at 3%.
- [ ] Implement (`waterfall.js` for the figure). Run → PASS. Commit.

### Task 10: Part `picture` (Sonnet)

- [ ] Tests: the lede's median cut, count at 1%+ and count at the cap from the data; the swarm has one dot per
      hospital and the zero pile's count; the conditions-measured figure's observed share per k against
      `1 − 0.5^k`, with no independence claim in its words; paired bars share-penalized vs share-of-dollars per
      condition, sorted by share; ridges per peer group with share penalized; type dots for the four blocks (bed
      bands, three ownership classes, empty groups hidden); the largest-penalties table (top 10 by cut, then dollars)
      with the six-cell glyph and its CSV (`largest-penalties.csv`, the hospital CSV's columns).
- [ ] Implement with `scoreSwarm`, `shareDots`, `pairBars`, `ridges`, `miniCards`. Run → PASS. Commit.

### Task 11: Part `map` (Sonnet)

- [ ] Tests: four server-drawn measure maps (one shown, three `hidden` for the browser switch), five bins applied
      to the rounded shown value, no color where nothing is measured, Maryland's and the missing states' words, the
      dot layer present and off; "Every state" sorted by average cut, 15 per page, its 8-column CSV with the counts;
      "Browse by region" links every division and state page.
- [ ] Implement with `usMap` (and `usPoints` for the dots). Run → PASS. Commit.

### Task 12: Parts `history`, `explore` and `research` (Sonnet)

- [ ] Tests: the small multiples (share penalized, average cut penalized and all, estimated totals with CMS and KFF
      sources and the "no total for" years) with the cap steps from the data, the FY2019, FY2023 and FY2027 marks
      and the COVID band; the roll call (blank for an absent year); the timeline (future years marked, only https
      links) with the data-windows chart; the explorer's filter controls and empty table shell pointing at the
      hospitals asset (`ctx.asset`, rows out of the HTML); the research findings grouped by theme with their cites.
- [ ] Implement with `smallLines`, `rollCall`, `periodsChart`. Run → PASS. Commit.

### Checkpoint M2 (main thread)

- [ ] `/simplify`, `make test`, `/code-review`, `/security-review` (the content files' text and links); fix and
      repeat until clean. Visual review of the program page at 360 and 1280 px, light and dark.

---

## Milestone 3: hospital and place figures

### Task 13: Hospital figures (Sonnet; Opus reviewer for the what-if numbers)

- [ ] Tests: one ruler per measured condition with the peer group's distribution, the median tick, the hospital's
      mark, the gap ("+0.004 over") and the modeled dollars per 0.01 (blank where the weight is missing, $0 at the
      cap); the cap note only when the sum passes 3.00; the what-if's server state equals `whatIfPaf` at the actual
      ratios (step 0.001; each slider's range from `sliderRange`, widened to hold the ratio; Reset and "Bring all to
      median"; "nothing to simulate"); history bars with the program average and "penalized in X of N years", plus
      the percentile by year, with "the measure changed" on FY2027; the full worksheet in a `<details>`; neighbors
      (more than one only, current row marked, cut descending, its CSV) with the nearby map.
- [ ] Implement with `ruler`, `web/whatif/render.js` `renderWhatIf`, `rankYears`, `areaMap`. Run → PASS. Commit.

### Task 14: Place figures (Sonnet)

- [ ] Tests: the area map (a metro's other in-state hospitals faint); the size of the cuts, area against the nation
      as an outline, both as shares; conditions with the national tick; peer groups ("none" for an empty group);
      average cut over time, area against all; the child table (25 per page; a state's "Outside metro areas" row
      unlinked; none on metro pages) and its CSV; the hospitals table shell with the state filter only when the
      place spans states.
- [ ] Implement with `placeMap`, `compareHist`, `smallLines`. Run → PASS. Commit.

### Checkpoint M3 (main thread)

- [ ] `/simplify`, `make test`, `/code-review`, `/security-review`; fix and repeat until clean. Visual review.

---

## Milestone 4: Methods, data files, share card

### Task 15: Methods in full (Sonnet)

- [ ] Tests: the accuracy line (dropped without the dollar check); the assumption rows (the fixed rows; the
      Pennsylvania rural model row while it runs into the payment year; the inactive and no-estimate rows when any;
      the MDH row with its end date and the largest shortfall); the 14-term glossary; the sources table lists exactly
      `pinsUsed` with hash prefix and size; the `methods-dollars` id; the privacy claims.
- [ ] Implement. Run → PASS. Commit.

### Task 16: The CSVs and the data dictionary (Sonnet)

- [ ] Tests: `hrrp-fy2027-hospitals.csv` with the source's 31 columns and units in the headers (via
      `engine/js/csv.js` `toCsv`: CRLF and a trailing CRLF; injection guard; the CCN as text); beds source words;
      inactive date or "date not listed"; penalized Y/N blank under 25 cases; the area CSVs' 8 columns;
      `DATA-DICTIONARY.md` lists every column (a test keeps them in step); the dictionary page renders it.
- [ ] Implement. Run → PASS. Commit.

### Task 17: The `/hrrp/` share card (main thread; uses the installed Chrome)

- [ ] Add `hrrp` to `web/share-card.js` `SHARE_CARDS` and `tools/og/card.js` `CARDS` (kicker, title, deck, three
      fields: penalized with % of measured, average cut penalized, at the 3% maximum; dots toned by `paf < 1`); run
      `npm run og`; commit the PNG and `web/og/stamp.json`. Run `make test` → PASS.

### Checkpoint M4 (main thread)

- [ ] `/simplify`, `make test`, `/code-review`, `/security-review` (CSV export); fix and repeat until clean.
      `make build`: all pages within budget, link check clean.

---

## Milestone 5: new analyses (in the design note's order)

### Tasks 18–27: one per analysis (Sonnet; Opus reviewer for 1, 2 and 7)

Each: its figure on the page the note names, its Methods note with its accuracy trap, tests for its numbers and its
trap (4 decimals for 1; blank weight and $0 at the cap for 2; no independence claim for 3; no interval claimed for
4; blank absent years for 6; "the measure changed", never "improved", for 7; CMS's total beside the treemap for 8;
aligned years for 9; flips only for 10). Analysis 7 reads the pinned FY2026 supplemental file through a new pure
reader in `engine/js/hrrp/` (or an emitted field with its methods-log heading). Commit each.

### Checkpoint M5 (main thread)

- [ ] `/simplify`, `make test`, `/code-review`, `/security-review`; fix and repeat until clean.

---

## After this plan

The browser scripts (explorer, search, what-if, worksheet picker, map switches, the Step 2 condition switch), the
hub's switch to the new pages and the emitted file, the program's `stage`, the browser checks for these rows, the
40-page comparison and the old address's "moved" page.
