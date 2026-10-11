// Keep the existing form endpoints and field names; translate only displayed copy.
const labels: Record<string, string> = {
  'Email': 'E-mail', "What's on your mind?": 'Co máte na mysli?',
  'Submit': 'Odeslat', 'Please wait...': 'Čekejte prosím…',
  'An email address is required.': 'Vyplňte e-mailovou adresu.',
  'A message is required.': 'Napište zprávu.', 'This is required.': 'Toto pole je povinné.',
  'Thank you for your submission!': 'Děkujeme za odeslání!',
  'Thank you for subscribing!': 'Děkujeme za přihlášení k odběru!',
};
export function localizeForm(panel: HTMLElement) {
  const translate = () => {
    const walker = document.createTreeWalker(panel, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (node.parentElement?.closest('script, style, textarea')) continue;
      const original = node.textContent ?? '';
      const replacement = labels[original.trim()];
      if (replacement) node.textContent = original.replace(original.trim(), replacement);
    }
  };
  translate();
  // The embed and its validation/status messages arrive asynchronously.
  const observer = new MutationObserver(translate);
  observer.observe(panel, {childList: true, subtree: true, characterData: true});
  window.addEventListener('pagehide', () => observer.disconnect(), {once: true});
}
