// The family search's box in the shell's bar (render/shell.js searchForm, id "omni", which the phone's find button
// controls), in the hub's words: a combobox over the hub's asset (src) that hub/client/search.js mounts and shows; hidden
// without JavaScript.
import { searchForm } from '../../web/render/shell.js';
import { t } from './copy.js';

export const hubSearchForm = (src) => searchForm({
  id: 'omni', src, hub: true, label: t('searchHeading'), find: t('searchFind'), findRest: t('searchFindRest'), placeholder: t('searchPlaceholder'),
});
