// Mounts a HACRP page's what-if with HACRP's rules and words, from the page data the build wrote beside it
// (web/pages/whatif.js): the record, the model, the estimate tags, the texts' page fields and share, and the
// ramp's range. With share, the reader's changes are kept in the URL fragment so a link can share them.
import { mountWhatIf } from '../../../web/whatif/dom.js';
import { whatIfRules } from '../web/whatif-state.js';
import { whatIfTexts } from '../web/whatif-text.js';

export function mountFromPage(dataId) {
  const root = document.querySelector('#whatif');
  const data = document.querySelector(`#${dataId}`);
  if (!root || !data) return;
  const { hospital, model, estimate, page, range } = JSON.parse(data.textContent);
  mountWhatIf(root, { rules: whatIfRules(hospital, model, estimate), texts: whatIfTexts({ hospital, model, ...page }), share: page.share, range });
}
