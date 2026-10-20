# P2b: the FY2026 HACRP page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static, prerendered HACRP site: `/hacrp/` (program page) and `/hacrp/hospital/<ccn>/` for all 3,055
hospitals in CMS's FY2026 file, with the what-if calculator, figures, a state view, a CSV download and a claims
register. It is built by `make build` into `dist/`, with acceptance test A1 enforced at build time.

**Architecture:** Pages are HTML strings rendered at build time in Node from the committed emitted data
(`data/emitted/hacrp/fy2026/hacrp.json`), the hospital master (`data/emitted/hospital/fy2027/hospital_master.json`)
and CMS's footnote crosswalk. Charts are SVG drawn at build time with d3-scale, so they show without JavaScript.
Browser JavaScript (the what-if, table toggles, theme toggle) is bundled by esbuild from the engine's own modules,
so the browser and the build share one copy of the formulas. Shared page parts live in a new top-level `web/`; the
HACRP site's pages, copy and claims live in `sites/hacrp/web/`; a stub root, `/methods/` and the 404 page live in `hub/`.

**Tech Stack:** Node ≥ 22 (`node:test`), esbuild 0.28.2, d3-scale 4.0.2, d3-array 3.2.4, d3-format 3.1.2 (exact pins,
dev dependencies, build time only). No browser framework.

**Spec:** this plan is the public spec. It restates the site brief and the family standards (chart standard, what-if
standard, design tokens), all approved before this session. Decision IDs in brackets (ARCH-11, DES-29, …) refer to
the project's decision register.

**Session scope (one long session, subagent-driven):** M1 static pages → M2 what-if → M3 figures, state view,
CSV, claims register. **Out of this session, next:** Tier-1 pages and copy (methods, terms, privacy, corrections,
about, accessibility), Playwright + axe + size budget in CI, the Cloudflare Workers Builds preview (needs the
owner's OK), dollar estimates (DATA-A-05; the what-if shows the cut as a percentage until then), history (FY2015–25
archives; past-cutoff ticks on the ramp wait for it), the hub's directory and search, `/hospital/<ccn>/`.

## Global Constraints

- **Anchor on CMS.** Pages show CMS's published text for every CMS value (CMS's decimals, never re-rounded), with
  the hyphen-minus replaced by a true minus (−) for display only.
- **No hand-typed numbers.** Copy files (`sites/hacrp/web/copy.js`, `hub/copy.js`) contain no digit characters; every
  number arrives through a `{placeholder}`. Method constants live in `sites/hacrp/web/constants.js`, each with a
  claim id: `REDUCTION_PCT = 1`, `CUTOFF_PERCENTILE = 75`, `WINSOR_LOW = 5`, `WINSOR_HIGH = 95`.
- **Fixtures name no hospital.** Tests use synthetic hospitals (CCNs `990001`–`990099`) or pick pinned rows by property.
  Plan text, tests and comments never name a real CCN.
- **Words** (DES-25): "CMS reports" for CMS values; "this site recomputes" for ours; never "caught", "failed",
  "dodged", "worst-performing", "should", "could have avoided". Say "above the line" or "above the 75th percentile".
- **Standing line** on every page that shows a flag, verbatim: "A penalty reflects how CMS's formula scored
  relative performance; it is not a verdict on the quality of care."
- **What-if standing line** under every what-if, verbatim: "A what-if shows the formula's arithmetic, not what a
  hospital could realistically change or how. CMS's real result also depends on other hospitals."
- **The line** is shown as the boundary in CMS's decisions, never as a recomputed percentile: "Among hospitals with a
  Yes or No payment decision, CMS cut those with a published Total HAC Score of {lowestYes} or higher and none at
  {highestNo} or lower. Maryland's hospitals are scored but not subject to the reduction." Values are CMS's published
  text of the scores at `model.boundary`. (Amended in M1: the unscoped wording was false for Maryland.)
- **Counts** (DATA-X-02): sentences about penalties use hospitals with a Yes/No decision; sentences about scores use
  scored hospitals. Both counts come from data.
- **Footnotes:** CMS's text from the pinned crosswalk, verbatim. A code with no crosswalk text fails the build.
- **Odd rows:** Maryland (score, decision "N/A"), no-score rows, and the one row reading "Yes" with no score: show
  CMS's values and footnotes verbatim and add no inference. No what-if on the last two; Maryland's what-if moves the
  score only.
- **Default sort** alphabetical within state; the reader may sort by any column. No top/worst lists, no ranked
  headlines, nothing that lists hospitals by closeness to the line.
- **URLs** (ARCH-11): `/hacrp/`, `/hacrp/hospital/<ccn>/` (CCN lowercase, trailing slash). Canonicals use
  `https://paidandpenalized.org`. No FY in URLs. Fragment-only state (`#…`) for the what-if and the state filter.
