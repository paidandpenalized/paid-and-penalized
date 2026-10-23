// The what-if component's HTML, written at build time. It shows the starting values (CMS's, on a hospital page)
// and their result, and reads correctly without JavaScript: the inputs are disabled and the buttons hidden until
// web/whatif/dom.js mounts it. Program-neutral: the numbers come from the view model (vm) the site's rules build,
// and every word from `texts`, the site's own copy (web/ never imports a site).
//
// vm:
//   result { available, n, before { score, flag }, after { score, flag }, measures { [id]: { changed, contribution } } }
//   money { atStake, before, after } | null              a program's dollars at the start and in the hypothetical,
//                                                         each { lo, hi } (dollarsOf: the least and most Medicare keeps)
//   ramp { actual, hypothetical, highestNo, lowestYes }   the scores the ramp marks
//   inputs [{ id, value (null: none), max, step, decimals, median, floor, cap, limit, valuetext, assigned, tagged }]
//   counts { [id]: { delta } }                            NHSN count deltas (dom.js)
//   extent                                                the bars' fixed scale
//   estimated                                             a changed measure is a recompute: show the estimate note
//
// texts:
//   heading, intro, noScript, resultLabel, fieldsLegend, held, standing, print   strings (print: the line a printed
//                                          page carries in place of the controls)
//   label                                  a line under the heading, or null for none
//   banner { text, linkText, href }        the shared-link banner (rendered only with share)
//   start, hypothetical                    column heads, the ramp's two mark labels and the result head's label
//   same                                   a hypothetical cell that equals the start
//   pill(flag) -> { kind, label }          the result head's decision pill (kind: components.js pill())
//   rows { score, decision, cut }          the result table's row heads
//   rampLine                               the ramp's line label
//   rampRef                                a short line under the ramp naming the line's two scores, or null for none
//   rampLegend                             the line in a sentence, said once under the what-if (outside the result)
//   rampZone                               the shaded side's label (e.g. its cut), or null for none
//   scores(vm) -> { before, after }        score texts
//   flag(flag), cut(flag)                  decision and cut texts (cut: null where there is no cut)
//   sentence(vm), slide(vm)                the result in words; plain text for "Copy for a slide"
//   estimate { text, linkText, href }      shown when a changed measure is a recompute
//   copy, copied, copyFallback, slideLabel, reset, median, medianHelp (the line under the buttons)
//   solver { question, caption, columns: [3 strings], rows(solver) -> [{ id, label, answer, note }] }
//   weight(n)                              "each measure weighs 1 ÷ n"
//   fieldsHelp [strings]                   lines said once over the measures (what a value means, what the track marks)
//   measure(input, m) -> { label, name, short, facts, slider, placeholder, assignedHelp, invalid }
//                                          input: a vm.inputs entry; m: its vm.result.measures entry; facts: the parts
//                                          of one line (its starting value, median, floor, cap and leverage), each kept
//                                          whole, with a separator before every part but the first
//   bars { heading, caption(n), value(contribution), assigned }
//   predicted null | { summary, label(id) -> string | null, help, invalid, result(delta) }   NHSN counts, in one
//                                          folded section after the measures (label null: no field for that measure)
//   money null | { row, tag { text, href, label }, amount(dollars), head(dollars), cliff { zero, zeroWords, cut,
//                cutWords } }              the dollars (with vm.money): a row of the table, a line in the head, and the
//                                          cliff over the ramp that the hypothetical rides: the money at any score
//   solver.worth                           a line over the solver's table: what keeping under the line is worth, or null
import { scaleLinear } from 'd3-scale';
import { COPY } from '../copy.js';
import { pillClass, printout } from '../render/components.js';
import { html } from '../render/html.js';
import {
  afterText, anyChanged, assignedNow, barClass, barSpan, cliffDotClass, cliffY, estimateNote, moneyClass, sameMoney, fieldText, fraction, headScore, labelAt, lineScore, rampAt, rampDomain,
  RAMP_TICK, RAMP_Y, rampEdge, rampHeight, rampLabels, rampSide, rampWidthFrom, rampX, sliderValue, trackStart, trackMarks, zoneLabelAt,
} from './marks.js';

