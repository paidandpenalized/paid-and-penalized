// The what-if component's HTML, written at build time. It shows the starting values (CMS's, on a hospital page)
// and their result, and reads correctly without JavaScript: the inputs are disabled and the buttons hidden until
// web/whatif/dom.js mounts it. Every word comes from `texts`, the site's own copy (web/ never imports a site):
//
//   heading, intro, noScript, resultLabel, fieldsLegend, held, standing   strings
//   banner { text, linkText, href }        the shared-link banner (rendered only with share)
//   start, hypothetical                    column heads and the ramp's two mark labels
//   rows { score, decision, cut }          the result table's row heads
//   rampLine, rampLegend                   the ramp's line label and the sentence under it
//   scores(vm) -> { before, after }        score texts
//   flag(flag), cut(flag)                  decision and cut texts (cut: null where there is no cut)
//   sentence(vm), slide(vm)                the result in words; plain text for "Copy for a slide"
//   estimate { text, linkText, href }      shown when a changed measure is a recompute
//   copy, copied, copyFallback, slideLabel, reset, median
//   solver null | { question, caption, columns: [3 strings], rows(vm) -> [{ id, label, answer, note }] }
//   weight(n)                              "each measure weighs 1 ÷ n"
//   measure(input, m) -> { label, short, help, leverage, marks, slider, placeholder, assignedHelp }
//                                          input: a vm.inputs entry; m: its vm.result.measures entry
//   bars { heading, caption(n), value(contribution), assigned }
//   predicted null | { label(id) -> string | null, help, result(delta) }   NHSN counts (label null: no field)
import { scaleLinear } from 'd3-scale';
import { decimal } from '../render/format.js';
import { html, raw } from '../render/html.js';
import { MAX_FACTOR, toUnit } from './fragment.js';
import {
  barExtent, barSpan, fraction, labelAnchor, labelDx, lineScore, rampAt, rampDomain, rampWidth, rampX, trackAt,
} from './marks.js';

const TICKS = 5;
const hiddenIf = (condition) => (condition ? raw(' hidden') : '');
// The decimals that tell ticks a step apart.
const tickDecimals = (ticks) => (ticks.length > 1 ? Math.max(0, Math.ceil(-Math.log10(ticks[1] - ticks[0]) - 1e-9)) : 0);

// A text label at ramp place t, kept inside the figure near either end.
function rampLabel(t, y, text, extra = '') {
  const anchor = labelAnchor(t);
  return html`<text class="wi-ramp__label"${raw(extra)} x="${rampX(t)}" y="${y}" dx="${labelDx(anchor)}" text-anchor="${anchor}">${text}</text>`;
}

// The score's ramp: the hospital's reachable scores, CMS's line with the side above it shaded, a solid mark for
// the starting score and a hollow one, labeled, for the hypothetical. Decorative: the table and sentence say it.
function ramp(vm, texts) {
  const domain = rampDomain(vm.ramp);
  const at = (score) => rampAt(score, domain);
  const ticks = scaleLinear().domain(domain).ticks(TICKS);
  const dp = tickDecimals(ticks);
  const line = at(lineScore(vm.ramp));
  const start = at(vm.ramp.actual);
  const hyp = at(vm.ramp.hypothetical);
  return html`<svg class="wi-ramp" data-wi="ramp" width="100%" height="92" aria-hidden="true" focusable="false">
<defs><path id="wi-tri" d="M0 0L6 11H-6Z"/></defs>
<rect class="wi-ramp__zone" x="${rampX(line)}" y="18" width="${rampWidth(line, 1)}" height="22"/>
${ticks.map((x) => html`<line class="wi-ramp__tick" x1="${rampX(at(x))}" x2="${rampX(at(x))}" y1="36" y2="40"/><text class="wi-ramp__tick-label" x="${rampX(at(x))}" y="32" text-anchor="middle">${decimal(x, dp)}</text>`)}
<line class="wi-ramp__axis" x1="${rampX(0)}" x2="${rampX(1)}" y1="40" y2="40"/>
<line class="wi-ramp__line" x1="${rampX(line)}" x2="${rampX(line)}" y1="16" y2="44"/>
${rampLabel(line, 12, texts.rampLine)}
<use class="wi-tri wi-tri--hyp" data-wi="hyp" href="#wi-tri" x="${rampX(hyp)}" y="44"/>
<use class="wi-tri wi-tri--cms" href="#wi-tri" x="${rampX(start)}" y="44"/>
${rampLabel(start, 68, texts.start)}
${rampLabel(hyp, 84, texts.hypothetical, ' data-wi="hyp-label"')}
</svg>`;
}

