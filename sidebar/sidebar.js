// sidebar.js — Se inyecta en sidebar.html
(function() {
  console.log('[WA Sidebar] Sidebar cargado, conectando al script de fondo...');
  // Abrir conexión persistente con el script de fondo
  const port = browser.runtime.connect({ name: 'sidebar' });
})();
