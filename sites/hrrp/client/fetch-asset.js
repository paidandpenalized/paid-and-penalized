// One of the site's own content-hashed assets (under /assets/, as the build writes them with ctx.asset), fetched and read as
// JSON. what: the asset in words, for the error. A source outside /assets/ is refused, so a page's data-src can never point
// a script at anything else. The callers wrap it in once() each, one asset apiece.
// src as one of the site's assets, resolved (so a source with dot segments, "/assets/../x", is judged by where it leads), or
// null for any other source, or one that is no URL at all.
function siteAsset(src) {
  try {
    const url = new URL(src, location.origin);
    return url.origin === location.origin && url.pathname.startsWith('/assets/') ? url : null;
  } catch {
    return null;
  }
}

export async function fetchAsset(src, what) {
  const url = siteAsset(src);
  if (!url) throw new Error(`${what}: not a site asset`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${what}: HTTP ${res.status}`);
  return res.json();
}
