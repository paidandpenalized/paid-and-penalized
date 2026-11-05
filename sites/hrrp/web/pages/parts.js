// The Readmissions pages' shared parts: the family shell's fields (the section menu to the program page's Parts and
// Methods), and the hospital the header follows.
import { lastCall } from '../../../../web/render/components.js';
import { COPY as SHARED } from '../../../../web/copy.js';
import { fill, t } from '../copy.js';
import { METHODS_PATH, PROGRAM_PATH } from '../links.js';

// The program page's Parts the section menu links to, by id (the program page gives each Part its id), then Methods.
export const SECTIONS = Object.freeze(['how', 'picture', 'map', 'history', 'explore', 'research']);

const labelOf = (id, edition) => (id === 'picture' ? fill('navPicture', { edition }) : t(`nav${id[0].toUpperCase()}${id.slice(1)}`));

// The family shell's fields for a Readmissions page (layout.js page(): sheets, program, sections, current, hospital):
// the site's stylesheet, the Readmissions tab and the numbered section menu, the "picture" Part labeled with the
// edition ("The FY2027 picture"). current: the id to mark, or null. The parts every page of a build shares are built
// once for each current item. edition: the edition's label.
const shellParts = lastCall(({ edition, current }) => [edition, current], ({ edition, current }) => ({
  sheets: ['hrrp'],
  program: 'hrrp',
  sections: [
    ...SECTIONS.map((id) => ({ id, label: labelOf(id, edition), href: `${PROGRAM_PATH}#${id}` })),
    { id: 'methods', label: SHARED.methods, href: METHODS_PATH },
  ],
  current,
}));
export const shellOf = ({ edition, current = null, hospital = null }) => ({ ...shellParts({ edition, current }), hospital });

// The hospital a Readmissions hospital page's header follows (render/shell.js familyHeader): its CCN and name; no
// estimated net (the chip's figure is the family's dollars across programs). Every hospital with a page here is in
// Thirty Day Readmissions' file, so the Readmissions tab opens its page. inHub false: the hub and HACRP have no page for
// it, so the tabs and the chip link none.
export const followed = ({ ccn, name, inHub }) => ({ ccn, name, net: null, inTdr: true, inHub });
