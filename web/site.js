// Family-wide settings every page reads: the name, the canonical origin, the feedback form, and each site (its path,
// names and state). A site with released: false stays noindex and out of the sitemap even in a production build.
export const SITE = {
  name: 'Paid & Penalized',
  origin: 'https://paidandpenalized.org',
  feedbackUrl: 'https://docs.google.com/forms/d/e/1FAIpQLSekdB41siZs44_4gLNBGD2OqalK2TGNk7o8Q0bHl20ggYBy_Q/viewform',
  sites: {
    hacrp: { path: '/hacrp/', released: false, maintenance: null, title: 'Hospital-Acquired Conditions', subtitle: 'HACRP' },
  },
};
