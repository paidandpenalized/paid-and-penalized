// The family search's words (hub/search/form.js writes the box; hub/client/search.js shows its list): what the box is
// called, each option's kind and second line, and what the status says. Kept apart from copy.js so the script on every
// hub page carries only these. Same rules as copy.js: no digit characters, every number through a {placeholder}.
import { copyOf } from '../../web/render/components.js';

export const COPY = {
  searchHeading: 'Search hospitals and states',
  searchFind: 'Find',
  searchFindRest: 'a hospital or state by name, city or CCN',
  searchPlaceholder: 'Hospital, city or state',
  searchKindHospital: 'Hospital',
  searchKindState: 'State',
  searchPlaceSub: '{kind} · {n} hospitals',
  searchPlaceSubOne: '{kind} · one hospital',
  searchEmpty: "No matches. Try a city, a state or the hospital's CCN.",
  searchCount: '{n} matches',
  searchCountOne: 'One match',
  searchFailed: "The hospital list didn't load. Leave the box and come back to try again.",
};

export const { fill, t } = copyOf(COPY);
