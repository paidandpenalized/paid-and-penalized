// Saves text as a CSV file the reader downloads: a link made for the click, then dropped. Some browsers start a download
// after click() returns; revoking its blob URL at once can cancel it. A minute is ample, and one CSV's blob is small.
const REVOKE_MS = 60000;

export function saveCsv(text, name) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_MS);
}