- **Indexing** (ARCH-13, ARCH-22): every build is `noindex` unless `PP_ENV=production`; a site with
  `released: false` in `web/site.js` stays `noindex` and out of the sitemap even then; no-score hospital pages are
  always `noindex`.
- **Byline** (EDIT-07): "Built by Dalton Haslam, MD, MBA" in the page header; "Built with Claude Code" in the footer.
  Footer also: "Uses public data from the Centers for Medicare & Medicaid Services (CMS) and shows no patient
  information. Not affiliated with or endorsed by CMS." and the feedback link (the project's Google Form responder URL,
  `https://docs.google.com/forms/d/e/1FAIpQLSekdB41siZs44_4gLNBGD2OqalK2TGNk7o8Q0bHl20ggYBy_Q/viewform`).
- **Design tokens** (DES-13/16): as in the landing page's `styles.css`; only `web/styles/tokens.css` may contain a hex
  color. Fonts self-hosted woff2 (Alfa Slab One 400; Libre Franklin 400/600/700; IBM Plex Mono 400/700).
- **Dark mode** (DES-17): follows the device; a toggle works for the visit and is never stored.
- **Charts** (DES-31): every figure has "Figure N." plus a one-sentence takeaway built from data, a source line
  ("CMS Provider Data Catalog, HACRP FY{fy} (yq43-i98g), released {pdcReleased}."), and a "Show table" toggle with
  every plotted value and a CSV download. "This hospital" = ▲ under the axis in `--ink` with a label. No pie, no dual
  axis.
- **Accessibility:** WCAG 2.2 AA. The what-if result is an `aria-live="polite"` region; sliders carry `aria-valuetext`.
- **No network at build or in tests.** Escaping: every interpolated string is HTML-escaped by default; JSON in
  `<script>` escapes `<`.

## Review Focus

1. **Hostile or odd text in CMS or master fields** (an `&`, `<`, quotes in a hospital name): it must render as text,
   never markup, in HTML, JSON-in-script and CSV. Tests in Tasks 3 and 13.
2. **A tampered or stale what-if link** (`#whatif&CLABSI=abc`, a measure the hospital lacks, a huge or negative value,
   a repeated key): the page opens on CMS's values with no error, ignoring the bad part. Test in Task 8.
3. **A hospital with one measure, or whose only measures are CMS-assigned:** the "largest contribution" sentence and
   the solver must not point at an assigned score. Tests in Tasks 5 and 8.
4. **A hypothetical score inside the band around the line:** reads "too close to call", never Yes or No, and the solver's
   answer lands on "No". Test in Task 8 (sentences) against the engine's existing guarantees.
5. **A CSV cell that begins with `=`, `+`, `@` or a tab** (formula injection in spreadsheet apps): text fields get a
   leading `'`; numeric fields keep their sign. Test in Task 13.

---

## Milestone 1: static pages

### Task 1: pin CMS's footnote crosswalk

**Files:** Create `data/pinned/pdc-footnotes/Footnote_Crosswalk.csv`, `engine/js/footnotes.js`,
`engine/js/test/footnotes.test.js`. Modify `data/pinned/manifest.json`, `NOTICE` (if it lists inputs).

**Interfaces:** Produces `parseFootnotes(csvText: string) → Map<string, string>` (code → CMS text) and
`footnoteText(map, code) → string` (throws `RangeError` naming the code when absent).

- [ ] Copy the file the session already downloaded (3,456 bytes, SHA-256
  `5214e1468fb04c5cdeac8920f2c446cccaa65e2f6f929424cd228042a52d963e`) from the copy the session downloaded (path given in the task prompt). Manifest entry:
  `id: "y9us-9xdf"`, title "Footnote Crosswalk (Provider Data Catalog)", `downloadUrl`
  `https://data.cms.gov/provider-data/sites/default/files/resources/f29bb7c812e242f6edfef0a4b7d0eaca_1760630713/Footnote_Crosswalk.csv`,
  `landingPage` `https://data.cms.gov/provider-data/dataset/y9us-9xdf`, `pdcModified` `2025-09-18`, `pdcReleased`
  `2026-08-13`, `retrieved` `2026-10-20`.
- [ ] Failing tests: the pinned file parses; every footnote code in the emitted HACRP file (value, z, total and
  payment-reduction footnotes, including `a`) has text; `footnoteText(map, 'zz')` throws.
- [ ] Implement with `parseCsv`; trim nothing inside the text. Run `npm test` and the Python suite (its pin test reads
  the manifest). Commit.

### Task 2: dependencies, build orchestrator, assets, local server, CI

