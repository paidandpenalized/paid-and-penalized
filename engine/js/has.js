// Whether obj has key as its own property. Browser-safe: the page bundles target ES2020, and Object.hasOwn is
// ES2022 (esbuild lowers syntax, not built-ins), so code that reaches a browser uses this.
export const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
