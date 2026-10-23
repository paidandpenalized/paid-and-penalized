// Copies a page's text for the reader (the citation's Copy button, the share control's): to the clipboard, saying so in
// the status line; or, where the browser refuses (or has no clipboard), it selects the text's own element for the reader to
// copy by hand and says that instead. The words (copied, failed) are the page's own.
export async function copyOrSelect({ text, node, status, copied, failed }) {
  // Cleared first, so a second click is announced again.
  status.textContent = '';
  try {
    await navigator.clipboard.writeText(text);
    status.textContent = copied;
  } catch {
    const range = document.createRange();
    range.selectNodeContents(node);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    status.textContent = failed;
  }
}
