// The "estimate" tag after a modeled dollar figure, linked to how the estimate is made. Its own file, so the browser scripts that
// draw a figure with a dollar figure in it (client/worksheet.js, the what-if) do not pull in the page parts.
import { estTag } from '../../../web/render/components.js';
import { t } from './copy.js';
import { DOLLARS_HREF } from './links.js';

export const estimateTag = estTag({ href: DOLLARS_HREF, label: t('estimateLabel'), text: t('estimate') });
