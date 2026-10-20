// The program page's hospital search: a native datalist of hospital names; choosing one opens its page. Without
// JavaScript the search stays hidden.
const data = document.getElementById('hacrp-search-data');
const box = document.querySelector('.search');

if (data && box) {
  const input = box.querySelector('input');
  const list = box.querySelector('datalist');
  const rows = JSON.parse(data.textContent).filter(([ccn]) => /^[0-9a-z]{6}$/.test(ccn));

  // "Name, City, ST"; a label two hospitals share also carries the CCN.
  const label = ([, name, city, state]) => `${name}, ${city}, ${state}`;
  const seen = new Map();
  for (const row of rows) seen.set(label(row), (seen.get(label(row)) ?? 0) + 1);
  const paths = new Map();
  for (const row of rows) {
    const text = seen.get(label(row)) > 1 ? `${label(row)} (CCN ${row[0].toUpperCase()})` : label(row);
    paths.set(text, `/hacrp/hospital/${row[0]}/`);
    const option = document.createElement('option');
    option.value = text;
    list.append(option);
  }

  const go = (path) => { if (path) window.location.assign(path); };
  input.addEventListener('input', () => go(paths.get(input.value)));
  // Enter opens the one hospital whose label contains what was typed, if only one does.
  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    const query = input.value.trim().toLowerCase();
    if (!query) return;
    const matches = [...paths.keys()].filter((text) => text.toLowerCase().includes(query));
    if (matches.length === 1) go(paths.get(matches[0]));
  });
  box.hidden = false;
}
