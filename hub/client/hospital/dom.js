// The hospital page's scripts' one element builder: node(tag, attributes, children) makes an HTML element with each
// attribute set (one whose value is null or undefined is left off) and the children (elements or text) appended.
export function node(tag, attrs = {}, kids = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined) n.setAttribute(k, String(v));
  n.append(...kids);
  return n;
}
