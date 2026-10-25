# Tier-1 launch pieces: design

2026-10-23. Branch `p2b-launch-pieces`, off `main` at `8fff77b`.

> **Later change (2026-10-25, the owner's review):** the maintenance banner and its `SITE.sites.<id>.maintenance` flag
> were removed, and `/corrections/` shows no email address; reports go through the feedback form. Each page's as-of
> bar is how a reader tells which CMS release it reflects.

## Intent

The HACRP site (`/hacrp/`) is built. This work adds what a public page that names hospitals needs before it goes
live at paidandpenalized.org: the family's policy pages, the parts every page carries, the remaining CI layers, and a
preview deployment the browser checks run against. Going live is a later step, taken when the launch checklist is
met and the owner approves it; nothing here sets a date.

Readers include hospital quality and finance leaders who know these measures well. Every sentence on the new pages
has to hold up to them. The policy pages are written in the site's own voice: plain, specific, short, without legal
boilerplate.

## Goals

1. **Policy pages on the hub**, shared by every site:
   - `/terms/`: one plain-English page. Not affiliated with or endorsed by CMS, any hospital or any health plan. An
     "estimate" links to its definition on the hub's `/methods/#estimate`. Not medical, legal, financial or
     investment advice. Data is as of the date each page shows. Text and derived data under CC BY 4.0, code under
     MIT. No arbitration clause and no heavy terms of service.
   - `/privacy/`: what the site and its host see. Cloudflare hosts the site and sees visitors' IP addresses in its
     logs. Cloudflare Web Analytics is cookieless, and the site keeps no log of hospital searches. The feedback form
     is a Google Form: Google sees the submitter's IP. The form doesn't collect email addresses and needs no
     sign-in. One optional question asks how to reach the sender, for anyone who wants a reply, and another asks
     which role describes them. Don't send patient information. The site sets no cookies. **No retention period
     and no deletion promise.**
   - `/corrections/`: the policy (an error in the data or the math is kept apart from disagreement with CMS's
     method; a revised CMS file triggers an update and a log entry; it is a one-person project) and the log. The log
     renders every `corrections/YYYY-MM-DD-<slug>.md` entry, newest first, with what changed, when and its impact.
     With no entries yet, it says so. An entry's date comes from its file name and its body is rendered Markdown.
     The log holds corrections and CMS revisions, not feature changes: each site's own "Changed" list (HACRP's
     Methods, from `sites/hacrp/CHANGELOG.md`) stays and links here. `corrections@paidandpenalized.org` appears on
     this page and nowhere else. For each site, the page gives the date of CMS's file the site uses
     (`source.pdcReleased`) and the date this site's numbers last changed: the newest `built_at` across that site's
     newest-year emitted files, which `make emit` leaves alone when nothing changed.
   - `/about/`: who built it ("Built by Dalton Haslam, MD, MBA"). A conflict-of-interest paragraph: the author is a
     physician advisor employed by a hospital system; hospitals where he works or has worked may appear on these
     sites; he receives no funding or compensation for this project. No employer is named and there are no per-page
     employer notes. The AI-use paragraph: AI tools help write the code and draft the text; every number comes from
     deterministic, published code checked against CMS's published values; he reviews every published sentence.
   - `/accessibility/`: the target is WCAG 2.2 AA, with no claim of full conformance. It says what is tested (axe,
     keyboard, the browsers below), the known gaps, that Internet Explorer and IE mode are not supported, and how to
     report a problem (the feedback form).
   - The hub's `/methods/` keeps "what estimate means". Its AI paragraph moves to `/about/`, and `/methods/` links
     there, so the wording lives in one place.
   - The hub home stays as it is today (a list of sites). Its redesign is a separate piece of work (Non-goals).
   - **Look:** the policy pages use the family's almanac look rather than bare prose. Each opens with a short
     "in brief" record card (three to five lines of the page's substance) under its title, then sections with an
     in-page index beside them on wide screens. No figures. Built from existing components and tokens.
   - **The existing pages agree with the new ones.** Where current HACRP copy contradicts or duplicates a policy
     page, the HACRP copy changes. Today: Methods § "Feedback, privacy and AI" says the site keeps nothing about
     the reader, which conflicts with the host's IP logs. That section becomes a short pointer to `/privacy/` and
     `/about/#ai`. Methods' corrections sentence links to `/corrections/`. Every link to the hub's `/methods/#ai`
     moves to `/about/#ai`, and the link check proves none is left.
2. **On every page** (hub and HACRP):
   - **Feedback link** to the shared Google Form, prefilled with the site name and the page's canonical URL. The
     link is built at page-build time (`entry.2047320042` = site, `entry.1326474028` = page, each through
     `encodeURIComponent`), so it works without JavaScript. Beside it, a visible line: don't include patient
     information.
   - **Footer**: a short Terms line (not affiliated; estimates are estimates; not advice) linking to `/terms/`, and
     links to Privacy, Corrections, About and Accessibility. The existing affiliation line, "Built with Claude Code",
     the license and Methods stay.
   - **Maintenance banner**: driven by the per-site flag `SITE.sites.<id>.maintenance` in `web/site.js` (`null` means
     off, the launch state). When set to a release name, every page of that site shows a banner saying the site
     has not been updated for that release. The release name comes from config, never from a copy file. Hub pages
     never show it.
   - **As-of bar**: the program, hospital and place pages show it. HACRP's Methods and data-dictionary pages don't
     yet, and get it. Hub policy pages hold no data and don't show it.
   - **Fonts**: already self-hosted (`web/fonts/`). The browser tests prove no page makes a request to another
     origin.
3. **Response headers**: the build writes `dist/_headers` for Cloudflare static assets:
   - every path: a Content-Security-Policy (`default-src 'none'`, scripts, styles, fonts, images and fetches from
     `'self'` only, `base-uri 'none'`, `frame-ancestors 'none'`, `form-action` as tight as the search form allows),
     `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, a Permissions-Policy
     denying camera, microphone and geolocation;
   - long immutable caching for content-hashed `/assets/*`;
   - **every build except `PP_ENV=production`** adds `X-Robots-Tag: noindex` to every path, on top of the existing
     meta robots, so the workers.dev preview never shows up in search results.
4. **CI layers (ARCH-25)**, added beside the existing test, python and secrets jobs, under the same rules
   (`tools/test/workflow.test.js`: full-SHA-pinned actions, read-only token, no `pull_request_target`, no `${{ }}`
   inside `run:`):
   - **Size budget**: a stdlib Node script reads `dist/` and fails on any page over its page type's budget, measured
     brotli-compressed as HTML plus the CSS and JS it loads. The budgets are the ARCH-27 starting numbers where
     today's pages fit them (hub ≤ 100 KB; JS ≤ 120 KB per page). Where a page type already exceeds them (the
     program page, about 283 KB gzipped), its budget is today's size plus stated headroom, and the ledger records
     the gap.
   - **Link check**: every internal `href` and `src` in `dist/` resolves to a built file, and every `#fragment` to an
     `id` on its target page. External links are not fetched in CI.
   - **Playwright on Chromium**, against the built site served locally: each page type loads with no console errors,
     no CSP violations and no request to another origin. Search finds a hospital. The what-if runs. The feedback
     link carries the site and page. The maintenance banner is off, and renders when the flag is set (a build-level
     test). The keyboard reaches every control. Nothing scrolls sideways at 320 px. Light and dark themes both work.
   - **axe** (axe-core) on every page type, light and dark, zero violations at WCAG 2.2 AA tags. **Fixing what it
     finds is in scope**, existing HACRP pages included: markup and ARIA fixes freely. A contrast failure is fixed by
     the smallest token change that passes. Every color that moves is listed, with before and after, in the copy
     review file. No blanket rule exclusions; an exclusion is allowed only for a confirmed axe false positive,
     scoped to one selector, with the reason in a comment and the ledger. Known WCAG gaps that axe can't see
     (pointer-only chart tooltips, where each figure's table is the keyboard path; dragging in the what-if, with
     its numeric inputs as the alternative; focus under the sticky top bar) are fixed where cheap, and otherwise
     named on `/accessibility/` from what the tests and a keyboard pass actually find.
   - The same Playwright and axe suite runs against any base URL (an env var), so it can run against the preview.
   - Launch-only layers (ARCH-25: all three engines and a headers check) ship as a command run before the go-live
     merge, not on every PR: Playwright on Chromium, Firefox and WebKit, plus a check that the live response headers
     match `_headers`. Lighthouse is left for the go-live step.
5. **Preview deployment (ARCH-09)**: a `wrangler.jsonc` in the repo root for a static-assets-only Worker serving
   `dist/`, deployed by Workers Builds from the org repo through Cloudflare's GitHub app, with no deploy token in
   GitHub. The workers.dev address is on, preview URLs are on, and there is no custom domain. The build runs
   `npm ci && make build` with `PP_ENV` unset (noindex everywhere). Pushes to non-production branches get version
   preview URLs. The owner does the account steps from written click-by-click instructions. The Playwright and axe
   suite passes against the preview URL.
6. **Tier-1 copy**: the words for all of the above live in `hub/copy.js` and `web/copy.js` (no digits in copy
   files; numbers come from data or config). These are drafts until the owner approves them.
7. **Outside this repo** (the owner's private planning files, never committed here): a phone-readable review file
   of every new or changed sentence and every moved color; the click-by-click Cloudflare steps; the go-live steps
   (including the CSP change Web Analytics needs); and the launch checklist with each item's state (done, built and
   waiting on the owner, or not started).

## Non-goals

- The hub's front page and the move of the current landing page into it. The landing page stays live at the apex
  until that is designed.
- Cross-program hospital pages, hub hospital search, the next program.
- Going live: the custom domain, `PP_ENV=production` builds, flipping `released`, the repo going public, branch
  protection, DNS records (HSTS, DNSSEC, CAA, null mail), email routing, turning on Web Analytics. These go on the
  launch checklist as the owner's steps.
- Lighthouse.

## Anti-goals (failures even if everything works)

- Any public promise of a reply time, a fix time, or deleting data.
- Words from the banned list: "caught", "failed" or "worst" about a hospital. CMS's values are "CMS reports" and this
  site's are "this site recomputes" (house word list, LEGAL-01).
- A request to any third-party origin from a page, apart from the feedback link the reader clicks.
- A real hospital's name or CCN in tests, fixtures, comments or commits.
- A preview that search engines index as a copy of the real site.
- Policy pages that read like a template: stock legal phrasing, hedging, padding.

## Constraints

- Monorepo `CLAUDE.md` rules all apply: no hand-typed numbers, the copy-file digit rule, the change gate, hooks,
  noreply identity, never `--no-verify`.
- **Installs (owner-approved, exact versions, each named with its source and size when it is run):** `@playwright/test`
  and `axe-core` as devDependencies, matching what the owner's other projects already use (Playwright 1.64.0,
  whose Chromium build is already cached locally; axe-core 4.14.0), and `wrangler` pinned to 4.151.0 if the deploy
  command needs it in the lockfile. CI installs Playwright's Chromium in the job. Check what is already present
  before installing anything.
- Cloudflare limits: under 20,000 files (today 3,562) and 25 MiB per file (largest today 1.3 MB). Workers Builds
  times out at 20 minutes (the build takes about 12 seconds locally).
- The repo is private. A merge to `main` deploys once Workers Builds is connected, so every merge needs the owner's
  OK in the session.

## Decided (by the owner, in the decision records)

Terms content and place (LEGAL-02); the privacy notice's content, self-hosted fonts and the PHI warning, with no
retention or deletion promise (LEGAL-12); the corrections page and log with no turnaround times (EDIT-04); a
generic COI statement (EDIT-03); the byline split and the AI paragraph (EDIT-07); WCAG 2.2 AA (DES-24); the
maintenance banner flag (PERS-02); the house word list (LEGAL-01); the CI layers (ARCH-25); Workers static assets
with Workers Builds (ARCH-09); noindex previews with no login (ARCH-13); one shared Google Form (ARCH-28);
`corrections@` only on the corrections page (ARCH-35); the browser matrix (ARCH-47).

## The builder's calls (recorded as rulings in the build ledger)

- Footer layout and the exact short Terms line.
- Where the e2e suite lives and its command names (`npm test` stays Node's built-in runner and must not need a
  browser).
- How strict `style-src` can be: inline `style` attributes exist in templates and chart code. Prefer moving them to
  classes or custom properties; otherwise allow attributes only and record why. (Settled in the build: charts keep
  their attributes so they render without JavaScript; `<style>` elements and stylesheets stay `'self'`.)
- How Cloudflare Web Analytics will load once it is turned on (an auto-injected beacon or a snippet) and what CSP it
  needs. Write the change it needs into the go-live steps; don't allow its origins before it is on.
- The order for connecting Workers Builds so a branch can get a preview without merging to `main` first (for
  example, a small deploy-config-only PR merged before the connection, with the owner's OK).
- Size-budget headroom per page type.
- How the local server applies `dist/_headers`, so the local Playwright run sees the real CSP (`serve.js` ignores
  it today).
- Caching for unhashed files (`/assets/fonts/*`, `/favicon.svg`): long but not `immutable`.
