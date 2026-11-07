// One of the site's own content-hashed assets (under /assets/, as the build writes them with ctx.asset), fetched and read as
// JSON. what: the asset in words, for the error. A source outside /assets/ is refused, so a page's data-src can never point
// a script at anything else. The callers wrap it in once() each, one asset apiece.
// Whether src is one of the site's assets: resolved first, so a source with dot segments ("/assets/../x") is judged by where
// it leads; a source that is no URL at all is not one.
export function isSiteAsset(src) {
  try {
    const url = new URL(src, location.origin);
    return url.origin === location.origin && url.pathname.startsWith('/assets/');
  } catch {
    return false;
  }
}

export async function fetchAsset(src, what) {
  if (!src || !isSiteAsset(src)) throw new Error(`${what}: not a site asset`);
  const res = await fetch(new URL(src, location.origin));
  if (!res.ok) throw new Error(`${what}: HTTP ${res.status}`);
  return res.json();
}
