// content.js — Se inyecta dentro del iframe de WhatsApp Web
// Escanea los chats no leídos y envía la info al background script

(function () {
  // Nombres que NO son contactos reales y hay que ignorar
  const BLACKLIST = ['archivados', 'archived', 'comunidades', 'communities'];

  // Esperar a que WhatsApp cargue completamente
  let initAttempts = 0;
  const waitForApp = setInterval(() => {
    initAttempts++;
    const app = document.querySelector('#app');
    // WhatsApp a veces cambia sus IDs. Buscamos cualquier elemento principal de la interfaz cargada.
    const isLoaded = document.querySelector('#side, #pane-side, [data-testid="chat-list"], header');
    if (app && isLoaded) {
      clearInterval(waitForApp);
      console.log('[WA Sidebar] WhatsApp detectado, iniciando escaneo...');
      init();
    }
    if (initAttempts > 60) { // 120 segundos máximo
      clearInterval(waitForApp);
    }
  }, 2000);

  function init() {
    // Escanear cada 500ms para que sea "instantáneo"
    setInterval(scanUnreadChats, 500);
    // Escaneo inicial rápido
    setTimeout(scanUnreadChats, 200);
  }

  function scanUnreadChats() {
    const unreadChats = [];

    try {
      // Buscar TODOS los elementos con badge de no leído
      // WhatsApp usa badges con aria-label que contiene "no leído" / "unread"
      const badges = document.querySelectorAll(
        '[aria-label*="no leíd"], [aria-label*="unread"], [aria-label*="sin leer"]'
      );

      // También buscar por data-testid
      const badges2 = document.querySelectorAll('[data-testid="icon-unread-count"]');

      // Combinar ambas búsquedas sin duplicados
      const allBadges = new Set([...badges, ...badges2]);

      allBadges.forEach(badge => {
        const count = parseInt(badge.textContent.trim()) || 1;
        if (count <= 0) return;

        const chatRow = findChatRow(badge);
        if (!chatRow) return;

        const name = extractContactName(chatRow);
        if (!name) return;

        // Filtrar nombres de secciones que no son contactos
        if (BLACKLIST.includes(name.toLowerCase().trim())) return;

        const preview = extractMessagePreview(chatRow);
        const time = extractTime(chatRow);

        // Evitar duplicados
        if (!unreadChats.find(c => c.name === name)) {
          unreadChats.push({ name, count, preview, time });
        }
      });

    } catch (e) {
      // Silenciar errores
    }

    // Enviar al background script
    try {
      browser.runtime.sendMessage({
        type: 'unread_update',
        chats: unreadChats
      });
    } catch (e) {
      // La extensión puede no estar lista aún
    }
  }

  function findChatRow(element) {
    let current = element;
    for (let i = 0; i < 20; i++) {
      current = current.parentElement;
      if (!current) return null;

      // Selectores conocidos de filas de chat en WhatsApp Web
      if (current.getAttribute('data-testid') === 'cell-frame-container') return current;
      if (current.getAttribute('data-testid') === 'list-item-chat') return current;
      if (current.getAttribute('role') === 'row') return current;
      if (current.getAttribute('role') === 'listitem') return current;
      if (current.getAttribute('role') === 'option') return current;
      
      // WhatsApp a veces usa divs con clase que contiene "chat" 
      // y tienen un onclick o son clickeables
      if (current.getAttribute('tabindex') === '-1' && 
          current.querySelector('span[title]') && 
          current.querySelector('img[src*="pps"]')) {
        return current;
      }
    }
    return null;
  }

  function extractContactName(chatRow) {
    // 1. span con title (el más confiable)
    const spanWithTitle = chatRow.querySelector('span[title]');
    if (spanWithTitle) {
      const title = spanWithTitle.getAttribute('title');
      if (title && title.length > 0) return title;
    }

    // 2. data-testid cell-frame-title
    const cellTitle = chatRow.querySelector('[data-testid="cell-frame-title"] span');
    if (cellTitle) return cellTitle.textContent.trim();

    // 3. El primer span con texto significativo
    const spans = chatRow.querySelectorAll('span[dir="auto"]');
    for (const span of spans) {
      const text = span.textContent.trim();
      if (text.length > 1 && !text.match(/^\d+$/) && !text.match(/^\d{1,2}:\d{2}$/)) {
        return text;
      }
    }

    return null;
  }

  function extractMessagePreview(chatRow) {
    // 1. Buscar en el contenedor secundario (donde WhatsApp pone el preview)
    const secondary = chatRow.querySelector('[data-testid="cell-frame-secondary"]');
    if (secondary) {
      // Obtener todo el texto del contenedor secundario
      const textContent = secondary.textContent.trim();
      if (textContent && textContent.length > 1) {
        // Limpiar: quitar timestamps y quedarnos con el mensaje
        const cleaned = textContent
          .replace(/\d{1,2}:\d{2}\s*(a\.?\s*m\.?|p\.?\s*m\.?)?/gi, '')
          .replace(/^(ayer|hoy|lunes|martes|miércoles|jueves|viernes|sábado|domingo)\s*/i, '')
          .trim();
        if (cleaned.length > 1) return cleaned;
      }
    }

    // 2. Buscar el texto debajo del nombre del contacto
    // El nombre suele estar en el primer span[title], el preview en los siguientes
    const nameEl = chatRow.querySelector('span[title]');
    if (nameEl) {
      // Buscar el siguiente contenedor de texto después del nombre
      const allTextSpans = chatRow.querySelectorAll('span[dir="ltr"], span[dir="auto"]');
      let passedName = false;
      
      for (const span of allTextSpans) {
        if (span === nameEl || span.contains(nameEl) || nameEl.contains(span)) {
          passedName = true;
          continue;
        }
        if (passedName) {
          const text = span.textContent.trim();
          // Filtrar timestamps y números solos
          if (text.length > 2 && 
              !text.match(/^\d{1,2}:\d{2}$/) && 
              !text.match(/^\d+$/) &&
              !text.match(/^(ayer|hoy)$/i)) {
            return text;
          }
        }
      }
    }

    // 3. Último recurso: segundo span[title] si existe
    const allTitles = chatRow.querySelectorAll('span[title]');
    if (allTitles.length > 1) {
      return allTitles[1].getAttribute('title') || allTitles[1].textContent.trim();
    }

    return null; // No fallback - si no hay preview, no mostramos nada falso
  }

  function extractTime(chatRow) {
    // 1. Buscar en el contenedor de detalles primarios
    const primaryDetail = chatRow.querySelector('[data-testid="cell-frame-primary-detail"]');
    if (primaryDetail) {
      const text = primaryDetail.textContent.trim();
      if (text) return text;
    }

    // 2. Buscar spans con formato de hora
    const allSpans = chatRow.querySelectorAll('span');
    for (const span of allSpans) {
      const text = span.textContent.trim();
      if (text.match(/^\d{1,2}:\d{2}$/)) return text;
      if (text.match(/^(ayer|hoy)/i)) return text;
    }

    return '';
  }
})();
