# Tier-1 launch pieces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the family's policy pages, the parts every page carries, response headers, the remaining CI layers and a
Workers Builds preview, so the HACRP site can pass its launch checklist.

**Architecture:** Everything renders through the existing page shell (`web/render/layout.js`) and the hub generator
(`hub/pages.js`); the build writes Cloudflare's `_headers`; CI gains three stdlib Node scripts (size, links) and a
browser suite (`tools/e2e/`, Node's built-in runner driving Playwright) that runs locally, in CI and against any URL.

**Tech Stack:** Node 24 (ES modules, `node:test`), esbuild, Playwright 1.64.0 (library), axe-core 4.14.0, Cloudflare
Workers static assets, Workers Builds, GitHub Actions.

**Spec:** `docs/specs/2026-10-23-tier1-launch-pieces-design.md`

## Global Constraints

- Branch `p2b-launch-pieces`; commit identity `275741810+daltonhaslam@users.noreply.github.com`; never `--no-verify`.
- No real hospital name or CCN in tests, fixtures, comments or commits: pick pages by property, or use invented CCNs
  (`99xxxx`).
- Copy files (`*/copy.js`) hold no digit characters (the copy gate). "WCAG 2.2", "CC BY 4.0" and the like reach copy
  through placeholders from a named constant.
- House words: never "caught", "failed" or "worst" about a hospital; "CMS reports" for CMS's values, "this site
  recomputes" for this site's.
- No public promise of reply or fix times, and no data-deletion promise.
- No page requests another origin. The feedback link is the only off-site link a reader's click sends data to.
- `npm test` must keep running without a browser. Browser checks run under `npm run e2e`.
- Installs (owner-approved): `playwright@1.64.0` and `axe-core@4.14.0`, exact, as devDependencies. Before running
  each one, state its source (npm registry) and unpacked size (playwright and playwright-core about 18 MB; axe-core
  about 3.3 MB). Playwright 1.64.0 expects Chromium build 1248, which is not in the local cache. **Local runs use the
  installed Google Chrome (`channel: 'chrome'`); download nothing locally.** Firefox 1555 and WebKit 2370 are cached
  and match. CI installs Chromium in its own job.
- Actions are pinned by full SHA with a `# vX.Y.Z` note, the token is read-only, no `pull_request_target`, no `${{ }}`
  inside `run:` (`tools/test/workflow.test.js`).
- Nothing deploys and nothing merges to `main` without the owner's OK in the session. No custom domain, no DNS.
- Rulings and deferred minors go in the ledger `.superpowers/sdd/2026-10-23-tier1-launch-pieces/progress.md`.

## Review Focus

1. **A page URL holding `&`, `#`, `?` or `%`**: the feedback link's prefill must carry it whole (each value through
   `encodeURIComponent`). Task 1 tests a path that needs it.
2. **A maintenance flag set to something odd** (`''`, a number, whitespace): the build must throw, not print "Not updated
   for the  release". Task 1 tests it.
3. **A malformed corrections entry** (a bad date in the file name, an empty body, a non-`.md` file): the renderer throws
   with the file's name instead of showing "Invalid Date". Task 4 tests it.
4. **`_headers` past Cloudflare's limits** (100 rules; 2,000 characters a line): a test fails before Cloudflare would
   silently ignore the file. Task 6 tests it.
5. **JavaScript off**: footer, feedback link, banner and policy pages work with no script, and no inline script is
   needed. Task 10 loads pages with JavaScript disabled.

---

## Milestone 1: policy pages and page parts

### Task 1: Footer, feedback link and maintenance banner in the page shell

**Files:**
- Modify: `web/site.js`, `web/render/layout.js`, `web/copy.js`, `web/styles/components.css`
- Modify: every `page({ … })` caller (`hub/pages.js`; `sites/hacrp/web/pages/{program,hospital,place,methods,dictionary}.js`)
- Test: `web/test/render.test.js`

**Interfaces:**
- Produces: `SITE.feedback = { url, siteEntry: 'entry.2047320042', pageEntry: 'entry.1326474028' }` (replaces
  `SITE.feedbackUrl`); `feedbackHref({ siteName, pageUrl }) -> string` exported from `layout.js`;
  `page({ …, site })` where `site` is `'hub'` or a key of `SITE.sites` (required); `maintenanceBanner(site) -> Safe | ''`.
