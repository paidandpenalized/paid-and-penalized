// docs/METHODS-LOG.md headings: "## <site> methods_version <n> (<YYYY-MM-DD>)". One format, read by the
// emitted-data tests and the CI change gate.
export const METHODS_LOG = 'docs/METHODS-LOG.md';
const HEADING = /^## (\S+) methods_version (\d+) \((\d{4}-\d{2}-\d{2})\)$/;

// The highest methods_version the log records for a site, or null.
export function latestMethodsVersion(log, site) {
  const versions = log
    .split('\n')
    .map((line) => HEADING.exec(line))
    .filter((m) => m && m[1] === site)
    .map((m) => Number(m[2]));
  return versions.length > 0 ? Math.max(...versions) : null;
}

// Sites that gained a heading in a unified diff of the log (added lines start with "+").
export function sitesWithAddedHeading(logDiff) {
  return new Set(
    logDiff
      .split('\n')
      .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
      .map((line) => HEADING.exec(line.slice(1))?.[1])
      .filter(Boolean),
  );
}