const TICKS = 5;
const hiddenIf = (condition) => (condition ? html` hidden` : '');

// A text at a ramp place { t, anchor, dx }; name: its data-wi hook for dom.js, if it moves.
const rampText = ({ t, anchor, dx }, y, text, cls, name = null) =>
  html`<text class="${cls}"${name && html` data-wi="${name}"`} x="${rampX(t)}" y="${y}" dx="${dx}" text-anchor="${anchor}">${text}</text>`;

// The score's ramp over the national middle of scores (range): CMS's line with the side above it shaded and named, a
// solid mark for the starting score and a hollow one for the hypothetical (at an edge, with an arrow, when it runs
// past the range; hidden, with its label, while it equals the start), each label under its mark (stacked when they
// would touch). Decorative: the table and the sentence say the same.
function ramp(vm, range, texts) {
  const underCliff = Boolean(vm.money && texts.money);
  const domain = rampDomain(range, vm.ramp);
  const at = (score) => rampAt(score, domain);
  // The scale's own tick format (d3-format): the decimals that tell ticks a step apart, with a true minus.
  const scale = scaleLinear().domain(domain);
  const ticks = scale.ticks(TICKS);
  const fmt = scale.tickFormat(TICKS);
  const line = at(lineScore(vm.ramp));
  const start = at(vm.ramp.actual);
  const hyp = at(vm.ramp.hypothetical);
  const labels = rampLabels(start, hyp, texts.start, texts.hypothetical);
  const edge = rampEdge(rampSide(vm.ramp.hypothetical, domain));
  const unchanged = vm.ramp.hypothetical === vm.ramp.actual;
  const same = hiddenIf(unchanged);
  const stacked = labels.stacked && !unchanged;
  const Y = RAMP_Y;
  return html`<svg class="wi-ramp${underCliff ? ' wi-ramp--under' : ''}" data-wi="ramp" width="100%" height="${rampHeight(stacked)}" aria-hidden="true" focusable="false">
<defs><path id="wi-tri" d="M0 0L6 11H-6Z"/></defs>
<rect class="wi-ramp__zone" x="${rampX(line)}" y="${Y.zoneTop}" width="${rampWidthFrom(line)}" height="${Y.axis - Y.zoneTop}"/>
${texts.rampZone && rampText(zoneLabelAt(line), Y.zoneLabel, texts.rampZone, 'wi-ramp__zone-label')}
${ticks.map((x) => html`<line class="wi-ramp__tick" x1="${rampX(at(x))}" x2="${rampX(at(x))}" y1="${Y.axis}" y2="${Y.axis + RAMP_TICK}"/><text class="wi-ramp__tick-label" x="${rampX(at(x))}" y="${Y.tickLabel}" text-anchor="middle">${fmt(x)}</text>`)}
<line class="wi-ramp__axis" x1="${rampX(0)}" x2="${rampX(1)}" y1="${Y.axis}" y2="${Y.axis}"/>
<line class="wi-ramp__line" x1="${rampX(line)}" x2="${rampX(line)}" y1="${Y.zoneTop - 2}" y2="${Y.axis + RAMP_TICK}"/>
${rampText(labelAt(line), Y.lineLabel, texts.rampLine, 'wi-ramp__label')}
<use class="wi-tri wi-tri--hyp" data-wi="hyp" href="#wi-tri" x="${rampX(hyp)}" y="${Y.mark}"${same}/>
<use class="wi-tri wi-tri--cms" href="#wi-tri" x="${rampX(start)}" y="${Y.mark}"/>
${rampText(edge, Y.edge, edge.text, 'wi-ramp__edge', 'hyp-edge')}
${rampText(labels.start, Y.label, texts.start, 'wi-ramp__label', 'start-label')}
${html`<text class="wi-ramp__label" data-wi="hyp-label" x="${rampX(labels.hyp.t)}" y="${stacked ? Y.label2 : Y.label}" dx="${labels.hyp.dx}" text-anchor="${labels.hyp.anchor}"${same}>${texts.hypothetical}</text>`}
</svg>`;
}

