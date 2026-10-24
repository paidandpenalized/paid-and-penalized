// Family-wide settings every page reads: the name, the canonical origin, the family's own pages, the licenses, the
// byline's profile, the feedback form, and each site (its path, names and state). A site with released: false stays
// noindex and out of the sitemap even in a production build.
// pages: the hub's policy pages and the family's Methods, by name; the footer labels each with web/copy.js's word of
// the same name.
// feedback: the shared Google Form, and the names of its two prefilled questions (the site's name, the page's address).
// A site's maintenance: null, or the name of a release the site has not yet been updated for ('FY2027'): while it is
// set, every page of that site carries a banner saying so (layout.js maintenanceBanner).
export const SITE = {
  name: 'Paid & Penalized',
  origin: 'https://paidandpenalized.org',
  pages: { terms: '/terms/', privacy: '/privacy/', about: '/about/', corrections: '/corrections/', accessibility: '/accessibility/', methods: '/methods/' },
  // The site's text, charts and derived data, and its code.
  license: { content: { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' }, code: { name: 'MIT' } },
  // The byline's profile (the About page links it too).
  linkedin: 'https://www.linkedin.com/in/dalton-haslam',
  feedback: {
    url: 'https://docs.google.com/forms/d/e/1FAIpQLSekdB41siZs44_4gLNBGD2OqalK2TGNk7o8Q0bHl20ggYBy_Q/viewform',
    siteEntry: 'entry.2047320042',
    pageEntry: 'entry.1326474028',
  },
  sites: {
    hacrp: { path: '/hacrp/', released: false, maintenance: null, title: 'Hospital-Acquired Conditions', subtitle: 'HACRP' },
  },
};

// The site a page belongs to, by its path: the entry in SITE.sites whose path starts the page's, or null for the
// family's own pages (the hub).
export const siteOf = (path) => Object.values(SITE.sites).find((site) => path.startsWith(site.path)) ?? null;
