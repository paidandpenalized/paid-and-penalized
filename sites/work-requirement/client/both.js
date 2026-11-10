// Step 5 in the browser (web/program/both.js drew it for step 4's own hospital, the middle case and the default use rate):
// Figure 5, the words column's range, finding, corner dollars and the page's hospital's line, the figure's table and the
// named table, redrawn with the same code from the page's state when the case, the use rate or the page's hospital moves
// (the store's changes come at most once an animation frame: client/whatif.js perFrame). Only the drawing on show is
// redrawn, the other when the width brings it on. The named table shows its first rows until "Show all"; without this
// script it shows every row.
import { count } from '../../../web/render/format.js';
import { NAMED_FIRST, SCENARIOS } from '../web/constants.js';
import { fill } from '../web/copy.js';
import { bothAlt, bothBody, bothLayout, cellOf, exposed, headHtml, namedBody, namedCaption, namedSummary, readHtml, youHtml } from '../web/program/both.js';

// section: the step; store: the page's state; model: both.js bothModel over the strips' rows and their asset; wide: the
// media query list under which the wide drawing shows; say(text): the page's live line.
export function mountBoth(section, { store, model, wide, say = () => {} }) {
  const fig = section.querySelector('#figure-5');
  const head = section.querySelector('[data-b-head]');
  const read = section.querySelector('[data-b-read]');
  const you = section.querySelector('[data-b-you]');
  const named = section.querySelector('[data-b-named]');
  if (!fig || !head || !read || !you || !named) return;
  const svgs = new Map([...fig.querySelectorAll('svg[data-fit]')].map((svg) => [svg.dataset.fit, svg]));
  const cells = [...fig.querySelectorAll('td[data-b]')].map((td) => [td, ...td.dataset.b.split(' ')]);
  const sum = named.querySelector('[data-b-sum]');
  const cap = named.querySelector('[data-b-cap]');
  const body = named.querySelector('[data-b-rows]');
  const all = named.querySelector('[data-b-all]');
  const viewOf = (state) => ({ k: SCENARIOS.indexOf(state.scenario), use: state.use });

  const stale = new Set();
  const shown = () => (wide.matches && svgs.has('wide') ? 'wide' : 'narrow');
  const drawOne = (drawing) => {
    const svg = svgs.get(drawing);
    if (!svg) return;
    const state = store.get();
    svg.innerHTML = bothBody(bothLayout({ model, drawing, ...viewOf(state), ccn: state.hospital?.ccn ?? null })).text;
    stale.delete(drawing);
  };
  wide.addEventListener('change', () => stale.has(shown()) && drawOne(shown()));

  // The named table: its first NAMED_FIRST rows until the reader asks for all (kept across redraws).
  let expanded = false;
  const countNow = () => {
    const { k, use } = viewOf(store.get());
    return exposed(model, k, use).length;
  };
  const limit = () => {
    const n = countNow();
    const limited = !expanded && n > NAMED_FIRST;
    named.toggleAttribute('data-limited', limited);
    all.hidden = !limited;
    if (limited) all.textContent = fill('bShowAll', { n: count(n) });
  };
  all.addEventListener('click', () => {
    expanded = true;
    limit();
    say(fill('bShowingAll', { n: count(countNow()) }));
    // The button is gone: focus moves to the first row it showed (its link), or the table's summary.
    (body.children[NAMED_FIRST]?.querySelector('a') ?? named.querySelector('summary')).focus();
  });

  store.subscribe((state, changed) => {
    const moved = changed.has('scenario') || changed.has('use') || changed.has('totals');
    if (!moved && !changed.has('hospital')) return;
    for (const drawing of svgs.keys()) stale.add(drawing);
    drawOne(shown());
    const { k, use } = viewOf(state);
    you.innerHTML = youHtml(model, state.hospital, k, use).text;
    if (!moved) return;
    for (const svg of svgs.values()) svg.setAttribute('aria-label', bothAlt(model, k, use));
    head.innerHTML = headHtml(model, k, use).text;
    read.innerHTML = readHtml(model, k, use).text;
    for (const [td, j, kind] of cells) {
      const c = cellOf(model, use, Number(j), kind);
      td.textContent = c.text;
      td.dataset.value = String(c.value);
    }
    sum.textContent = namedSummary(model, k, use);
    cap.textContent = namedCaption(k);
    body.innerHTML = namedBody(model, k, use).text;
    limit();
  });
  limit();
  // The page's hospital at load may differ from the server's (a ?h=, or the random default).
  const first = store.get();
  if (first.hospital?.ccn !== you.dataset.bDefault) {
    const { k, use } = viewOf(first);
    for (const drawing of svgs.keys()) stale.add(drawing);
    drawOne(shown());
    you.innerHTML = youHtml(model, first.hospital, k, use).text;
  }
}
