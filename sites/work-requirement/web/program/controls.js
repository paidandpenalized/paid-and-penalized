// The stage's head: the scenario switch (low, middle, high; the page opens on the middle case) and the use-rate what-if
// (a slider from the file's params.use_min to use_max in USE_STEP stops, a tick at the default). client/whatif.js
// wires them to the page's state, which every step draws from. Hidden in the markup: without the script nothing could
// move, so the page shows the middle case at the default use rate and no controls.
import { pct } from '../../../../web/render/format.js';
import { html } from '../../../../web/render/html.js';
import { SCENARIOS, USE_STEP } from '../constants.js';
import { fill, t } from '../copy.js';
import { scenWord } from './ranges.js';

const hundredths = (x) => String(Math.round(x * 100));

// params: the file's (use_min, use_max, use_default); selected: the case the page opens on.
export function stageHead(params, selected) {
  const at = (params.use_default - params.use_min) / (params.use_max - params.use_min);
  const value = pct(params.use_default, 0);
  return html`<div class="wr-stage__head" data-stage-head hidden>
<fieldset class="wr-switch"><legend class="vh">${t('switchLabel')}</legend><div class="wr-switch__row">${SCENARIOS.map((s) => html`<label class="wr-switch__opt"><input type="radio" name="wr-scen" value="${s}"${s === selected ? html` checked` : ''}><span>${scenWord(s)}</span></label>`)}</div></fieldset>
<div class="wr-use">
<label class="wr-use__lab" for="wr-use">${t('useLabel')}</label>
<div class="wr-use__row"><div class="wi-track wr-use__track" style="--at: ${at}"><span class="wi-scale" aria-hidden="true"><span class="wi-tick wi-tick--start"></span></span><input class="wi-range" type="range" id="wr-use" min="${hundredths(params.use_min)}" max="${hundredths(params.use_max)}" step="${hundredths(USE_STEP)}" value="${hundredths(params.use_default)}" aria-valuetext="${value}" aria-describedby="wr-use-note"></div><output class="wr-use__v" for="wr-use">${value}</output><p class="wr-use__note" id="wr-use-note">${fill('useNote', { pct: value })}</p><button type="button" class="wr-use__reset" hidden>${fill('useReset', { pct: value })}</button></div>
</div>
</div><!-- /wr-stage__head -->`;
}
