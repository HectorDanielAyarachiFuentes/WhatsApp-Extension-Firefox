/**
 * @file content/dom.js
 * @description DOM manipulation helpers. Extracts text, rows, names, and times from WhatsApp's React DOM.
 * @context Relies on window.WA.SELECTORS. Injected sequentially after state.js.
 */
window.WA = window.WA || {};

window.WA.dom = {
  getChatRows: function() {
    const selectors = window.WA.SELECTORS.chatListContainer.split(',').map(sel => `${sel.trim()} [role="listitem"], ${sel.trim()} [role="row"]`).join(', ');
    let rows = Array.from(document.querySelectorAll(selectors));
    
    if (rows.length === 0) {
        rows = Array.from(document.querySelectorAll(window.WA.SELECTORS.chatRow));
    }
    return rows;
  },

  getNavHeader: function() {
    const headers = document.querySelectorAll('header');
    if (headers.length > 0) {
      let navHeader = headers[0];
      const sidePanel = document.getElementById('side') || document.querySelector('[data-testid="chat-list"]');
      if (sidePanel && sidePanel.parentElement && sidePanel.parentElement.contains(navHeader)) {
         navHeader = null; // No hay barra de iconos visible o no es el primer header
      }
      return navHeader;
    }
    return null;
  },

  findChatRow: function(element) {
    let current = element;
    for (let i = 0; i < 20; i++) {
      current = current.parentElement;
      if (!current) return null;

      if (current.matches && current.matches(window.WA.SELECTORS.chatRow)) return current;
      
      if (current.getAttribute('tabindex') === '-1' && 
          current.querySelector('span[title]') && 
          current.querySelector('img[src*="pps"]')) {
        return current;
      }
    }
    return null;
  },

  extractContactName: function(chatRow) {
    const spanWithTitle = chatRow.querySelector('span[title]');
    if (spanWithTitle) {
      const title = spanWithTitle.getAttribute('title');
      if (title && title.length > 0) return title;
    }

    const cellTitle = chatRow.querySelector('[data-testid="cell-frame-title"] span');
    if (cellTitle) return cellTitle.textContent.trim();

    const spans = chatRow.querySelectorAll('span[dir="auto"]');
    for (const span of spans) {
      const text = span.textContent.trim();
      if (text.length > 1 && !text.match(/^\d+$/) && !text.match(/^\d{1,2}:\d{2}$/)) {
        return text;
      }
    }
    return null;
  },

  extractMessagePreview: function(chatRow) {
    const secondary = chatRow.querySelector('[data-testid="cell-frame-secondary"]');
    if (secondary) {
      const textContent = secondary.textContent.trim();
      if (textContent && textContent.length > 1) {
        const cleaned = textContent
          .replace(/\d{1,2}:\d{2}\s*(a\.?\s*m\.?|p\.?\s*m\.?)?/gi, '')
          .replace(/^(ayer|hoy|lunes|martes|miércoles|jueves|viernes|sábado|domingo)\s*/i, '')
          .trim();
        if (cleaned.length > 1) return cleaned;
      }
    }

    const nameEl = chatRow.querySelector('span[title]');
    if (nameEl) {
      const allTextSpans = chatRow.querySelectorAll('span[dir="ltr"], span[dir="auto"]');
      let passedName = false;
      
      for (const span of allTextSpans) {
        if (span === nameEl || span.contains(nameEl) || nameEl.contains(span)) {
          passedName = true;
          continue;
        }
        if (passedName) {
          const text = span.textContent.trim();
          if (text.length > 2 && 
              !text.match(/^\d{1,2}:\d{2}$/) && 
              !text.match(/^\d+$/) &&
              !text.match(/^(ayer|hoy)$/i)) {
            return text;
          }
        }
      }
    }

    const allTitles = chatRow.querySelectorAll('span[title]');
    if (allTitles.length > 1) {
      return allTitles[1].getAttribute('title') || allTitles[1].textContent.trim();
    }
    return null;
  },

  extractTime: function(chatRow) {
    const primaryDetail = chatRow.querySelector('[data-testid="cell-frame-primary-detail"]');
    if (primaryDetail) {
      const text = primaryDetail.textContent.trim();
      if (text) return text;
    }

    const allSpans = chatRow.querySelectorAll('span');
    for (const span of allSpans) {
      const text = span.textContent.trim();
      if (text.match(/^\d{1,2}:\d{2}$/)) return text;
      if (text.match(/^(ayer|hoy)/i)) return text;
    }
    return '';
  }
};
