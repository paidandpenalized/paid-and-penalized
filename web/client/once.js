// A promise made once and shared: once(make) returns a function that calls make() on its first call and gives every
// later call the same promise; if it fails, the next call tries again. For an asset a page's scripts fetch when first
// needed.
export function once(make) {
  let pending = null;
  return (...args) => (pending ??= make(...args).catch((error) => {
    pending = null;
    throw error;
  }));
}