// The cliff over the ramp, on the ramp's own x (its margins and places): the money a flat cut takes at any score.
// A ledge at $0 up to CMS's line, a drop, a floor at the whole cut out to the right; the hypothetical a dot riding
// it, which falls when it crosses the line (CSS moves it; dom.js counts the head's figure to its new value), and a
// ring where the starting score sits once the two differ. Too close to call, the dot hangs on the drop: either level.
// Decorative: the head, the table and the sentence say the same.
function cliff(vm, range, texts) {
  const domain = rampDomain(range, vm.ramp);
  const line = rampAt(lineScore(vm.ramp), domain);
  const start = rampAt(vm.ramp.actual, domain);
  const hyp = rampAt(vm.ramp.hypothetical, domain);
  const c = texts.money.cliff;
  const unchanged = vm.ramp.hypothetical === vm.ramp.actual;
  return html`<div class="wi-cliff" data-wi="cliff" aria-hidden="true" style="--line: ${fraction(line)}">
<div class="wi-cliff__plot">
<span class="wi-cliff__pit"></span><span class="wi-cliff__ledge"></span><span class="wi-cliff__drop"></span><span class="wi-cliff__floor"></span>
<span class="wi-cliff__level wi-cliff__level--zero"><b>${c.zero}</b> ${c.zeroWords}</span>
<span class="wi-cliff__level wi-cliff__level--cut"><b>${c.cut}</b> ${c.cutWords}</span>
<span class="wi-cliff__start" data-wi="cliff-start" style="--at: ${fraction(start)}; --y: ${cliffY(vm.money.before)}"${hiddenIf(unchanged)}></span>
<span class="${cliffDotClass(vm.money.after)}" data-wi="cliff-dot" style="--at: ${fraction(hyp)}; --y: ${cliffY(vm.money.after)}"></span>
</div>
</div>`;
}

// A hypothetical cell: its value where it differs from the start, else "same" (marked data-same, so it reads quiet).
const afterCell = (name, before, after, same) => html`<td class="wi-after" data-wi="${name}"${after === before ? html` data-same` : ''}>${afterText(before, after, same)}</td>`;

// The head: the decision as a pill and the score as "before → after", in the hero's vocabulary, so a flip is the
// loudest thing in the box. A visual summary of the table under it, so screen readers skip it (the live sentence
// announces the change).
function head(vm, texts) {
  const r = vm.result;
  const p = texts.pill(r.after.flag);
  return html`<div class="wi-head" aria-hidden="true">
<p class="cap wi-head__label" data-wi="head-label">${anyChanged(r) ? texts.hypothetical : texts.start}</p>
<p class="wi-head__row"><span class="wi-head__score" data-wi="head-score">${headScore(texts.scores(vm))}</span> <span class="${pillClass(p.kind)}" data-wi="head-pill">${p.label}</span></p>
${vm.money && texts.money && html`<p class="wi-head__money"><span class="wi-money__was" data-wi="head-money-was"${hiddenIf(sameMoney(vm.money))}>${texts.money.amount(vm.money.before)} →</span> <span class="wi-money${moneyClass(vm.money.after)}" data-wi="head-money">${texts.money.amount(vm.money.after)}</span> <span class="wi-head__money-words" data-wi="head-money-words">${texts.money.head(vm.money.after)}</span></p>`}
</div>`;
}