function result(vm, texts) {
  const r = vm.result;
  const s = texts.scores(vm);
  const cutBefore = texts.cut(r.before.flag);
  const estimate = vm.inputs.some((i) => i.tagged && r.measures[i.id].changed);
  return html`<div class="wi-result" data-wi="result" role="group" aria-label="${texts.resultLabel}">
<table class="wi-table">
<thead><tr><td></td><th scope="col">${texts.start}</th><th scope="col">${texts.hypothetical}</th></tr></thead>
<tbody>
<tr><th scope="row">${texts.rows.score}</th><td class="cms">${s.before}</td><td class="wi-after" data-wi="score">${s.after}</td></tr>
<tr><th scope="row">${texts.rows.decision}</th><td>${texts.flag(r.before.flag)}</td><td class="wi-after" data-wi="flag">${texts.flag(r.after.flag)}</td></tr>
${cutBefore !== null && html`<tr><th scope="row">${texts.rows.cut}</th><td>${cutBefore}</td><td class="wi-after" data-wi="cut">${texts.cut(r.after.flag)}</td></tr>`}
</tbody>
</table>
${ramp(vm, texts)}
<p class="small muted">${texts.rampLegend}</p>
<p class="wi-sentence" data-wi="sentence" aria-live="polite">${texts.sentence(vm)}</p>
<p class="small wi-est" data-wi="estimate"${hiddenIf(!estimate)}>${texts.estimate.text} <a href="${texts.estimate.href}">${texts.estimate.linkText}</a></p>
<p class="wi-copy"><button type="button" class="wi-btn" data-wi="copy" hidden>${texts.copy}</button> <span class="small" data-wi="copy-status" role="status"></span></p>
<textarea class="wi-slide" data-wi="slide" rows="8" readonly aria-label="${texts.slideLabel}" hidden></textarea>
</div>`;
}

// One measure: its number field (blank where CMS assigned the score) and slider over a track marking the national
// median, CMS's cap (and a floor above zero) and the shaded values that score the same; its leverage; and, for an
// SIR CMS has a value for, the optional NHSN predicted count.
function measure(input, vm, model, texts) {
  const { id } = input;
  const p = model.params[id];
  const w = texts.measure(input, vm.result.measures[id]);
  const at = (value) => fraction(trackAt(value, input.max));
  const ids = { number: `wi-${id}-n`, slider: `wi-${id}-r`, help: `wi-${id}-h`, marks: `wi-${id}-m`, leverage: `wi-${id}-l`, assigned: `wi-${id}-a` };
  const describedBy = [ids.help, ids.marks, ids.leverage, input.assigned && ids.assigned].filter(Boolean).join(' ');
  const predicted = !input.assigned && texts.predicted?.label(id);
  return html`<div class="wi-measure" data-measure="${id}">
<label class="wi-measure__label" for="${ids.number}">${w.label}</label>
<p class="small muted" id="${ids.help}">${w.help}</p>
<div class="wi-measure__controls">
<input class="wi-number" type="number" id="${ids.number}" data-wi="number" min="0" max="${toUnit(MAX_FACTOR * p.cap, p.decimals)}" step="${input.step}" value="${input.value === null ? '' : input.value.toFixed(p.decimals)}"${w.placeholder ? html` placeholder="${w.placeholder}"` : ''} inputmode="decimal" autocomplete="off" aria-describedby="${describedBy}">
<div class="wi-track">
<div class="wi-scale" data-wi="scale" aria-hidden="true">
${p.floor > 0 && html`<span class="wi-dead" data-wi="dead-low" style="--from: 0; --to: ${at(p.floor)}"></span>`}
<span class="wi-dead" data-wi="dead-high" style="--from: ${at(p.cap)}; --to: 1"></span>
<span class="wi-tick wi-tick--median" data-wi="median-mark" style="--at: ${at(input.median)}"></span>
<span class="wi-tick wi-tick--cap" data-wi="cap-mark" style="--at: ${at(p.cap)}"></span>
</div>
<label class="vh" for="${ids.slider}">${w.slider}</label>
<input class="wi-range" type="range" id="${ids.slider}" data-wi="slider" min="0" max="${input.max}" step="${input.step}" value="${input.value ?? input.max}" aria-valuetext="${input.valuetext}" aria-describedby="${ids.help}">
</div>
</div>
<p class="small muted" id="${ids.marks}">${w.marks}</p>
<p class="small" id="${ids.leverage}">${w.leverage}</p>
${input.assigned && html`<p class="small" id="${ids.assigned}">${w.assignedHelp}</p>`}
${predicted && html`<div class="wi-predicted">
<label class="small" for="wi-${id}-p">${predicted}</label>
<input class="wi-number" type="number" id="wi-${id}-p" data-wi="predicted" min="0" step="any" inputmode="decimal" autocomplete="off" aria-describedby="wi-${id}-ph">
<p class="small muted" id="wi-${id}-ph">${texts.predicted.help}</p>
<p class="small" data-wi="count" hidden></p>
</div>`}
</div>`;
}

