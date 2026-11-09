// Ported from Thirty Day Readmissions (web/src/js/model.js at 33d1959).

export const TEACH_LABEL = { none: 'Non-teaching', minor: 'Minor teaching', major: 'Major teaching' };

// `slug`, `BED_BANDS` and `bedBand` differ on purpose from engine/js/peers.js's size bands and the HACRP site's `slug`:
// they are Thirty Day Readmissions' four bands and letters-only slugs, kept so the port behaves identically.
export const slug = (s) => String(s ?? '').toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');

export function scopeFilter({ view, key }) {
  switch (view) {
    case 'state': return (h) => h.st === key;
    case 'metro': return (h) => h.cbsa === key;
    case 'division': return (h) => slug(h.division) === key;
    case 'region': return (h) => slug(h.region) === key;
    default: return () => true;
  }
}

export const BED_BANDS = ['<100', '100–299', '300–499', '500+'];
export function bedBand(beds) {
  if (beds == null) return null;
  if (beds < 100) return BED_BANDS[0];
  if (beds < 300) return BED_BANDS[1];
  if (beds < 500) return BED_BANDS[2];
  return BED_BANDS[3];
}

const norm = (s) => String(s ?? '').toLowerCase();

export function applyFilters(list, f = {}) {
  const text = norm(f.text).trim();
  return list.filter((h) =>
    (!f.penalized || h.paf < 1)
    && (f.st == null || h.st === f.st)
    && (f.peer == null || h.peer === f.peer)
    && (f.teach == null || h.teach === f.teach)
    && (f.beds == null || bedBand(h.beds) === f.beds)
    && (f.urban == null || h.urban === f.urban)
    && (f.cond == null || h.c?.[f.cond]?.flag === 1)
    && (!text || norm(`${h.name} ${h.alias ?? ''} ${h.city ?? ''} ${h.st} ${h.id}`).includes(text)));
}