- `SITE.sites.<id>.maintenance`: `null` or a non-empty trimmed string (a release name, e.g. `'FY2027'`); anything else
  throws when a page is built.

- [ ] **Step 1: Write the failing tests** in `web/test/render.test.js`:
  - `feedbackHref` builds `${SITE.feedback.url}?entry.2047320042=<site>&entry.1326474028=<page>`; for
    `pageUrl: 'https://paidandpenalized.org/a/?x=1&y=2#z'` the parsed `URL.searchParams.get('entry.1326474028')` equals
    that string exactly.
  - `page({ site: 'hacrp', path: '/hacrp/' … })` has an `href` whose site param is `SITE.sites.hacrp.title` and whose
    page param is `SITE.origin + '/hacrp/'`; the hub's says `SITE.name`. `/404.html` prefills the site only.
  - The footer holds the no-patient-information line beside the link, the short Terms line linking `/terms/`, and links
    to `/privacy/`, `/corrections/`, `/about/`, `/accessibility/`, `/methods/`. The existing footer assertions stay.
  - The banner: absent when `maintenance` is `null`; with `'FY2027'` every page of that site shows a `role="status"`
    banner holding `FY2027` before `<main>`; hub pages never show it; `''`, `'  '`, `7` and `true` throw a `TypeError`
    naming the site.
  - `page()` without `site`, or with an unknown one, throws.
- [ ] **Step 2: Run** `node --test web/test/render.test.js`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement.** The footer becomes `footer({ site, path })`. Copy keys in `web/copy.js` (exact words are
  drafts the owner approves later): `feedbackWarning`, `termsShort`, `termsLink`, `privacy`, `corrections`, `about`,
  `accessibility`, `maintenance` (with `{release}`). Banner styles use existing tokens only. Pass `site` from every
  caller. Update the one other reader of `SITE.feedbackUrl` (grep).
- [ ] **Step 4: Run** `npm test`. Expected: PASS (the golden check is untouched: no emitted data changes).
- [ ] **Step 5: Commit** `Page shell: prefilled feedback link, PHI line, Terms line and policy links; maintenance banner`.

### Task 2: Policy copy (controller writes it)

The controller drafts this task's copy itself, in the HACRP page's voice, from the spec's Goals 1 and LEGAL/EDIT
wording, then commits. It is not dispatched.

**Files:**
- Modify: `hub/copy.js` (keys per page: `terms*`, `privacy*`, `corrections*`, `about*`, `a11y*`; each page has a title,
  description, a three-to-five-line `*Brief` list and its sections)
- Create: `web/test/house-words.test.js`

**Interfaces:**
- Produces: the copy keys Tasks 3–4 read, listed at the top of `hub/copy.js` in a comment by page.
- Constants for numbers in copy: `hub/constants.js` exports `WCAG_VERSION = '2.2'`, `CONTENT_LICENSE = 'CC BY 4.0'`,
  `CODE_LICENSE = 'MIT'`.

- [ ] **Step 1: Write the failing test** `web/test/house-words.test.js`: across every `*/copy.js`, no entry's text
  matches `/\b(caught|failed|worst)\b/i`; across `hub/copy.js` and `web/copy.js`, none matches
  `/\b(within|business days?|promptly|as soon as|we will (reply|respond|fix|delete)|delete your|remove your)\b/i`.
  Add a fixture case proving each pattern catches a sample sentence.
- [ ] **Step 2: Run** it. Expected: PASS on today's copy (it is a guard). The fixture cases prove it bites.
- [ ] **Step 3: Write the copy** in `hub/copy.js`. Move `aiHeading`/`aiUse` to `/about/` keys, so the hub's
  `/methods/` keeps only the estimate section.
- [ ] **Step 4: Run** `npm test`. Expected: PASS, including the copy gate (no digits).
- [ ] **Step 5: Commit** `Policy copy drafts: Terms, privacy, corrections, About, accessibility; house-word guard`.

### Task 3: Policy page template and four hub pages

**Files:**
- Create: `hub/policy.js`
- Modify: `hub/pages.js`, `web/styles/pages.css`
- Test: `hub/test/pages.test.js`