**Files:** Modify `package.json`, `Makefile`, `.gitignore` (add `dist/`), `.github/workflows/ci.yml`, `CLAUDE.md`
(layout + commands + "dependencies: build time only"). Create `package-lock.json`, `pipeline/site/build.js`,
`pipeline/site/assets.js`, `pipeline/site/serve.js`, `web/site.js`, `web/styles/{tokens,base,components}.css`,
`web/fonts/*` (6 woff2 + 3 OFL texts, copied from the landing page), `web/favicon.svg`,
`pipeline/test/site-build.test.js`.

**Interfaces:**
- `web/site.js`: `export const SITE = { name: 'Paid & Penalized', origin: 'https://paidandpenalized.org',
  feedbackUrl, sites: { hacrp: { released: false, maintenance: null, title: 'Hospital-Acquired Conditions',
  subtitle: 'HACRP' } } }`.
- `pipeline/site/assets.js`: `buildAssets({ outDir, entries }) → Promise<{ css: string, js: Record<string,string> }>`:
  bundles `web/styles/*.css` (tokens first; the dark block duplicated under `:root[data-theme="dark"]` as TDR's
  build does) and each JS entry with esbuild (`format: 'esm'`, `minify`, `target: 'es2020'`), writes them to
  `dist/assets/` with an 8-hex content hash in the name, copies fonts and favicon, and returns the public paths.
- `pipeline/site/build.js`: `build({ outDir = 'dist', env = process.env.PP_ENV }) → Promise<{ pages: number }>`;
  empties `outDir`, calls `buildAssets`, then each page generator registered in a list (hub and hacrp, from later
  tasks). CLI when run directly.
- `make build` → `node pipeline/site/build.js`; `make serve` → `node pipeline/site/serve.js` (node:http, static from
  `dist/`, `127.0.0.1:8080`, directory → `index.html`, unknown path → `404.html` with status 404).

- [ ] **Install (flagged and approved 2026-10-20):** `npm install --save-dev --save-exact esbuild@0.28.2 d3-scale@4.0.2
  d3-array@3.2.4 d3-format@3.1.2`. Run `npm audit` and record the result in the commit message.
