// The program page's top: the kicker, the title and the family's dek for the scenario (web/programs.js programDek), set at
// the head of step 1's words column, beside the strips (A1's page top; the masthead's Find stands in for a search here).
import { programDek } from '../../../../web/programs.js';
import { html } from '../../../../web/render/html.js';
import { t } from '../copy.js';

export const pageTop = () => html`<header class="page__head wr__top">
<p class="cap kicker">${t('kicker')}</p>
<h1>${t('title')}</h1>
<p class="dek">${programDek('work-requirement')}</p>
</header>`;
