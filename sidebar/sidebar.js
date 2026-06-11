// sidebar.js — Se inyecta en sidebar.html
(function() {
  console.log('[WA Sidebar] Sidebar cargado, conectando al script de fondo...');
  // Abrir conexión persistente con el script de fondo
  const port = browser.runtime.connect({ name: 'sidebar' });

  // Escuchar mensajes desde background y reenviarlos al iframe de WhatsApp
  port.onMessage.addListener((msg) => {
    if (msg.type === 'toggle_internal_panel') {
      const iframe = document.querySelector('iframe');
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage(msg, '*');
      }
    }
  });
})();
