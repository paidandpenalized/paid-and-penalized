// Placeholders for the pages the next batch writes (the program page's Parts, the place pages and Methods), so that the
// links the hospital pages carry (the breadcrumb, the section menu, the estimate tag) land on a page and an id while
// the build is checked. Each is a title and a heading; the batch that writes the real page replaces its stub here.
import { html } from '../../../web/render/html.js';
import { page } from '../../../web/render/layout.js';
import { programDek } from '../../../web/programs.js';
import { SITE } from '../../../web/site.js';
import { METHODS_PATH, PROGRAM_PATH } from './links.js';
import { SECTIONS, shellOf } from './pages/parts.js';

const NAME = SITE.sites.hrrp.title;

function stub({ path, title, description, ids = [], edition, robots, assets }) {
  const body = html`<article class="wrap page">
<header class="page__head">
<h1>${title}</h1>
<p class="dek">${description}</p>
</header>
${ids.map((id) => html`<section id="${id}"></section>
`)}</article>`;
  return page({ title: `${title} · ${NAME} · ${SITE.name}`, description, path, robots, body, assets, ...shellOf({ edition }) });
}

export const programStub = (args) => stub({ ...args, path: PROGRAM_PATH, title: NAME, description: programDek('hrrp'), ids: SECTIONS });

export const methodsStub = (args) => stub({ ...args, path: METHODS_PATH, title: 'Methods', description: programDek('hrrp'), ids: ['methods-dollars'] });

export const placeStub = (place, args) => stub({ ...args, path: place.path, title: place.name, description: programDek('hrrp') });
