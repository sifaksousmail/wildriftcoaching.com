(() => {
  const payhipOrigin = 'https://payhip.com';
  const events = new Map([
    ['/b/kXKR7', 'pdf_buy_click'],
    ['/preview/kXKR7', 'pdf_sample_click']
  ]);

  function recordPdfClick(event) {
    if (event.type === 'auxclick' && event.button !== 1) return;

    const link = event.target?.closest?.('a[id][href]');
    const eventName = events.get(link?.pathname);
    if (!eventName || link.origin !== payhipOrigin || !link.id || typeof window.gtag !== 'function') return;

    window.gtag('event', eventName, {
      pdf_button_id: link.id,
      link_url: payhipOrigin + link.pathname
    });
  }

  document.addEventListener('click', recordPdfClick);
  document.addEventListener('auxclick', recordPdfClick);
})();