**Interfaces:**
- Consumes: Task 1's `page({ site: 'hub' })`; Task 2's copy keys.
- Produces: `policyPage({ path, title, description, brief, sections, assets, robots }) -> string` where `brief` is a
  list of strings or Safe and `sections` is `[{ id, heading, body }]` (`body` Safe). Layout: the title, then the brief
  as a `.form` record card (`formTitle` + `formField`s from `web/render/components.js`), then the sections beside an
  in-page index (`nav` with `aria-label`) on wide screens, stacked on narrow ones.

- [ ] **Step 1: Write the failing tests** in `hub/test/pages.test.js`: the hub writes `/terms/`, `/privacy/`, `/about/`
  and `/accessibility/` (page count rises by four; `/corrections/` arrives in Task 4). Each has one `h1`, the brief
  card, an index whose links equal its section ids, and the hub's noindex while `RELEASED` is false. `/about/` has
  `id="ai"` and `id="coi"`. `/methods/` no longer holds the AI paragraph and links `/about/#ai`. `/terms/` links
  `/methods/#estimate`. `/privacy/` names no retention period. The `/accessibility/` text holds `WCAG_VERSION`.
- [ ] **Step 2: Run** `node --test hub/test/pages.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** `policyPage` and the four emitters. No figures. Styles from existing tokens. It must not
  regress the forced-colors test (`web/test/forced-colors.test.js`).
- [ ] **Step 4: Run** `npm test`, then `make build && make serve`, and screenshot each page at 390 px and 1280 px,
  light and dark, into the scratchpad (headless Chrome, as earlier milestones did). Expected: tests PASS; the
  screenshots show the card, the index and no horizontal scroll.
- [ ] **Step 5: Commit** `Hub policy pages: Terms, privacy, About, accessibility on one template`.

### Task 4: Corrections page, its log and each site's dates

**Files:**
- Create: `hub/corrections.js`, `corrections/.gitkeep` (only if the directory is otherwise empty)
- Modify: `pipeline/site/context.js`, `sites/hacrp/web/generate.js`, `sites/hacrp/web/data.js`, `hub/pages.js`
- Test: `hub/test/corrections.test.js`, `pipeline/test/site-build.test.js`

**Interfaces:**
- Produces: `ctx.setUpdated(siteId, { cmsReleased, changed })` (both `YYYY-MM-DD` strings; a second call for one site
  throws) and `ctx.updated` (a `Map`). HACRP calls it from `generateHacrp`: `cmsReleased` is its source's
  `pdcReleased`; `changed` is the newest `built_at` date across the emitted files `loadHacrp` reads (hacrp, hospital
  master, history, dollars).
- Produces: `readCorrections(dir) -> [{ date, slug, body }]` (newest first, then by slug) and
  `correctionsPage({ entries, updated, assets, robots }) -> string` in `hub/corrections.js`. Entry bodies render
  through `web/render/markdown.js`.

- [ ] **Step 1: Write the failing tests:**
  - `readCorrections` on a temp dir with `2026-11-02-a.md` and `2026-10-30-b.md` returns them newest first;
    `2026-02-30-x.md`, `notes.txt`, `2026-11-02-.md` and a blank-body entry each throw with the file name.
  - `correctionsPage` with no entries says the log is empty. With two, it renders both, each with an `<time
    datetime>`. It shows `corrections@paidandpenalized.org` once, and, per site in `updated`, the CMS file date and
    the changed date.
  - Build test: after HACRP runs, `ctx.updated.get('hacrp')` holds two ISO dates; no other built page contains
    `corrections@`.
- [ ] **Step 2: Run** the two test files. Expected: FAIL.
- [ ] **Step 3: Implement.** The hub reads `REPO_ROOT + 'corrections/'` (absent or empty is fine).
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `Hub corrections page: policy, the log from corrections/, each site's CMS and changed dates`.

### Task 5: HACRP pages agree with the policy pages

**Files:**
- Modify: `sites/hacrp/web/methods/copy.js`, `sites/hacrp/web/pages/methods.js`, `sites/hacrp/web/pages/dictionary.js`
- Test: `sites/hacrp/test/methods.test.js`, `sites/hacrp/test/pages.test.js`

**Interfaces:**
- Consumes: the as-of bar the program page uses (`asofBar` via `sites/hacrp/web/pages/parts.js`).

