// A placeholder at the folder of each program without a site here (web/site.js PLACEHOLDER_PROGRAMS), so the program tabs
// and the footer never link to a missing page: the program's name, its dek, a line saying its page is coming and the
// way back to the front page, under the program's own tab. Never indexed. The program's full coming-soon page (or, for
// Readmissions, its interim page) takes its place at the same address.
import { COPY as SHARED } from '../web/copy.js';
import { programDek } from '../web/programs.js';
import { html } from '../web/render/html.js';
import { SITE } from '../web/site.js';
import { COPY } from './copy.js';
import { hubPage } from './parts.js';

// program: its SITE.programs entry; robots: the page's robots value (noindex).
export function comingPage({ program, assets, robots }) {
  const dek = programDek(program.id);
  const body = html`<article class="wrap page">
<header class="page__head">
<h1>${program.name}</h1>
<p class="dek">${dek}</p>
</header>
<p>${COPY.comingNote} <a href="/">${SHARED.allPrograms}</a></p>
</article>`;
  return hubPage({ title: `${program.name} · ${SITE.name}`, description: dek, path: program.path, robots, body, assets, program: program.id });
}
