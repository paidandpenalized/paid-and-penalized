// docs/METHODS-LOG.md headings: "## <site> methods_version <n> (<YYYY-MM-DD>)". One format, read by the
// emitted-data tests and the CI change gate.
export const METHODS_LOG = 'docs/METHODS-LOG.md';
const HEADING = /^## (\S+) methods_version (\d+) \((\d{4}-\d{2}-\d{2})\)$/;

// { site: [versions...] } for every heading in the log.
function versionsBySite(log) {
  const out = {};
  for (const line of log.split('\n')) {
    const m = HEADING.exec(line);
    if (m) (out[m[1]] ??= []).push(Number(m[2]));
  }
  return out;
}

// The highest methods_version the log records for a site, or null.
export function latestMethodsVersion(log, site) {
  const v = versionsBySite(log)[site];
  return v ? Math.max(...v) : null;
}

export function hasMethodsVersion(log, site, version) {
  return (versionsBySite(log)[site] ?? []).includes(version);
}

// Sites whose newest methods_version went up between two versions of the log. Editing or re-adding an existing
// heading is not a bump.
export function sitesBumped(before, after) {
  return new Set(
    Object.keys(versionsBySite(after)).filter((site) => latestMethodsVersion(after, site) > (latestMethodsVersion(before, site) ?? 0)),
  );
}