- [ ] Failing test: `build({ outDir: tmp })` writes `assets/*.css` containing `--pen` and the six font files; no file
  under `web/` other than `tokens.css` matches `/#[0-9a-fA-F]{3,8}\b/` in CSS or JS (charts can't add a color).
- [ ] Implement. CI: add `npm ci` before `npm test` and a `make build` step after it; keep SHA pins, read-only token,
  no `${{ }}` in `run:`. `tools/test/workflow.test.js` must still pass. Commit.

### Task 3: page kit: escaping, formatting, layout

**Files:** Create `web/render/html.js`, `web/render/format.js`, `web/render/layout.js`, `web/client/theme.js`,
`web/test/render.test.js`. Modify `package.json` test glob to include `web/test/**/*.test.js` and `hub/test/**`.

**Interfaces:**
- `html` tagged template → `Safe` (escapes every interpolation unless it is `Safe`; arrays joined); `raw(s) → Safe`;
  `escapeHtml(s)`; `jsonScript(id, value) → Safe` (`<script type="application/json" id>` with `<` as `<`).
- `format.js`: `cmsText(text) → string` (leading `-` → `−`); `count(n)` (`Intl.NumberFormat('en-US')`);
  `pct(x, dp)`; `signed(x, dp)` (true minus, `+` for positive); `longDate('07/01/2022') → 'July 1, 2022'`;
  `isoDate('2026-08-13') → 'August 13, 2026'`.
- `layout.js`: `page({ title, description, path, robots, body, scripts = [], jsonLd = null, assets }) → string`: full
  document with charset, viewport, canonical (`SITE.origin + path`), `<meta name="robots">` when `robots` is set,
  favicon, the CSS link, header (one-line wordmark: "Paid &" in `--ink`, "Penalized" in `--pen`, linking to `/`;
  the byline; a theme toggle button), `<main id="main">` with a skip link, and the footer (Global Constraints).
- `theme.js`: toggles `data-theme` on `<html>` for this visit only; no storage of any kind.

- [ ] Failing tests: `html\`<p>${'<a & "b">'}</p>\`` renders escaped; `jsonScript` output contains no `</script`
  even for a value holding it; `cmsText('-0.2580') === '−0.2580'`; `longDate` and `isoDate` as above; `page()`
  output has exactly one `<h1>`-free header, one `<main>`, the canonical URL, and the not-affiliated sentence;
  `theme.js` source contains no `localStorage`, `sessionStorage` or `cookie`.
- [ ] Implement; commit.

### Task 4: acceptance A1 as a build gate

**Files:** Create `engine/js/hacrp/acceptance.js`, `engine/js/test/hacrp/acceptance.test.js`.

**Interfaces:** `checkA1(hospitals, model, estimate) → { ok, a: { n, maxError, within }, b: { n, mismatches },
c: { [id]: { maxError, tagged } }, info: { pctAllScored, pctDecided } }`:
- (a) every scored hospital's mean published z equals its Total HAC Score within 0.0001 (`ok` needs ≥ 99%);
- (b) for every Yes/No hospital, `paymentReduction === (total > model.boundary.highestNo ? 'Yes' : 'No')` (`ok` needs
  zero mismatches);
- (c) copies `estimate` (informational; the emitted file already holds it);
- `info`: `percentileInc` at 0.75 over all scored totals and over Yes/No totals (printed, never used).

- [ ] Failing tests: on the pinned file `ok === true`, `b.mismatches === 0`; on a synthetic set where one "No" row is
  moved above the line, `ok === false` and the mismatch names that synthetic CCN.
- [ ] Implement; the build (Task 6) throws when `!ok` and prints `a`, `b` and `info`. Commit.

### Task 5: the hospital view model and its sentences

**Files:** Create `sites/hacrp/web/constants.js`, `sites/hacrp/web/copy.js`, `sites/hacrp/web/view.js`,
`sites/hacrp/web/sentences.js`, `sites/hacrp/test/view.test.js`, `sites/hacrp/test/sentences.test.js`,
`sites/hacrp/test/fixtures.js` (synthetic hospitals), `sites/hacrp/test/copy-gate.test.js`.

**Interfaces:**
- `copy.js`: `export const COPY = { <key>: { text: string, claim: string | null } }`; text uses `{name}` placeholders;
  `fill(key, values) → string` throws on a missing or unused placeholder.
- `view.js`: `hospitalView({ hospital, model, estimate, footnotes, master, fy, periods, released }) → HospitalView`:
  ```
  { ccn, name, city, state, county, path, indexable,
    status: 'yes' | 'no' | 'maryland' | 'no-score' | 'yes-no-score',
    total: { text, footnotes: [{ code, text }] } | null,
    decision: { text: 'Yes' | 'No' | 'N/A', footnotes: [...] },
    distance: { to: 'highestNo' | 'lowestYes', value, text } | null,   // 4 dp, signed; scored Yes/No only
    n, oneMeasure: n === 1,
    measures: [{ id, label, short, valueText, zText, assigned, tagged, maxErrorText, contribution, footnotes }],
    largest: { id, contributionText } | null,   // largest positive contribution among non-assigned measures
    whatIf: boolean }
  ```
  `status` from the decision and total; `indexable` is `total !== null`; measures in `MEASURES` order, unscored ones
  included with their footnotes; `largest` is null when no non-assigned measure contributes above zero.
- `sentences.js`: `summary(view, model) → string[]` (the plain-language top layer: what CMS reports, then why, in
  copy keys), `smallNumber(view) → string | null`, `distanceSentence(view, model) → string | null`.

- [ ] Failing copy-gate test: no `COPY` text and no `hub/copy.js` text contains a digit; every non-null `claim` matches
  `/^HACRP-\d{2}$/` (Task 14 adds the check that each resolves to a verified row of `sites/hacrp/CLAIMS.md`).
- [ ] Failing view tests on synthetic hospitals, one per status, plus: a one-measure hospital (`oneMeasure`); a
  hospital whose largest z is CMS-assigned (`largest` names a different measure, or null when all are assigned);
  total footnote on a scored hospital (shown); a tagged measure (`tagged`, `maxErrorText` from `estimate`).
- [ ] Failing sentence snapshot tests: the exact `summary()` output for each status and the edge cases above, written
  inline in the test. Sentences say "CMS reports …" for CMS values and "this site recomputes …" for the distance.
- [ ] Implement; commit.

### Task 6: hospital pages, program page, hub stubs, sitemap

**Files:** Create `sites/hacrp/web/data.js` (reads emitted data, master, footnotes, manifest), `sites/hacrp/web/pages/
hospital.js`, `sites/hacrp/web/pages/program.js`, `sites/hacrp/web/generate.js`, `hub/copy.js`, `hub/pages.js`,
`hub/test/pages.test.js`, `sites/hacrp/test/pages.test.js`. Modify `pipeline/site/build.js` (register generators,
write `robots.txt` and `sitemap.xml`).

**Interfaces:**
- `generate.js`: `generateHacrp({ outDir, assets, env }) → { pages: string[] }`: runs `checkA1` (throws when not ok),
  then writes `hacrp/index.html` and `hacrp/hospital/<ccn>/index.html` for every row.
- `hub/pages.js`: `generateHub({ outDir, assets, env, sitemap })` writes `index.html` (wordmark, tagline "Public
  Medicare data, made visible.", a link to `/hacrp/`; always `noindex` until the hub is built), `methods/index.html`
  (an `#estimate` section with the site's definition of "estimate" and an AI-use paragraph; draft copy for review),
  `404.html`, `robots.txt` (allow all, `Sitemap:` line), `sitemap.xml` (only indexable pages of released sites).
- Hospital page order: `<h1>` name; city, state · CCN; summary sentences; hero (Total HAC Score in Plex Mono ≥ 48px,
  decision pill: "1% cut" `--pen` / "No cut" neutral / "N/A" hatched, with words, never color alone); distance
  sentence; small-number warning; standing line; measure table (measure, CMS value, z-score, notes: footnote text,
  "assigned by CMS" note, estimate tag linking `/methods/#estimate`); as-of bar (FY, PSI 90 and HAI periods via
  `longDate`, "Latest public hospital results: FY{fy}; FY{fy+1} expected early {fy+1}", PDC released date); footnote
  legend; links to `/hacrp/` and to CMS's dataset page. Placeholder `<section id="whatif">` (Task 9 fills it).
- Program page: `<h1>` "Hospital-Acquired Conditions", subtitle "HACRP", dek "Infections and complications patients
  develop in the hospital."; what the program is; the six measures with plain names; the periods; the line sentence;
  counts (decided, Yes, scored); the standing line; that the line is relative (a hospital can be above it without
  getting worse); a name search linking to hospital pages (client script, Task 12 extends it); link-outs (CMS HACRP
  page, the PDC dataset, Care Compare, Leapfrog Hospital Safety Grade as "related, different"; each URL checked live
  in Task 14).
- Robots per Global Constraints; JSON-LD `WebPage` with `isBasedOn` the CMS dataset URL on hospital pages.

- [ ] Failing tests: the generator on the pinned data writes 3,055 hospital pages plus `/hacrp/`; every page has one
  `<h1>`; a no-score page carries `noindex` even with `env: 'production'` and `released: true`; with
  `released: false` every page carries `noindex` and `sitemap.xml` lists none; the Maryland page shows footnote `a`'s
  text and no distance; the "Yes with no score" row (picked by property) shows CMS's decision and footnote and no
  what-if section; no page contains the hyphen-minus before a digit inside a CMS value cell.
- [ ] Implement; `make build && make serve`; look at a Yes, a No, a Maryland and a no-score page in Chrome (light and
  dark, 375px wide). Commit.

### Checkpoint M1
- [ ] `/simplify` on the M1 diff → `make test && make build`.
- [ ] `/code-review` on the M1 diff; fix Critical/Important.
- [ ] `/security-review` (CMS text and names rendered into HTML; JSON in script). Minors go in Amendments.

## Milestone 2: the what-if (DES-29)

### Task 7: the median hospital

**Files:** Create `engine/js/hacrp/median.js`, `engine/js/test/hacrp/median.test.js`.

**Interfaces:** `medianHospital(model) → Hospital`: synthetic CCN `000000`, name null, each of the six measures at
`params[id].median` (rounded to `decimals`, `valueText` with them), `z = zFromValue(value, p)` rounded to 4 dp, `total =
totalFromZ(zs)` rounded to 4 dp, `paymentReduction = classify(total, model.boundary)`, empty footnotes.

- [ ] Failing tests: `whatIf(medianHospital(model), model)` returns `available: true` and no change; every z equals the
  fitted z of the median value to 4 dp; the result is "No" on the FY2026 model. Implement; commit.

### Task 8: what-if state, sentences, fragment

**Files:** Create `web/whatif/state.js`, `web/whatif/fragment.js`, `sites/hacrp/web/whatif-text.js`,
`web/test/whatif-state.test.js`, `web/test/fragment.test.js`, `sites/hacrp/test/whatif-text.test.js`.

**Interfaces:**
- `fragment.js`: `encode(changes) → string` (`#whatif&CLABSI=1.2&MRSA=0.9`, ids in `MEASURE_IDS` order);
  `decode(hash, { ids, params }) → { changes, rejected: string[] }`: keeps an id only if it is in `ids`, appears once,
  and parses to a finite number in `[0, 10 × params[id].cap]` (PSI-90 included), rounded to `decimals`.
- `state.js`: `initialState(hospital, model)`; `reduce(state, action)` with actions `set {id, value}`, `reset`,
  `median` (each non-assigned measure → `min(value, params[id].median)`), `predicted {id, count}` (local only; never
  in `encode`); `viewModel(state, hospital, model) → { result /* whatIf() */, solver: solveMeasure() per scored measure,
  ramp: { min, max, actual, hypothetical, highestNo, lowestYes }, inputs: [{ id, value, min: 0, max, step, median, cap,
  deadZoneFrom: cap, valuetext, assigned, tagged }], counts: { [id]: { delta } } }`. Slider `max` = `max(value, cap) ×
  1.2`; `step` = `10^−decimals`; `valuetext` e.g. "1.762, at CMS's cap"; count delta = `(after − before) × count`.
- `whatif-text.js` (copy keys in `copy.js`, no digits): `scenarioSentence(vm, hospital, model) → string`,
  `flagText(flag) → string` ("too close to call" for `too-close`), `solverRows(vm, model) → [{ id, label, answer, note }]`,
  `slideText(vm, hospital, model, view) → string` (before → after, sentence, "Hypothetical", source line, the
  what-if standing line).
  Sentences use "would", "had it been submitted" for an assigned measure, "rose"/"fell" by direction, and name the
  cap when a change lands in the dead zone ("Lowering MRSA to 1.800 would not change the score: CMS caps MRSA at
  1.762."). Maryland: score only, "N/A (not subject to the reduction)". The cut reads as a percentage (`REDUCTION_PCT`)
  until dollars ship; a too-close flag reads "0% or 1%".

- [ ] Failing tests: fragment round-trip; `decode` drops `abc`, a missing measure, `-1`, `1e9`, a duplicate key and a
  key outside `MEASURE_IDS`, and never throws; the NHSN count never appears in `encode`; `median` never worsens a
  measure and leaves assigned ones; sentence snapshots for: no change, one better change below the line, one worse
  change crossing it, a dead-zone change, an assigned "had it been submitted" change, two changes, too close to call,
  Maryland; solver rows for a flagged hospital (needed value; "not possible with this measure alone"), an unflagged
  one (cushion; "any value: CMS caps … at …"; "no cushion"), and an assigned measure (note, no answer).
- [ ] Implement; commit.

### Task 9: the what-if component on hospital pages

**Files:** Create `web/whatif/render.js` (build-time HTML), `web/whatif/dom.js` (browser), `web/styles/whatif.css`,
`sites/hacrp/client/hospital.js` (esbuild entry), `sites/hacrp/test/whatif-render.test.js`. Modify
`sites/hacrp/web/pages/hospital.js`, `sites/hacrp/web/generate.js` (entry registration, embedded data).

**Interfaces:**
- `renderWhatIf({ vm, hospital, model, texts }) → Safe`: the server-rendered initial state (CMS's values; works and
  reads correctly without JavaScript) inside `<section id="whatif">`; a per-measure number field and range slider
  (`aria-valuetext`, labels, helper text "SIR 1.0 = as many infections as predicted" for the five SIRs, "lower is
  better" for PSI-90), median and cap marks and the shaded dead zone; buttons Reset, Bring all to the national
  median, What would it take? / How much cushion?; beside each input its leverage (score change per 0.1, from
  `leveragePerTenth`) and the line "each measure weighs 1 ÷ {n} of the score"; the result box (before → after score, flag, the ramp SVG with a
  solid ▲ for CMS's score and a hollow ▲ labeled "Hypothetical", the cut as a percentage, the sentence, the word
  "Hypothetical" inside the box, estimate tag when a tagged measure changed) inside `aria-live="polite"`;
  contribution bars in fixed order; the solver table; the optional NHSN predicted-count field per SIR naming the
  HAI period ("stays in your browser; never sent"); Copy for a slide; the caption naming what is held fixed; the
  what-if standing line.
- Page data: `jsonScript('hacrp-hospital', { hospital, model, estimate })` per page (the hospital record only, not
  the file).
- `dom.js`: `mountWhatIf(root, { hospital, model, texts, share: boolean })`: reads the fragment (when `share`), wires
  inputs through `reduce`/`viewModel`, updates the DOM with `textContent` and attributes only (never `innerHTML`),
  debounces the live region by 400 ms, writes the fragment with `history.replaceState` (when `share`), shows the
  banner "Reader-made scenario, not CMS data." with a link to the clean page when a decoded fragment changed anything,
  scrolls a focused field into view on narrow screens, and respects `prefers-reduced-motion`.
- Phone: the result summary sits above the inputs, not sticky.

- [ ] Failing tests: the rendered HTML for a synthetic hospital contains one `aria-live` region, a slider per scored
  measure with `aria-valuetext`, "Hypothetical", both standing lines, no NHSN value in any URL or attribute; the
  no-score and "Yes with no score" views render no inputs; the browser bundle builds; `dom.js` source contains no
  `innerHTML`, `localStorage`, `fetch` or `XMLHttpRequest`.
- [ ] Implement; build; in Chrome: drag, type, reset, median, solver, a shared link (banner), keyboard only, 375px.
  Commit.

### Task 10: the sandbox on the program page

**Files:** Modify `sites/hacrp/web/pages/program.js`, `sites/hacrp/client/program.js` (new entry), tests in
`sites/hacrp/test/pages.test.js`.

- [ ] The same component on `medianHospital(model)`, labeled "a hypothetical hospital at the national median on
  every measure", `share: false`, no NHSN field. Failing test: the program page contains the sandbox and no fragment
  writer. Implement; commit.

### Checkpoint M2
- [ ] `/simplify` → `make test && make build`; `/code-review`; `/security-review` (the fragment is reader input).

## Milestone 3: figures, state view, downloads, claims

### Task 11: chart kit

**Files:** Create `web/charts/{axis,figure,ramp,contribBars,dotRange,histogram,tileMap,states}.js`,
`web/styles/charts.css`, `web/client/figure.js`, `web/test/charts.test.js`.

**Interfaces** (all build-time, pure, return `Safe`; scales from `d3-scale`, ticks/format from `d3-array`/`d3-format`):
- `figure({ n, takeaway, svg, source, claimLevel, table: { columns, rows }, alt }) → Safe`: `<figure>` with "Figure n."
  + takeaway, the SVG (`role="img"`, `aria-label` = alt), source line, claim level when not official, and a
  `<details>` "Show table" holding a sortable table; `web/client/figure.js` adds column sort and a CSV download built
  from the table.
- `axis({ scale, orient, ticks, format }) → Safe` (1px hairline, Plex Mono tick labels, `--ink-3`).
- `ramp({ domain, actual, hypothetical, band: [highestNo, lowestYes], width })`; `contribBars({ rows: [{ id, label,
  value, assigned }] })` (bars ≤ 24px, assigned hatched, fixed order); `dotRange({ value, floor, cap, median, label })`
  (range as a gray band, median tick, ▲ this hospital); `histogram({ values, bins, boundary, markLabel })` (bins
  above the boundary in `--pen`, others neutral; boundary annotated); `tileMap({ states: { [st]: { value, label,
  hatched } }, ramp })` with `states.js` holding the tile grid layout (50 states, DC, PR).
- Colors only via `var(--…)` and CSS classes; hatch via an SVG `<pattern>` using `currentColor`.

- [ ] Failing tests: each component's output for fixed synthetic input matches an inline snapshot; no output contains
  a hex color; `figure` always has a table with every plotted value; `histogram` puts each value in exactly one bin.
- [ ] Implement; commit.

### Task 12: figures on the pages, the hospital table and state view

**Files:** Modify `sites/hacrp/web/pages/{hospital,program}.js`, `sites/hacrp/client/program.js`, copy and tests.

- Hospital page: Figure 1 contribution bars (takeaway from `largest`); Figure 2 a dot-on-range per measure (the
  hospital's value against the national floor-to-cap range and median).
- Program page: the formula stepper on the median hospital (value → winsorized → z with CMS's fitted mean and SD →
  average → compared with the line; every number from `medianHospital` and `model`); Figure: histogram of Total HAC
  Scores of hospitals with a Yes/No decision, boundary marked, takeaway "CMS cut payments to {yes} of {decided}
  hospitals with a payment decision: those whose Total HAC Score was above its line."; Figure: state tile grid of
  hospitals cut / hospitals with a decision, Maryland hatched "not subject to the reduction"; the hospital table
  (name, city, state, Total HAC Score as CMS text, decision; default state then name; reader sort; state filter
  bound to `#state=XX`; name search) rendered by `client/program.js` from an embedded compact JSON array; without
  JavaScript, a link to the CSV.
- [ ] Failing tests: program page has the stepper with numbers equal to `medianHospital`'s; `#state=` decoding accepts
  only a state code present in the data; the table JSON's default order is state then name; no figure takeaway
  contains a hand-typed digit (all from data). Implement; build; look in Chrome. Commit.

### Task 13: CSV, data dictionary, citation

**Files:** Create `sites/hacrp/web/csv.js`, `sites/hacrp/DATA-DICTIONARY.md`, `sites/hacrp/test/csv.test.js`.
Modify `generate.js`, both pages (citation block + download link).

**Interfaces:** `hospitalsCsv(hospitals, master) → string` (RFC 4180, CRLF, UTF-8 without BOM; columns: `ccn, name,
city, state, county, total_hac_score, payment_reduction, payment_reduction_footnote, total_footnote`, then per measure
`<id>_value, <id>_value_footnote, <id>_z, <id>_z_footnote`, then `psi90_start, psi90_end, hai_start, hai_end`; CMS
text verbatim; `schema_version` stated in the dictionary). Written to `dist/data/hacrp/fy{fy}/hacrp-hospitals.csv` with
`DATA-DICTIONARY.md` beside it (ARCH-49). Citation block: site, page title, FY, canonical URL, the source line, and a
Copy button.

- [ ] Failing tests: row count equals the file's; parsing the CSV back with `parseCsv` round-trips every name; a
  synthetic name `=SUM(A1)` is written `'=SUM(A1)`; `-0.2580` stays `-0.2580`; every column is documented in the
  dictionary (test reads both). Implement; commit.

### Task 14: claims register and link check

**Files:** Fill `sites/hacrp/CLAIMS.md`; modify `copy.js` claim ids; extend `copy-gate.test.js`.

- `CLAIMS.md` table: `id | claim (own words) | primary source (URL) | quoted support (≤ 25 words) | checked (date)`.
  Primary sources only: CMS pages and PDFs (program page, FY2026 methodology infographic or its Internet Archive copy,
  FY2027 key-dates document for the FY2026 periods and the CY2015 SIR baseline), CMS's footnote crosswalk (Maryland's
  waiver, footnote `a`), CDC NHSN for the SIR definition, 42 U.S.C. 1395ww(p) for the 1% reduction. A claim that can't
  be checked at a primary source is marked `unverified`, and copy may not reference it.
- Live checks are network reads by the session (not the build): each link-out and citation URL returns 200 (or its
  archive copy does); record the date.
- [ ] Failing test: every `claim` in `COPY` and in `constants.js` resolves to a row whose status isn't `unverified`
  and whose source is `https://`. Implement; commit.

### Checkpoint M3 and final gate
- [ ] `/simplify` on the M3 diff → tests; `/code-review`; `/security-review` (CSV, table JSON, `#state=`).
- [ ] Final gate on the whole branch: `/simplify` → `make test && make build`; `/code-review`; `/security-review`;
  `/verify` (fresh clone: `npm ci && make test && make build && make serve`, then Chrome: hospital pages for each
  status, the what-if end to end, a shared link, the program page figures and table, keyboard, dark mode, 375px).
- [ ] Push to the private remote; CI green.

## Amendments made during execution

### Milestone 1 (2026-10-20)
- **Branch** `p2b-hacrp-page`; CI runs on draft PR #2 (private). Node 24 and `npm ci` verified there.
- **Footnote 11 vs 18:** some CMS-assigned measures carry footnote 11 (data discrepancies), not 18 (not submitted), so the
  assigned-measure note says CMS assigned the worst score "under the program's rules" and points to CMS's footnote,
  never "did not submit".
- **Counts:** penalty sentences use scored hospitals with a Yes/No decision (A1(b)'s population): FY2026 718 of 2,886.
  The one unscored "Yes" row shows CMS's literal value ("Payment reduction: Yes"), not "1% cut".
- **A1:** (b) covers scored Yes/No hospitals; (a) also requires every scored hospital within 0.001 (a hard cap). The
  build checks that the hospital master was built for the HACRP file's year.
- **View model:** adds `noScore`/`score` handling, `hasValue`/`hasZ`, CMS's own text for the boundary values
  (`boundaryText`, required), and leaves indexing to one `robotsFor` rule in `pipeline/site/`.
- **Simplify (M1):** sites register through a manifest (`path`, entries, styles, generator); `ctx.emit` writes every page
  and feeds the sitemap; shared render pieces live in `web/render/components.js`; per-site CSS; the hospital search list
  is a hashed JSON asset loaded on first focus (`/hacrp/` went from 191 KB to 7 KB).
- **Layout:** stacked measure rows at ≤ 640px; no page scrolls sideways at 375px (checked in Chrome); measure names in ink.
- **Copy:** program page says "above the 75th percentile of Total HAC Scores, as CMS calculates it"; as-of bar reads
  "Provider Data Catalog release: {date}". New claim ids HACRP-12 (as-of label) and HACRP-13 (Maryland) for Task 14.
- **Reviews:** per-task reviews (Tasks 5 and 6 took one fix round each); M1 `/simplify` (4 angles), `/code-review`
  (F1 Maryland sentence, F2 A1 cap, F3 year check, plus three small fixes), `/security-review` (no findings).
- **Minor items left (M1):** dev-server and outDir guards are lexical (symlinks); `npm ci` runs install scripts;
  `.pill--rew` is 4.47:1 (fix before any bonus site); stacked-table semantics need an axe/VoiceOver pass at narrow width;
  column headers use `--pen-ink` text; the copy gate doesn't catch number words; the as-of "expected early" label goes
  stale without a refresh (the maintenance banner covers it).
- **Design pass (after M1):** a separate design/AI-tell review; 14 fixes applied (hero alignment, table rules and
  header ink, no empty what-if block, hatched "No score published" for unscored rows, CMS's literal decision once,
  hero label, estimate note visible on tap, page titles/descriptions, the largest-contribution sentence shown, a
  two-row phone header, toggle pressed state, kicker link). Owner-review items are kept in the private planning repo.
  Open Minor, fix in M2: at ≤ 520px the header's visual order (wordmark, toggle, byline) differs from tab order; move
  the toggle before the byline in the markup.

