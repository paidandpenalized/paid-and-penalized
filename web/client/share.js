// A share control (a page's [data-share] disclosure): copies the page's link, or a sentence with the link, to the
// clipboard, or hands both to the device's own share sheet where the browser has one (navigator.share). If the browser
// refuses the clipboard, it selects the text for the reader to copy by hand and says so. Nothing is sent anywhere and
// no third-party script runs. The words are the page's own (data-copied, data-failed). Without JavaScript the buttons
// stay hidden and the sentence and link stay selectable.
for (const block of document.querySelectorAll('[data-share]')) {
  const text = block.querySelector('[data-share-text]');
  const url = block.querySelector('[data-share-url]');
  const status = block.querySelector('[data-share-status]');
  if (!text || !url || !status) continue;
  const link = url.textContent.trim();
  const sentence = text.textContent.replace(/\s+/g, ' ').trim();

  const select = (node) => {
    const range = document.createRange();
    range.selectNodeContents(node);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  };

  for (const button of block.querySelectorAll('[data-share-copy]')) {
    const what = button.dataset.shareCopy;
    button.addEventListener('click', async () => {
      // Cleared first, so a second click is announced again.
      status.textContent = '';
      try {
        await navigator.clipboard.writeText(what === 'link' ? link : sentence);
        status.textContent = block.dataset.copied;
      } catch {
        select(what === 'link' ? url : text);
        status.textContent = block.dataset.failed;
      }
    });
    button.hidden = false;
  }

  const native = block.querySelector('[data-share-native]');
  if (native && typeof navigator.share === 'function') {
    native.addEventListener('click', async () => {
      status.textContent = '';
      try {
        await navigator.share({ title: document.title, text: sentence.replace(link, '').trim(), url: link });
      } catch {
        // The reader closed the sheet, or the browser refused: nothing to say.
      }
    });
    native.hidden = false;
  }
}
