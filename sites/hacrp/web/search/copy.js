// The words the search script (client/search.js) shows in the browser: each option's kind, a place's line, and what
// the status and list say. Kept apart from copy.js so the script on every page carries only these. Same rules as
// copy.js: no digit characters, every number through a {placeholder}.
import { copyOf } from '../../../../web/render/components.js';

export const COPY = {
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
  searchMore: { text: 'All {n} matches, in the table below', claim: null },
};

export const { fill } = copyOf(COPY);