function result(vm, range, texts) {
  const r = vm.result;
  const s = texts.scores(vm);
  const cutBefore = texts.cut(r.before.flag);
  // The dollars, where the site has them for this what-if.
  const money = vm.money && texts.money;
  return html`<div class="wi-result" data-wi="result" role="group" aria-label="${texts.resultLabel}">
${head(vm, texts)}
<details class="wi-detail" data-wi="detail" open><summary>${COPY.showTable}</summary>
<table class="wi-table" aria-label="${texts.resultLabel}">
<thead><tr><td></td><th scope="col">${texts.start}</th><th scope="col">${texts.hypothetical}</th></tr></thead>
<tbody>
<tr><th scope="row">${texts.rows.score}</th><td class="cms">${s.before}</td>${afterCell('score', s.before, s.after, texts.same)}</tr>
<tr class="wi-table__words"><th scope="row">${texts.rows.decision}</th><td>${texts.flag(r.before.flag)}</td>${afterCell('flag', texts.flag(r.before.flag), texts.flag(r.after.flag), texts.same)}</tr>
${cutBefore !== null && html`<tr><th scope="row">${texts.rows.cut}</th><td>${cutBefore}</td>${afterCell('cut', cutBefore, texts.cut(r.after.flag), texts.same)}</tr>`}
${money && html`<tr class="wi-table__money"><th scope="row">${money.row} <a class="est-tag" href="${money.tag.href}" aria-label="${money.tag.label}">${money.tag.text}</a></th><td>${money.amount(vm.money.before)}</td>${afterCell('money', money.amount(vm.money.before), money.amount(vm.money.after), texts.same)}</tr>`}
</tbody>
</table>
</details>
${money && cliff(vm, range, texts)}
${ramp(vm, range, texts)}
${texts.rampRef && html`<p class="wi-ramp-ref">${texts.rampRef}</p>`}
<p class="wi-sentence" data-wi="live" aria-live="polite"><span data-wi="sentence">${texts.sentence(vm)}</span><span class="vh" data-wi="sentence-est">${estimateNote(vm, texts)}</span></p>
<p class="small wi-est" data-wi="estimate"${hiddenIf(!vm.estimated)}>${texts.estimate.text} <a href="${texts.estimate.href}">${texts.estimate.linkText}</a></p>
<p class="wi-copy"><button type="button" class="wi-btn" data-wi="copy" hidden>${texts.copy}</button> <span class="small" data-wi="copy-status" role="status"></span></p>
<textarea class="wi-slide" data-wi="slide" rows="8" readonly aria-label="${texts.slideLabel}" hidden></textarea>
</div>`;
}

// The lines said once over the measures, which every field and slider names in aria-describedby.
const FIELDS_HELP = 'wi-fields-help';
const PREDICTED_HELP = 'wi-predicted-help';

// One measure: its number field (blank where CMS assigned the score) and slider over a track marking the national
// median, CMS's cap (and a floor above zero), the shaded values that score the same and, once the value changes, a
// dotted tick at the starting value; and one line of its facts. w: texts.measure() for it.
function measure(input, w) {
  const { id } = input;
  const at = trackMarks(input);
  const ids = { number: `wi-${id}-n`, slider: `wi-${id}-r`, facts: `wi-${id}-m`, assigned: `wi-${id}-a`, error: `wi-${id}-e` };
  const describedBy = [FIELDS_HELP, ids.facts, input.assigned && ids.assigned].filter(Boolean).join(' ');
  return html`<div class="wi-measure" data-measure="${id}">
<label class="wi-measure__label" for="${ids.number}">${w.name ? html`<span class="wi-measure__name">${w.name}</span> <span class="wi-measure__short">${w.short}</span>` : w.label}</label>
<div class="wi-measure__controls">
<input class="wi-number" type="number" id="${ids.number}" data-wi="number" min="0" max="${input.limit}" step="${input.step}" value="${fieldText(input)}"${w.placeholder ? html` placeholder="${w.placeholder}"` : ''} inputmode="decimal" autocomplete="off" aria-describedby="${describedBy}">
<div class="wi-track">
<div class="wi-scale" data-wi="scale" aria-hidden="true">
${input.floor > 0 && html`<span class="wi-dead" data-wi="dead-low" style="--from: 0; --to: ${at.floor}"></span>`}
<span class="wi-dead" data-wi="dead-high" style="--from: ${at.cap}; --to: 1"></span>
<span class="wi-tick wi-tick--median" data-wi="median-mark" style="--at: ${at.median}"></span>
<span class="wi-tick wi-tick--cap" data-wi="cap-mark" style="--at: ${at.cap}"></span>
${input.value !== null && html`<span class="wi-tick wi-tick--start" data-wi="start-mark" style="--at: ${trackStart(input.value, input.max)}" hidden></span>`}
</div>
<label class="vh" for="${ids.slider}">${w.slider}</label>
<input class="wi-range" type="range" id="${ids.slider}" data-wi="slider" min="0" max="${input.max}" step="${input.step}" value="${sliderValue(input)}" aria-valuetext="${input.valuetext}" aria-describedby="${FIELDS_HELP}">
</div>
</div>
<p class="small wi-error" id="${ids.error}" data-wi="error" hidden>${w.invalid}</p>
<p class="wi-echo" data-wi="echo" aria-hidden="true" hidden></p>
<p class="wi-facts" id="${ids.facts}">${w.facts.map((part, i) => html`${i ? ' ' : ''}<span class="nw">${i ? '· ' : ''}${part}</span>`)}</p>
${input.assigned && html`<p class="small" id="${ids.assigned}">${w.assignedHelp}</p>`}
</div>`;
}

