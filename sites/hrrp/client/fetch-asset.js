// One of the site's own content-hashed assets (under /assets/, as the build writes them with ctx.asset), fetched and read as
// JSON. what: the asset in words, for the error. A source outside /assets/ is refused, so a page's data-src can never point
// a script at anything else. The callers wrap it in once() each, one asset apiece.
export async function fetchAsset(src, what) {
  // Resolved first, so a source with dot segments ("/assets/../x") is judged by where it leads.
  const url = src ? new URL(src, location.origin) : null;
  if (!url || url.origin !== location.origin || !url.pathname.startsWith('/assets/')) throw new Error(`${what}: not a site asset`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${what}: HTTP ${res.status}`);
  return res.json();
}