- [ ] **Step 1: Write the failing tests:** Methods § "Feedback, privacy and AI" links `/privacy/` and `/about/#ai` and
  no longer says the site keeps nothing about readers. The "What changed" section links `/corrections/`. The Methods
  and dictionary pages carry the as-of bar. No built page links `/methods/#ai`.
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement.** The rewritten keys keep `claim: null`.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `HACRP Methods and dictionary: point to the privacy, About and corrections pages; as-of bar`.

### Task 6: Response headers, and a local server that applies them

**Files:**
- Create: `pipeline/site/headers.js`
- Modify: `pipeline/site/build.js`, `pipeline/site/serve.js`; any template or client file whose inline `style`
  attribute the CSP decision removes
- Test: `pipeline/test/headers.test.js`, `pipeline/test/site-build.test.js`

**Interfaces:**
- Produces: `headersFile({ env }) -> string` (Cloudflare `_headers` text); `parseHeaders(text) -> [{ path, set:
  [[name, value]], detach: [name] }]`; `headersFor(rules, pathname) -> Record<string, string>` applying every
  matching rule in order (`*` splat matches any characters; `! Name` removes a header an earlier rule set).
  `build()` writes `dist/_headers`; `createSiteServer(root)` sends `headersFor(...)` on every response.
- CSP (one line): `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self';
  connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`. Tighten `form-action` to `'none'`
  if the search form never submits. Add `style-src-attr 'unsafe-inline'` only if inline style attributes can't move
  to classes or CSSOM (JavaScript setting `el.style.x` is allowed under CSP), and record why in the ledger.
- Every path also gets `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy: camera=(), microphone=(), geolocation=()`, `Cross-Origin-Opener-Policy: same-origin` and
  `Strict-Transport-Security: max-age=31536000`. Hashed `/assets/*.js` and `*.css` get `Cache-Control: public,
  max-age=31536000, immutable`; `/assets/fonts/*` and `/favicon.svg` get `public, max-age=604800`. When `env !==
  'production'`, add `X-Robots-Tag: noindex` on `/*`.

- [ ] **Step 1: Write the failing tests:**
  - `headersFile({ env: undefined })` holds the CSP above and `X-Robots-Tag: noindex`; production has no
    `X-Robots-Tag`.
  - `parseHeaders(headersFile(...))` has at most 100 rules, and no line is 2,000 characters or longer.
  - `headersFor` on `/assets/site.ab12cd34.css` gives immutable caching; on `/assets/fonts/x.woff2`, not immutable.
  - A 404 response gets the CSP.
  - The local server's responses carry the same headers as `headersFor` for `/`, `/hacrp/` and an unknown path.
  - Every built HTML page has no inline `<script>` that isn't `type="application/ld+json"`. If `style-src-attr` is not
    allowed, no `style=` attribute either.
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement**, checking Cloudflare's current `_headers` documentation for splat and detach rules before
  relying on them.
- [ ] **Step 4: Run** `npm test && make build`. Expected: PASS; `dist/_headers` exists.
- [ ] **Step 5: Commit** `Build writes Cloudflare _headers (CSP, security headers, caching, noindex off production); serve applies them`.

### Checkpoint M1 (review gate)

- [ ] `/simplify` on `c8b0db3..HEAD`, then `make test`. A test break is a finding to fix.
- [ ] `/code-review` on the resulting diff. Fix Critical/Important findings.
- [ ] `/security-review`: the CSP and headers, the feedback link's encoding, the corrections Markdown rendering.
- [ ] Look at every new page in Chrome (served locally with headers): no console errors, no CSP reports. Screenshots
  into the scratchpad. Ledger updated.

---

## Milestone 2: CI layers

### Task 7: Size budget

**Files:**
- Create: `tools/ci/size-budget.js`
- Test: `tools/test/size-budget.test.js`
- Modify: `.github/workflows/ci.yml` (a step after "Build the site" in the `test` job)

**Interfaces:**
- Produces: `pageWeight(distDir, htmlPath) -> { html, css, js, total }` in bytes, brotli-compressed (`node:zlib`
  `brotliCompressSync`, quality 11), counting the HTML plus each stylesheet and module script it references (each
  once). `pageType(path) -> string` maps a page to one of `hub`, `policy`, `program`, `hospital`, `place`, `methods`,
  `dictionary`, `notFound`. `checkBudgets(distDir) -> [{ path, type, total, budget }]` lists only the pages over
  budget. Run as a CLI, it exits 1 and prints the overs.