// The optional NHSN predicted counts, one field per SIR CMS has a value for, folded into one section after the
// measures; '' when the page takes none.
function predictedBlock(vm, texts) {
  const p = texts.predicted;
  const fields = p ? vm.inputs.filter((input) => !input.assigned && p.label(input.id)) : [];
  if (!fields.length) return '';
  return html`<details class="wi-predicted">
<summary>${p.summary}</summary>
<p class="small muted" id="${PREDICTED_HELP}">${p.help}</p>
${fields.map(({ id }) => html`<div class="wi-predicted__row" data-predicted="${id}">
<label class="small" for="wi-${id}-p">${p.label(id)}</label>
<input class="wi-number" type="number" id="wi-${id}-p" data-wi="predicted" min="0" step="any" inputmode="decimal" autocomplete="off" aria-describedby="${PREDICTED_HELP}">
<p class="small wi-error" id="wi-${id}-pe" data-wi="predicted-error" hidden>${p.invalid}</p>
<p class="small" data-wi="count" hidden></p>
</div>`)}
</details>`;
}

// Each measure's part of the score (z ÷ n), in the fixed measure order, on one scale for the hospital. framed: a page
// frames them as a figure, whose caption is their title (CMS's values): under it, a line dom.js fills once the reader
// changes something (texts.bars.lead(vm); aria-hidden: the live sentence speaks), and behind each bar CMS's own bar
// as an outline, shown once the bar moves.
function bars(vm, words, texts, framed = false) {
  return html`<div class="wi-bars" data-wi="bars">
${framed ? html`<p class="small wi-bars__lead" data-wi="bars-lead" aria-hidden="true" hidden></p>` : html`<p class="h-sm">${texts.bars.heading}</p>`}
<ul class="wi-bars__list" role="list">${vm.inputs.map((input) => {
    const m = vm.result.measures[input.id];
    const span = barSpan(m.contribution, vm.extent);
    const at = `--at: ${fraction(span.at)}; --w: ${fraction(span.width)}`;
    return html`<li data-bar="${input.id}" class="${barClass(input)}">
<span class="wi-bars__name">${words[input.id].short}${input.assigned && html` <span class="muted" data-wi="bar-assigned"${hiddenIf(!assignedNow(input))}>(${texts.bars.assigned})</span>`}</span>
<span class="wi-bars__track">${framed && html`<span class="wi-bar-cms" data-wi="bar-cms" style="${at}" hidden></span>`}<span class="wi-bar" data-wi="bar" style="${at}"></span></span>
<span class="wi-bars__value" data-wi="bar-value">${texts.bars.value(m.contribution)}</span>
</li>`;
  })}</ul>
<p class="small muted">${texts.bars.caption(vm.result.n)}</p>
</div>`;
}

