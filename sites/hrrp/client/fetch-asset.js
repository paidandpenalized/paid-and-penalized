// One of the site's own content-hashed assets (under /assets/, as the build writes them with ctx.asset), fetched and read as
// JSON. what: the asset in words, for the error. A source outside /assets/ is refused, so a page's data-src can never point
// a script at anything else. The callers wrap it in once() each, one asset apiece.
export async function fetchAsset(src, what) {
  if (!src?.startsWith('/assets/')) throw new Error(`${what}: not a site asset`);
  const res = await fetch(src);
  if (!res.ok) throw new Error(`${what}: HTTP ${res.status}`);
  return res.json();
}