- `BUDGETS` (bytes): `hub` and `policy` at most 100 KB (ARCH-27); every page's `js` at most 120 KB. The other types get
  today's largest page of that type plus 15%, rounded up to the next 10 KB, with a comment giving the measured size
  and date. A type over ARCH-27's starting number is noted in the ledger.

- [ ] **Step 1: Write the failing tests** with synthetic files in a temp dir: one page referencing one CSS and two JS
  files (one shared) counts the shared file once; `pageType` sorts sample paths correctly; a page over its budget is
  reported, and one under it isn't.
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement.** Measure `dist/` to set `BUDGETS`.
- [ ] **Step 4: Run** `npm test && make build && node tools/ci/size-budget.js`. Expected: PASS, exit 0.
- [ ] **Step 5: Commit** `CI: size budget per page type (brotli; ARCH-27 caps where pages fit)`.

### Task 8: Link check

**Files:**
- Create: `tools/ci/link-check.js`
- Test: `tools/test/link-check.test.js`
- Modify: `.github/workflows/ci.yml` (a step after the size budget)

**Interfaces:**
- Produces: `checkLinks(distDir) -> [{ from, href, problem }]`, where `problem` is `'missing file'` or
  `'missing id'`. It covers every `href` and `src` in every `.html`. Same-site URLs resolve like the server: a folder
  means `index.html`, and an absolute `https://paidandpenalized.org/…` is same-site. Off-site links, `mailto:` and
  `data:` are skipped. A `#fragment` must name an `id` on its target page. The CLI exits 1 on any problem.

- [ ] **Step 1: Write the failing tests** on a synthetic site: a broken link, a broken fragment, a folder link that
  resolves, a canonical-origin link that resolves, and an off-site link that's skipped.
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement** with a regex tokenizer over attributes (no HTML-parser dependency).
- [ ] **Step 4: Run** `npm test && node tools/ci/link-check.js`. Expected: PASS, 0 problems on today's build (fix any
  real broken links it finds, as their own commit).
- [ ] **Step 5: Commit** `CI: internal link and fragment check over dist/`.

### Task 9: Browser harness (Playwright) and page-load checks

**Files:**
- Modify: `package.json` (`devDependencies`: `"playwright": "1.64.0"`, `"axe-core": "4.14.0"`; scripts: `"e2e": "node
  --test tools/e2e/*.test.js"`, `"e2e:launch": "node tools/e2e/launch.js"`), `package-lock.json`, `CLAUDE.md`
  (Dependencies and Commands: name the two new devDependencies and the e2e commands)
- Create: `tools/e2e/lib.js`, `tools/e2e/pages.test.js`

**Interfaces:**
- Produces in `lib.js`:
  - `startSite() -> { base, close }`: with `E2E_BASE_URL` set, uses that URL and `close` is a no-op. Otherwise it
    serves `dist/` with `createSiteServer` on `127.0.0.1` and a free port.
  - `launch(engine = 'chromium') -> Browser`: Chromium uses `channel: 'chrome'` unless `process.env.CI`.
  - `samplePages() -> [{ type, path }]`, chosen by property from the emitted data and `dist/`: the hub home, each
    policy page, the program page, one hospital page with a cut, one with no score, one not cut, one region, one state
    and one metro page, Methods, the dictionary, an unknown path (404).
  - `watch(page) -> { errors, cspViolations, foreignRequests }`. Console errors and page errors are collected. CSP
    violations come from a `securitypolicyviolation` listener added with `addInitScript`. Foreign requests are any
    request whose origin differs from `base`.
- The run first installs the devDependencies: name the installs (source, size) before running `npm install`.

