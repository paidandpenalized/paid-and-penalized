// The placeholder page at the folder of each program with no page here (web/site.js PLACEHOLDER_PROGRAMS), so the program
// tabs, the footer and the front page's directory never link to a missing page. Laid out as the interim Readmissions page's
// masthead is (hub/hrrp/page.js; its classes, hub/styles.css): the kicker, the program's name, its dek and two ways back,
// beside a status card, a form waiting to be filled in: a hatched band saying the page isn't built, CMS's name for the
// program, and the figures (HVBP's estimate from the dollar file, otherwise none) under a "Not built" stamp. It says what is
// so and promises no page and no date. Never indexed. A program's own page, if one is built, takes the same address.
import { COPY as SHARED } from '../web/copy.js';
import { programDek } from '../web/programs.js';
import { fillCopy, formField, formTitle, sentenceOf, stamp } from '../web/render/components.js';
import { money } from '../web/render/format.js';
import { html } from '../web/render/html.js';
import { SITE } from '../web/site.js';
import { COPY } from './coming/copy.js';
import { COPY as HOME } from './home/copy.js';
import { estimateTag, feedbackLink, hubPage } from './parts.js';

const fill = (key, values) => fillCopy(COPY, key, values);
const sentence = sentenceOf(fill);

// What a program does to payment (web/site.js `group`), in words: the kicker's middle.
const GROUPS = { quality: COPY.groupQuality, price: HOME.soonPrice, reporting: HOME.soonReporting, episode: HOME.soonEpisode };
// A program the dollar estimates include shows what they say about it, in dollars; by program id, from the story's facts.
const MOVED = { hvbp: (facts) => facts.vbpBonus };

const arrow = html`<span class="ico ico--arrow cm__back" aria-hidden="true"></span>`;

// The Figures field's value: the dollars the estimates move between hospitals, with the estimate tag, or none.
function figures(program, facts, fy) {
  if (!program.inData) return fill('figuresNone');
  const moved = MOVED[program.id];
  if (!moved) throw new RangeError(`hub coming: the dollar estimates include "${program.id}" but the page has no figure for it`);
  return html`${sentence('figuresMoved', { amount: html`<b>${money(moved(facts))}</b>` }, { fy })} ${estimateTag()}`;
}

// program: its SITE.programs entry (stage 'soon'); facts: the story's facts (hub/model.js storyFacts); assets: the build's
// (the fiscal year is the shell's, at the card's title bar only when the card shows a figure); robots: the page's robots
// value (noindex).
export function comingPage({ program, facts, assets, robots }) {
  if (!Object.hasOwn(GROUPS, program.group)) throw new RangeError(`hub coming: the page has no words for the group "${program.group}"`);
  const dek = programDek(program.id);
  const fy = String(assets.shell.fy);
  const fields = [
    { label: fill('programLabel'), value: program.long },
    { label: fill('figuresLabel'), value: figures(program, facts, fy) },
  ];
  const body = html`<article class="wrap rd rd--program">
<header class="rd__top">
<div class="rd__intro stack">
<p class="cap kicker rd__kicker">${program.ab} · ${GROUPS[program.group]} · ${program.inData ? COPY.statusInData : COPY.statusConsidered}</p>
<h1 class="rd__title">${program.name}</h1>
<p class="dek">${dek}</p>
<p class="rd__go cm__acts"><a href="/">${arrow} ${SHARED.allPrograms}</a><a href="/#programs">${COPY.livePrograms}</a></p>
</div>
<div class="form rd__sum cm__card">
${formTitle(fill('cardTitle', { ab: program.ab }), program.inData ? `FY${fy}` : null)}
<div class="cm__wait"><p>${COPY.band}</p></div>
${fields.map((field, i) => formField({ no: i + 1, size: 'text', ...field }))}<div class="cm__stamp" aria-hidden="true">${stamp({ label: COPY.stamp, ink: true })}</div>
</div>
</header>
<p class="rd__note">${sentence('ask', { feedback: feedbackLink(program.path) })}</p>
</article>`;
  return hubPage({ title: `${program.name} · ${SITE.name}`, description: dek, path: program.path, robots, body, assets, program: program.id });
}