// The solver: one measure at a time, from the starting values (its answers never follow the reader's edits). The
// note column only when some row has a note.
function solverBlock(answers, s) {
  const rows = s.rows(answers);
  const withNote = rows.some((row) => row.note);
  const columns = withNote ? s.columns : s.columns.slice(0, 2);
  return html`<div class="wi-solver" id="wi-solver" data-wi="solver">
<h3 class="h-sm" id="wi-solver-h">${s.question}</h3>
${s.worth && html`<p class="wi-solver__worth">${s.worth}</p>`}
<p class="small muted">${s.caption}</p>
${printout(html`<table class="gb wi-solver__table" aria-labelledby="wi-solver-h">
<thead><tr>${columns.map((c) => html`<th scope="col">${c}</th>`)}</tr></thead>
<tbody>${rows.map((row) => html`<tr><th scope="row">${row.label}</th><td>${row.answer}</td>${withNote && html`<td>${row.note}</td>`}</tr>`)}</tbody>
</table>`)}
</div>`;
}

// vm: the view model of the starting state. wrapBars: optional (barsHtml) -> Safe, a page's frame for the bars (a
// numbered figure, placed right after the inputs, beside the result on a wide screen; its table may carry data-part
// cells, which dom.js fills with each measure's hypothetical part). share (required): the page keeps the reader's changes in its URL (the banner is rendered only then). range: { low, high }, the ramp's national span of scores. solver (required): the
// site's solver answers, which texts.solver.rows() words, or null for none (no button, no table). A view model
// with no result (a hospital with no score) gets nothing.
export function renderWhatIf({ vm, texts, share, range, solver, wrapBars = null }) {
  if (typeof share !== 'boolean') throw new TypeError('renderWhatIf: share must be true or false');
  if (!Number.isFinite(range?.low) || !Number.isFinite(range?.high)) throw new TypeError('renderWhatIf: range { low, high } is required');
  if (solver !== null && !Array.isArray(solver)) throw new TypeError('renderWhatIf: solver must be the solver answers or null');
  if (!vm.result.available) return html``;
  const words = Object.fromEntries(vm.inputs.map((input) => [input.id, texts.measure(input, vm.result.measures[input.id])]));
  return html`<section class="block whatif" id="whatif" aria-labelledby="whatif-h">
<h2 id="whatif-h">${texts.heading}</h2>${texts.label && html`
<p class="wi-label">${texts.label}</p>`}
<p class="wi-intro">${texts.intro}</p>
${share && html`<p class="wi-banner" data-wi="banner" hidden>${texts.banner.text} <a href="${texts.banner.href}">${texts.banner.linkText}</a></p>`}
<p class="small muted" data-wi="nojs">${texts.noScript}</p>
<div class="wi-grid">
<div class="wi-side">
${result(vm, range, texts)}
<p class="small standing">${texts.standing}</p>
</div>
<div class="wi-inputs">
<div data-wi="controls" hidden>
<div class="wi-actions">
<button type="button" class="wi-btn" data-wi="reset" aria-disabled="true">${texts.reset}</button>
<button type="button" class="wi-btn" data-wi="median" aria-describedby="wi-median-help">${texts.median}</button>
${solver && html`<button type="button" class="wi-btn" data-wi="solve" aria-expanded="true" aria-controls="wi-solver">${texts.solver.question}</button>`}
</div>
<p class="small muted" id="wi-median-help">${texts.medianHelp}</p>
</div>
${solver && solverBlock(solver, texts.solver)}
<p class="small wi-weights">${texts.weight(vm.result.n)}</p>
<fieldset class="wi-fields" data-wi="fields" disabled>
<legend class="vh">${texts.fieldsLegend}</legend>
<div class="small muted wi-fields__help" id="${FIELDS_HELP}">${texts.fieldsHelp.map((line) => html`<p>${line}</p>`)}</div>
${vm.inputs.map((input) => measure(input, words[input.id]))}
${predictedBlock(vm, texts)}
</fieldset>
${wrapBars && wrapBars(bars(vm, words, texts, true))}
</div>
</div>
${!wrapBars && bars(vm, words, texts)}
<p class="small print-only">${texts.print}</p>
<p class="small muted">${texts.rampLegend}</p>
<p class="small muted">${texts.held}</p>
</section>`;
}
