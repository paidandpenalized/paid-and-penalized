// Family-wide settings every page reads: the name, the canonical origin, the family's own pages, the licenses, the
// byline's profile, the feedback form, the hub's state and each site (its path, names and state). The hub or a site
// with released: false stays noindex and out of the sitemap even in a production build; go-live flips them here.
// pages: the hub's policy pages and the family's Methods, by name, in the footer's order. The footer links Terms in
// its text (web/copy.js's termsLink) and lists the rest, each labelled with web/copy.js's word of the same name.
// feedback: the shared Google Form, and the names of its two prefilled questions (the site's name, the page's address).
export const SITE = {
  name: 'Paid & Penalized',
  origin: 'https://paidandpenalized.org',
  pages: { terms: '/terms/', about: '/about/', methods: '/methods/', privacy: '/privacy/', corrections: '/corrections/', accessibility: '/accessibility/' },
  // The site's text, charts and derived data, and its code.
  license: { content: { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' }, code: { name: 'MIT' } },
  // The byline's profile (the About page links it too).
  linkedin: 'https://www.linkedin.com/in/dalton-haslam',
  feedback: {
    url: 'https://docs.google.com/forms/d/e/1FAIpQLSekdB41siZs44_4gLNBGD2OqalK2TGNk7o8Q0bHl20ggYBy_Q/viewform',
    siteEntry: 'entry.2047320042',
    pageEntry: 'entry.1326474028',
  },
  // The family's own pages (the hub's): noindex in every build until the hub is built.
  hub: { released: false },
  sites: {
    hacrp: { path: '/hacrp/', released: false, title: 'Hospital-Acquired Conditions', subtitle: 'HACRP' },
  },
};

// The site a page belongs to, by its path: the entry in SITE.sites whose path starts the page's, or null for the
// family's own pages (the hub).
export const siteOf = (path) => Object.values(SITE.sites).find((site) => path.startsWith(site.path)) ?? null;
