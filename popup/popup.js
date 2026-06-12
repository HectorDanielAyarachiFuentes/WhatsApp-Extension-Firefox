/**
 * @file popup/popup.js
 * @description Handles the extension popup when clicking the icon. Currently delegates to opening the sidebar.
 * @context Runs in the popup page context.
 */
// popup.js — Lógica del popup de previsualización

(async function () {
  const tabsContainer = document.getElementById('tabs-container');
  const previewContainer = document.getElementById('preview-container');
  const headerCount = document.getElementById('header-count');
  const previewEmpty = document.getElementById('preview-empty');
  const openBtn = document.getElementById('open-whatsapp');

  // Pedir los datos al background script
  const response = await browser.runtime.sendMessage({ type: 'get_unread' });
  const chats = response && response.chats ? response.chats : [];

  if (chats.length === 0) {
    // Si no hay mensajes, mostramos la pantalla vacía
    previewEmpty.style.display = 'block';
    headerCount.textContent = '0';
  } else {
    // Ocultar el mensaje vacío
    previewEmpty.style.display = 'none';
    headerCount.textContent = String(chats.length);
  }

  // Crear una pestaña y un panel de preview por cada contacto
  chats.forEach((chat, index) => {
    // --- Tab ---
    const tab = document.createElement('div');
    tab.className = 'tab' + (index === 0 ? ' active' : '');
    tab.dataset.index = index;

    const tabName = document.createElement('span');
    tabName.className = 'tab-name';
    tabName.textContent = chat.name;

    const tabBadge = document.createElement('span');
    tabBadge.className = 'tab-badge';
    tabBadge.textContent = chat.count;

    tab.appendChild(tabName);
    tab.appendChild(tabBadge);
    tabsContainer.appendChild(tab);

    // --- Preview card ---
    const card = document.createElement('div');
    card.className = 'preview-card' + (index === 0 ? ' active' : '');
    card.dataset.index = index;

    // Header del preview
    const header = document.createElement('div');
    header.className = 'preview-header';

    const name = document.createElement('span');
    name.className = 'preview-name';
    name.textContent = chat.name;

    const time = document.createElement('span');
    time.className = 'preview-time';
    time.textContent = chat.time || '';

    header.appendChild(name);
    header.appendChild(time);
    card.appendChild(header);

    // Conteo
    const countInfo = document.createElement('div');
    countInfo.className = 'preview-count';
    countInfo.textContent = `${chat.count} mensaje(s) sin leer`;
    card.appendChild(countInfo);

    // Mensaje preview
    if (chat.preview) {
      const msg = document.createElement('div');
      msg.className = 'preview-message';
      msg.textContent = chat.preview;
      card.appendChild(msg);
    } else {
      const noMsg = document.createElement('div');
      noMsg.className = 'preview-no-msg';
      noMsg.textContent = 'Vista previa no disponible';
      card.appendChild(noMsg);
    }

    // --- Respuesta Rápida ---
    const replyContainer = document.createElement('div');
    replyContainer.className = 'quick-reply-container';

    const replyInput = document.createElement('input');
    replyInput.type = 'text';
    replyInput.className = 'quick-reply-input';
    replyInput.placeholder = 'Escribe una respuesta rápida...';

    const replyBtn = document.createElement('button');
    replyBtn.className = 'quick-reply-btn';
    replyBtn.innerHTML = '➤'; // Icono de flecha (enviar)

    // Lógica para enviar
    const handleSend = async () => {
      const text = replyInput.value.trim();
      if (!text) return;

      replyInput.disabled = true;
      replyBtn.disabled = true;
      replyBtn.innerHTML = '...';

      // Enviar la orden al background
      const result = await browser.runtime.sendMessage({
        type: 'quick_reply',
        contact: chat.name,
        message: text
      });

      if (result && result.success) {
        replyInput.value = '';
        replyInput.placeholder = 'Enviado ✓';
        replyBtn.innerHTML = '✔';
        setTimeout(() => {
          window.close(); // Cerramos el popup después de enviar exitosamente (como no especificó, asumimos buen UX)
        }, 800);
      } else {
        replyInput.disabled = false;
        replyBtn.disabled = false;
        replyBtn.innerHTML = '➤';
        alert('Error al enviar. Asegúrate de que WhatsApp Web esté cargado.');
      }
    };

    replyBtn.addEventListener('click', handleSend);
    replyInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleSend();
    });

    replyContainer.appendChild(replyInput);
    replyContainer.appendChild(replyBtn);
    card.appendChild(replyContainer);

    previewContainer.appendChild(card);

    // --- Click en tab ---
    tab.addEventListener('click', () => {
      // Desactivar todas las tabs y cards
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.preview-card').forEach(c => c.classList.remove('active'));

      // Activar la seleccionada
      tab.classList.add('active');
      card.classList.add('active');
    });
  });

  // Botón abrir WhatsApp
  openBtn.addEventListener('click', async () => {
    await browser.sidebarAction.open();
    window.close(); // Cerrar el popup
  });

  // Refrescar datos cada 5 segundos
  setInterval(async () => {
    const fresh = await browser.runtime.sendMessage({ type: 'get_unread' });
    if (fresh && fresh.chats) {
      headerCount.textContent = String(fresh.chats.length);
      
      // Actualizar los badges y previews sin reconstruir todo
      fresh.chats.forEach((chat, i) => {
        const badge = tabsContainer.querySelectorAll('.tab-badge')[i];
        if (badge) badge.textContent = chat.count;
        
        const card = previewContainer.querySelectorAll('.preview-card')[i];
        if (card) {
          const msg = card.querySelector('.preview-message');
          if (msg && chat.preview) msg.textContent = chat.preview;
          
          const countEl = card.querySelector('.preview-count');
          if (countEl) countEl.textContent = `${chat.count} mensaje(s) sin leer`;
        }
      });
    }
  }, 5000);
})();