// Each measure's part of the score (z ÷ n), in the fixed measure order, on one scale for the hospital.
function bars(vm, model, texts) {
  const extent = barExtent(vm.result, model);
  return html`<div class="wi-bars" data-wi="bars">
<p class="h-sm">${texts.bars.heading}</p>
<ul class="wi-bars__list" role="list">${vm.inputs.map((input) => {
    const m = vm.result.measures[input.id];
    const span = barSpan(m.contribution, extent);
    return html`<li data-bar="${input.id}" class="wi-bars__row${input.assigned ? ' wi-bars__row--assigned' : ''}">
<span class="wi-bars__name">${texts.measure(input, m).short}${input.assigned && html` <span class="muted">(${texts.bars.assigned})</span>`}</span>
<span class="wi-bars__track"><span class="wi-bar" data-wi="bar" style="--at: ${fraction(span.at)}; --w: ${fraction(span.width)}"></span></span>
<span class="wi-bars__value" data-wi="bar-value">${texts.bars.value(m.contribution)}</span>
</li>`;
  })}</ul>
<p class="small muted">${texts.bars.caption(vm.result.n)}</p>
</div>`;
}

// The solver: one measure at a time, from the starting values (vm.solver never follows the reader's edits).
function solver(vm, s) {
  return html`<div class="wi-solver" id="wi-solver" data-wi="solver">
<h3 class="h-sm">${s.question}</h3>
<p class="small muted">${s.caption}</p>
<div class="printout"><div class="printout__scroll"><table class="gb wi-solver__table">
<thead><tr>${s.columns.map((c) => html`<th scope="col">${c}</th>`)}</tr></thead>
<tbody>${s.rows(vm).map((row) => html`<tr><th scope="row">${row.label}</th><td>${row.answer}</td><td>${row.note}</td></tr>`)}</tbody>
</table></div></div>
</div>`;
}

// vm: viewModel() of the starting state. share: the page keeps the reader's changes in its URL (the banner is
// rendered only then). hospital is the record vm was built from. A hospital with no score gets nothing.
export function renderWhatIf({ vm, hospital, model, texts, share = true }) {
  if (!vm.result.available || !hospital) return html``;
  return html`<section class="block whatif" id="whatif" aria-labelledby="whatif-h">
<h2 id="whatif-h">${texts.heading}</h2>
<p>${texts.intro}</p>
${share && html`<p class="wi-banner" data-wi="banner" hidden>${texts.banner.text} <a href="${texts.banner.href}">${texts.banner.linkText}</a></p>`}
<p class="small muted" data-wi="nojs">${texts.noScript}</p>
<div class="wi-grid">
${result(vm, texts)}
<div class="wi-inputs">
<div class="wi-actions" data-wi="controls" hidden>
<button type="button" class="wi-btn" data-wi="reset">${texts.reset}</button>
<button type="button" class="wi-btn" data-wi="median">${texts.median}</button>
${texts.solver && html`<button type="button" class="wi-btn" data-wi="solve" aria-expanded="true" aria-controls="wi-solver">${texts.solver.question}</button>`}
</div>
<p class="small">${texts.weight(vm.result.n)}</p>
<fieldset class="wi-fields" data-wi="fields" disabled>
<legend class="vh">${texts.fieldsLegend}</legend>
${vm.inputs.map((input) => measure(input, vm, model, texts))}
</fieldset>
</div>
</div>
${bars(vm, model, texts)}
${texts.solver && solver(vm, texts.solver)}
<p class="small muted">${texts.held}</p>
<p class="standing">${texts.standing}</p>
</section>`;
}
