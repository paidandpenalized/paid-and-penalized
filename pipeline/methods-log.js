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

// [{ version, date }] for each of a site's headings, in the log's order.
export function siteVersions(log, site) {
  return log.split('\n').map((line) => HEADING.exec(line)).filter((m) => m && m[1] === site).map((m) => ({ version: Number(m[2]), date: m[3] }));
}

export function hasMethodsVersion(log, site, version) {
  return (versionsBySite(log)[site] ?? []).includes(version);
}
