// The words of the hospital search box (render/shell.js searchForm) and of its script (client/search.js). Kept apart from
// program/copy.js so the script on every page carries only these, as HACRP does (sites/hacrp/web/search/copy.js). Same rules as the
// other copy tables: no digit characters, every number through a {placeholder}.
import { copyOf } from '../../../../web/render/components.js';

export const COPY = {
  searchHeading: { text: 'Find a hospital', claim: null },
  searchFind: { text: 'Find', claim: null },
  searchFindRest: { text: 'a hospital or place by name, city, state, ZIP code or CCN', claim: null },
  searchPlaceholder: { text: 'Hospital, city or state', claim: null },
  searchKindHospital: { text: 'Hospital', claim: null },
  searchKindState: { text: 'State', claim: null },
  searchKindMetro: { text: 'Metro area', claim: null },
  searchKindRegion: { text: 'Region', claim: null },
  searchKindDivision: { text: 'Division', claim: null },
  searchPlaceSub: { text: '{kind} · {n} hospitals', claim: null },
  searchPlaceSubOne: { text: '{kind} · one hospital', claim: null },
  searchEmpty: { text: "No matches. Try a city, a ZIP code or the hospital's CCN.", claim: null },
  searchCount: { text: '{n} matches', claim: null },
  searchCountOne: { text: 'One match', claim: null },
  searchFailed: { text: "The hospital list didn't load. Leave the box and come back to try again.", claim: null },
};

export const { fill, t } = copyOf(COPY);