- [ ] **Step 1: Write the failing test** `tools/e2e/pages.test.js`: for each sample page, light and dark (set by the
  theme toggle's stored choice or `colorScheme`), the status is 200 (404 for the unknown path) with no errors, no CSP
  violations and no foreign requests; `document.documentElement.scrollWidth <= innerWidth` at 320 px; and the
  feedback link's `entry.1326474028` equals the page's canonical URL.
- [ ] **Step 2: Run** `npm run e2e` before the harness exists. Expected: FAIL (module not found).
- [ ] **Step 3: Install** (named first), then implement `lib.js`.
- [ ] **Step 4: Run** `make build && npm run e2e`. Expected: PASS. Real failures found here are fixed in their own
  commits.
- [ ] **Step 5: Commit** `Browser checks: Playwright harness (local, CI or any URL) and page-load checks for every page type`.

### Task 10: Interaction, keyboard and no-JavaScript checks

**Files:**
- Create: `tools/e2e/interact.test.js`

**Interfaces:**
- Consumes: Task 9's `startSite`, `launch`, `samplePages`, `watch`.

- [ ] **Step 1: Write the tests.**
  - Search on the program page finds the sample hospital by the first word of its name (read from the data), and
    Enter opens its page.
  - The what-if on the sample cut hospital changes its result when a measure input changes.
  - Tabbing from the skip link reaches the search, the theme toggle, every nav item and the feedback link, and no
    focused element sits under the sticky top bar (its rect doesn't intersect the bar's).
  - The maintenance banner is absent.
  - With `javaScriptEnabled: false`, the program, hospital and every policy page show the footer and feedback link,
    and the hub pages lose nothing.
- [ ] **Step 2: Run** `npm run e2e`. Expected: PASS, or failures that are real defects. Fix each defect in its own
  commit, smallest change first.
- [ ] **Step 3: Commit** `Browser checks: search, what-if, keyboard reach, focus under the top bar, no-JavaScript`.

### Task 11: axe on every page type, and fixing what it finds

**Files:**
- Create: `tools/e2e/axe.test.js`
- Modify: whatever the violations point at (CSS, markup, `web/styles/tokens.css` for contrast)

**Interfaces:**
- Consumes: Task 9's harness. axe is injected from `node_modules/axe-core/axe.min.js` into a context created with
  `bypassCSP: true`, for the axe run only.

- [ ] **Step 1: Write the test:** every sample page, light and dark, at 1280 px and 390 px, has zero violations for
  tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` and `wcag22aa`. An exclusion is allowed only for a confirmed false
  positive, scoped to one selector, with the reason in a comment.
- [ ] **Step 2: Run** it. Expected: violations (list them in the ledger).
- [ ] **Step 3: Fix** them, smallest change first. A contrast fix is the smallest token change that passes, and every
  moved color goes in the ledger with its old and new value. Re-run `npm test` too, since the token tests guard dark
  and print.
- [ ] **Step 4: Run** `npm run e2e`. Expected: PASS.
- [ ] **Step 5: Commit** each fix group, then `Browser checks: axe at WCAG 2.2 AA on every page type, light and dark`.

### Task 12: CI browser job and the launch command

**Files:**
- Modify: `.github/workflows/ci.yml`, `tools/test/workflow.test.js` (if a rule needs to recognise the new job)
- Create: `tools/e2e/launch.js`

**Interfaces:**
- CI job `browser`: on `ubuntu-24.04`, a 15-minute timeout, checkout (SHA-pinned, `persist-credentials: false`), and
  setup-node `24.21.0`. Then `npm ci`, `npx playwright install --with-deps chromium`, `make build`, `npm run e2e`.
  `CI` is set by Actions, so the bundled Chromium is used.
- `launch.js`: runs the e2e suite on `chromium`, `firefox` and `webkit` (via `E2E_ENGINE`; `launch()` honours it),
  then compares the live response headers of `/`, `/hacrp/`, a hospital page and an asset against
  `headersFor(parseHeaders(dist/_headers))`, and exits 1 on any difference. It needs `E2E_BASE_URL`.

- [ ] **Step 1: Write the failing workflow test:** the `browser` job exists, runs `npm run e2e`, and installs only
  Chromium. Existing rules still pass.
- [ ] **Step 2: Implement** the job and `launch.js`.
- [ ] **Step 3: Run** `npm test` and, locally, `E2E_ENGINE=firefox npm run e2e` and `E2E_ENGINE=webkit npm run e2e`.
  Expected: PASS. Local WebKit and Firefox use the cached builds.
- [ ] **Step 4: Commit** `CI: browser job (Chromium); launch command runs three engines and checks live headers`.

### Checkpoint M2 (review gate)

- [ ] `/simplify` on the M2 diff, then `make test && npm run e2e`.
- [ ] `/code-review`. Fix Critical/Important findings.
- [ ] `/security-review` on the CI changes: permissions, pinning, the Playwright install, no secrets.
- [ ] Push the branch (private remote) and confirm CI is green on it.

---

## Milestone 3: preview

### Task 13: Deploy config

**Files:**
- Create: `wrangler.jsonc`, `tools/test/wrangler.test.js`

**Interfaces:**
- `wrangler.jsonc`: `name: "paid-and-penalized"`, `compatibility_date: "2026-09-01"`, `assets: { directory: "./dist",
  not_found_handling: "404-page", html_handling: "auto-trailing-slash" }`, `workers_dev: true`, `preview_urls: true`,
  no `main`, no `routes`. A header comment says how Workers Builds runs it, and that a custom domain is a go-live step
  needing the owner's OK.

- [ ] **Step 1: Write the failing test:** parse the file (strip comments); assets point at `./dist`; `workers_dev`
  and `preview_urls` are true; no `routes`, `route` or custom domain exists; `name` matches.
- [ ] **Step 2: Implement**, checking the Workers static-assets docs for the current key names.
- [ ] **Step 3: Run** `npm test`. Expected: PASS.
- [ ] **Step 4: Commit** `Deploy config: static-assets Worker on workers.dev with preview URLs; no custom domain`.
- [ ] **Step 5: Open a deploy-config-only PR** from a branch off `main` holding just this commit (cherry-picked).
  **Ask the owner before merging.** Nothing is connected yet, so the merge deploys nothing, but it's still `main`.

### Task 14: Owner's Cloudflare steps, then the first preview

- [ ] **Step 1: Write the click-by-click steps** for Workers Builds. They go in the owner's planning files, not this
  repo. Before writing them, check Cloudflare's current docs:
  - Workers & Pages → Create → Import a repository.
  - Install the Cloudflare GitHub app on the org, for this repository only.
  - Worker name `paid-and-penalized`; production branch `main`.
  - Build command `npm ci && make build`. Deploy command `npx wrangler@4.151.0 deploy`. Non-production deploy command
    `npx wrangler@4.151.0 versions upload`. Non-production branch builds on.
  - No build variables, so `PP_ENV` stays unset.
  - Where to find the workers.dev and preview URLs.
  - How to take it down.
- [ ] **Step 2: After the owner does them**, check `https://paid-and-penalized.<subdomain>.workers.dev/` (the owner
  supplies the subdomain): `curl -sI` shows the CSP and `X-Robots-Tag: noindex`; `/hacrp/` returns 200; an unknown
  path returns the 404 page.
