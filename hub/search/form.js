// The family search's box (render/shell.js searchForm) in the hub's words: a combobox over the hub's asset (src) that
// hub/client/search.js mounts and shows; hidden without JavaScript. id: the box's own prefix and the form's id (the
// bar's is "omni", which the phone's find button controls).
import { searchForm } from '../../web/render/shell.js';
import { t } from './copy.js';

export const hubSearchForm = (src, { id = 'omni' } = {}) => searchForm({
  id, src, hub: true, label: t('searchHeading'), find: t('searchFind'), findRest: t('searchFindRest'), placeholder: t('searchPlaceholder'),
});
