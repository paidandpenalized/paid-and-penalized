// Copies a page's text for the reader (the citation's Copy button, the share control's, the TEAM calculator's link): to
// the clipboard, saying so in the status line; or, where the browser refuses (or has no clipboard), it selects the text's
// own element for the reader to copy by hand and says that instead. The words (copied, failed) are the page's own.
// reveal: called before that selection, for a page whose element stays hidden until a copy fails. Returns whether the
// clipboard took the text.
export async function copyOrSelect({ text, node, status, copied, failed, reveal = null }) {
  // Cleared first, so a second click is announced again.
  status.textContent = '';
  try {
    await navigator.clipboard.writeText(text);
    status.textContent = copied;
    return true;
  } catch {
    reveal?.();
    const range = document.createRange();
    range.selectNodeContents(node);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    status.textContent = failed;
    return false;
  }
}
