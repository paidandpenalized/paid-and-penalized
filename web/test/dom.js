// A stand-in DOM for the combobox's tests (web/client/omnibox.js, and the scripts that mount it on a page's search
// forms): elements that keep what is set on them, and a search form with the parts the combobox looks for.

// An element that keeps its attributes, children and one listener per event type (listeners.<type>, called directly).
export function el(tag) {
  const node = {
    tag, attrs: {}, children: [], listeners: {}, className: '', textContent: '', hidden: false, value: '', id: '', dataset: {},
    setAttribute(k, v) { node.attrs[k] = String(v); },
    getAttribute: (k) => node.attrs[k] ?? null,
    removeAttribute(k) { delete node.attrs[k]; },
    append(...xs) { node.children.push(...xs); },
    replaceChildren(...xs) { node.children = xs; },
    addEventListener(type, fn) { node.listeners[type] = fn; },
    closest(sel) { return sel === '[role="option"]' && node.attrs.role === 'option' ? node : null; },
  };
  return node;
}

// A search form as the build writes it (hidden), with its box, its list ("omni-list", hidden) and its status, for test t:
// a document and a window stand in for the page's during the test, and the real ones (or none) come back after it.
// type(value) types into the box and waits for the list; texts() reads the list's options, each option's parts joined
// by "|".
export function comboForm(t) {
  const saved = { document: globalThis.document, window: globalThis.window };
  globalThis.document = { createElement: el };
  globalThis.window = { location: { assign() {} } };
  t.after(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete globalThis[k];
      else globalThis[k] = v;
    }
  });
  const input = el('input');
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-expanded', 'false');
  const list = el('ul');
  list.id = 'omni-list';
  list.hidden = true;
  const status = el('p');
  const form = el('form');
  form.hidden = true;
  form.querySelector = (s) => ({ '[role="combobox"]': input, '[role="listbox"]': list, '[role="status"]': status })[s];
  const type = async (value) => { input.value = value; await input.listeners.input(); };
  const texts = () => list.children.map((li) => li.children.map((c) => c.textContent).join('|') || li.textContent);
  return { form, input, list, status, type, texts };
}
