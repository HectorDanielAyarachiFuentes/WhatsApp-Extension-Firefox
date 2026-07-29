/**
 * @file sidebar/sidebar.js
 * @description Handles UI interactions inside the sidebar container.
 *              Defers loading WhatsApp until background.js confirms the
 *              background notification iframe has been fully destroyed,
 *              preventing the "WhatsApp open in another window" conflict.
 * @context Runs in the sidebar page context.
 */
(function () {
  const iframe = document.getElementById('wa-iframe');

  // Show a subtle loading state while waiting for the background to be ready
  iframe.style.background = '#111b21';

  console.log('[WA Sidebar] Sidebar cargado. Esperando señal de background...');

  // Connect to background — this triggers destroyBackgroundIframe() there
  const port = browser.runtime.connect({ name: 'sidebar' });

  port.onMessage.addListener((message) => {
    if (message.type === 'sidebar_ready') {
      // Background iframe is dead — safe to load WhatsApp now
      console.log('[WA Sidebar] Señal recibida. Cargando WhatsApp Web...');
      iframe.src = 'https://web.whatsapp.com/';

    } else if (message.type === 'toggle_internal_panel' || message.type === 'quick_reply') {
      // Forward to WhatsApp inside the iframe
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage(message, '*');
      }
    }
  });
})();
