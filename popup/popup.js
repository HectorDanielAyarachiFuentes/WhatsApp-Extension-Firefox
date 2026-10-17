/**
 * @file popup/popup.js
 * @description Handles the extension popup when clicking the icon. Currently delegates to opening the sidebar.
 * @context Runs in the popup page context.
 */
// popup.js — Lógica del popup de previsualización

// ─── Helpers de avatar ────────────────────────────────────────────────────────
/** Genera un color de fondo determinista a partir del nombre del contacto */
function getAvatarColor(name) {
  const PALETTE = [
    '#D32F2F','#C2185B','#7B1FA2','#512DA8',
    '#1976D2','#0288D1','#00796B','#388E3C',
    '#F57C00','#5D4037','#455A64','#E91E63',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

/** Extrae hasta 2 iniciales de un nombre */
function getInitials(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

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
    const avatarColor = getAvatarColor(chat.name);
    const initials   = getInitials(chat.name);

    // --- Tab ---
    const tab = document.createElement('div');
    tab.className = 'tab' + (index === 0 ? ' active' : '');
    tab.dataset.index = index;

    const tabAvatar = document.createElement('div');
    tabAvatar.className = 'tab-avatar';
    tabAvatar.style.background = avatarColor;
    tabAvatar.textContent = initials;

    const tabName = document.createElement('span');
    tabName.className = 'tab-name';
    tabName.textContent = chat.name;

    const tabBadge = document.createElement('span');
    tabBadge.className = 'tab-badge';
    tabBadge.textContent = chat.count;

    tab.appendChild(tabAvatar);
    tab.appendChild(tabName);
    tab.appendChild(tabBadge);
    tabsContainer.appendChild(tab);

    // --- Preview card ---
    const card = document.createElement('div');
    card.className = 'preview-card' + (index === 0 ? ' active' : '');
    card.dataset.index = index;

    // Fila de contacto: avatar grande + meta
    const contactRow = document.createElement('div');
    contactRow.className = 'preview-contact-row';

    const avatar = document.createElement('div');
    avatar.className = 'contact-avatar';
    avatar.style.background = avatarColor;
    avatar.textContent = initials;

    const contactMeta = document.createElement('div');
    contactMeta.className = 'contact-meta';

    const nameEl = document.createElement('div');
    nameEl.className = 'preview-name';
    nameEl.textContent = chat.name;

    const metaRow = document.createElement('div');
    metaRow.className = 'preview-meta-row';

    const timeEl = document.createElement('span');
    timeEl.className = 'preview-time';
    timeEl.textContent = chat.time || '';

    const countBadge = document.createElement('span');
    countBadge.className = 'preview-count-badge';
    countBadge.textContent = `${chat.count} msg`;

    metaRow.appendChild(timeEl);
    metaRow.appendChild(countBadge);
    contactMeta.appendChild(nameEl);
    contactMeta.appendChild(metaRow);
    contactRow.appendChild(avatar);
    contactRow.appendChild(contactMeta);
    card.appendChild(contactRow);

    // --- Burbujas de mensaje: una por cada mensaje no leído (máx 6) ---
    // Solo tenemos el texto del último mensaje desde la lista de WhatsApp Web.
    // Las burbujas anteriores se muestran como mensajes previos con puntos animados
    // o con el texto previo si se capturó en el historial.
    const totalBubbles = Math.min(chat.count, 6);
    const history = Array.isArray(chat.history) ? chat.history : [];
    const unknownCount = Math.max(0, totalBubbles - Math.max(1, history.length));

    for (let b = 0; b < totalBubbles; b++) {
      const isLast = (b === totalBubbles - 1);
      const isUnknown = (b < unknownCount);

      const bubbleWrap = document.createElement('div');
      bubbleWrap.className = 'preview-bubble-wrap';

      const bubble = document.createElement('div');
      bubble.className = isLast ? 'preview-bubble' : (isUnknown ? 'preview-bubble preview-bubble-older' : 'preview-bubble');

      if (isLast) {
        // Última burbuja: muestra el preview real
        if (chat.preview) {
          const msgEl = document.createElement('div');
          msgEl.className = 'preview-message';
          msgEl.textContent = chat.preview;
          bubble.appendChild(msgEl);
        } else {
          const noMsg = document.createElement('div');
          noMsg.className = 'preview-no-msg';
          noMsg.textContent = 'Vista previa no disponible';
          bubble.appendChild(noMsg);
        }

        // Footer con hora
        const bubbleFooter = document.createElement('div');
        bubbleFooter.className = 'preview-bubble-footer';
        const footerTime = document.createElement('span');
        footerTime.textContent = chat.time || '';
        bubbleFooter.appendChild(footerTime);
        bubble.appendChild(bubbleFooter);
      } else if (!isUnknown) {
        // Mensaje anterior con texto conocido
        const histIndex = b - unknownCount;
        const msgEl = document.createElement('div');
        msgEl.className = 'preview-message';
        msgEl.textContent = history[histIndex] || '...';
        bubble.appendChild(msgEl);
      } else {
        // Burbujas anteriores sin texto disponible: puntos animados estilo WhatsApp
        const dotsEl = document.createElement('div');
        dotsEl.className = 'preview-dots';
        for (let d = 0; d < 3; d++) {
          const dot = document.createElement('span');
          dot.className = 'dot';
          dot.style.animationDelay = `${d * 0.18}s`;
          dotsEl.appendChild(dot);
        }
        bubble.appendChild(dotsEl);
      }

      bubbleWrap.appendChild(bubble);
      card.appendChild(bubbleWrap);
    }

    // Si hay más de 6 mensajes, indicador de overflow
    if (chat.count > 6) {
      const moreEl = document.createElement('div');
      moreEl.className = 'preview-more';
      moreEl.textContent = `+ ${chat.count - 6} mensajes anteriores`;
      card.appendChild(moreEl);
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
    replyBtn.innerHTML = '&#10148;'; // flecha enviar

    // Lógica para enviar
    const handleSend = async () => {
      const text = replyInput.value.trim();
      if (!text) return;

      replyInput.disabled = true;
      replyBtn.disabled = true;
      replyBtn.textContent = '…';

      // Enviar la orden al background
      const result = await browser.runtime.sendMessage({
        type: 'quick_reply',
        contact: chat.name,
        message: text
      });

      if (result && result.success) {
        replyInput.value = '';
        replyInput.placeholder = 'Enviado ✓';
        replyBtn.innerHTML = '&#10003;';
        setTimeout(() => { window.close(); }, 800);
      } else {
        replyInput.disabled = false;
        replyBtn.disabled = false;
        replyBtn.innerHTML = '&#10148;';
        replyInput.placeholder = 'Error al enviar: abre WhatsApp en sidebar';
        replyInput.classList.add('error');
        setTimeout(() => {
          replyInput.placeholder = 'Escribe una respuesta rápida...';
          replyInput.classList.remove('error');
        }, 3000);
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
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.preview-card').forEach(c => c.classList.remove('active'));
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
          
          const countEl = card.querySelector('.preview-count-badge');
          if (countEl) countEl.textContent = `${chat.count} msg`;
        }
      });
    }
  }, 5000);
})();
