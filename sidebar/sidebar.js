/**
 * @file sidebar/sidebar.js
 * @description Handles the sidebar container: connects to background.js via port
 *              and forwards messages to the WhatsApp iframe.
 * @context Runs in the sidebar page context.
 */
(function () {
  const iframe = document.getElementById('wa-iframe');

  console.log('[WA Sidebar] Conectando al script de fondo...');
  const port = browser.runtime.connect({ name: 'sidebar' });

  port.onMessage.addListener((message) => {
    if (message.type === 'toggle_internal_panel' || message.type === 'quick_reply') {
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage(message, '*');
      }
    }
  });
})();

