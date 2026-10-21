// A hospital page's what-if: reads the page's own record (the JSON the build wrote beside the component) and mounts
// the shared component with HACRP's words. The reader's changes are kept in the URL fragment so a link can share them.
import { mountWhatIf } from '../../../web/whatif/dom.js';
import { whatIfRules } from '../web/whatif-state.js';
import { whatIfTexts } from '../web/whatif-text.js';

const root = document.getElementById('whatif');
const data = document.getElementById('hacrp-hospital');

if (root && data) {
  const { hospital, model, estimate, page, range } = JSON.parse(data.textContent);
  mountWhatIf(root, { rules: whatIfRules(hospital, model, estimate), texts: whatIfTexts({ hospital, model, ...page }), share: true, range });
}
