// The citation block's Copy button (components.js, citation): copies the block's text, then says so in the block's
// status line. If the browser refuses (or has no clipboard), it selects the text for the reader to copy by hand and
// says that instead. The words are the page's own (data-copied, data-failed). Without JavaScript the button stays
// hidden and the text stays selectable.
import { copyOrSelect } from './clipboard.js';

for (const block of document.querySelectorAll('.cite')) {
  const button = block.querySelector('[data-cite-copy]');
  const text = block.querySelector('[data-cite-text]');
  const status = block.querySelector('[data-cite-status]');
  if (!button || !text || !status) continue;

  button.addEventListener('click', () => copyOrSelect({ text: text.textContent, node: text, status, copied: block.dataset.copied, failed: block.dataset.failed }));
  button.hidden = false;
}