- [ ] **Step 3: Push** `p2b-launch-pieces`. Workers Builds uploads a version, so take its preview URL from the build
  log or the PR's check.

### Task 15: Browser checks on the preview

- [ ] **Step 1: Run** `E2E_BASE_URL=<preview URL> npm run e2e` and `E2E_BASE_URL=<preview URL> npm run e2e:launch`.
  Expected: PASS, including the live headers matching `_headers`.
- [ ] **Step 2: Fix** anything the preview finds that local runs didn't, and push again until it passes.
- [ ] **Step 3: Record** the preview URL, the commit and the results in the ledger.

---

## Final gate

- [ ] `/simplify` on `main...HEAD`, then `make test && npm run e2e`.
- [ ] `/code-review` on the full diff, then `/security-review`: headers, CSP, the form link, CI permissions, the deploy
  config. Fix all findings, then re-run until clean (no `/simplify` after a clean review).
- [ ] `/verify` driven in Chrome on the preview URL: every policy page, the footer and feedback link (the form opens
  with the site and page filled in), the program page, a hospital page with its what-if, a place page, Methods; light
  and dark; a phone width.
- [ ] Add the `sites/hacrp/CHANGELOG.md` entry if the HACRP pages' visible behaviour changed. The emitted data doesn't
  change, so no corrections entry is needed.

## Close-out (outside this repo; never committed here)

- [ ] A phone-readable copy review file: every new or changed sentence by page, and every moved color with its before
  and after.
- [ ] A phone-readable launch checklist: each P3 Tier-1 item's state. The owner's own items are named: email routing
  (needed before go-live, since `corrections@` is on the corrections page), the hospital-network check, the one place
  to call, the GitHub passkey, the hub front-page design, and approving the copy.
- [ ] Go-live steps: the custom domain moves from the landing-page Worker, `PP_ENV=production` for `main` builds,
  `released: true`, the workers.dev route off, and the Web Analytics CSP change.
- [ ] Push the branch; open the PR; ask the owner before any merge.
