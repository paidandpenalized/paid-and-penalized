// The state a page's default or random hospital is never drawn from: the family's rule for any hospital a page picks for
// the reader (the work requirement's Find and "Show another at random", TEAM's "Show one at random"). Its own module, so
// a page script can read it without taking a site's constants (and what they import) along.
export const DEFAULT_SKIP_STATE = 'VA';
