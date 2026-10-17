/**
 * @file content/scanner.js
 * @description Scans the DOM for unread message badges and sends updates to background.js.
 * @context Depends on window.WA.dom functions.
 */
window.WA = window.WA || {};

// Timer único para re-escaneo diferido — evita crear múltiples setTimeout
// cuando varios contactos están en ignoredContacts al mismo tiempo.
let _pendingRescanTimer = null;

window.WA.scanner = {
  scanUnreadChats: function() {
    const unreadChats = [];

    try {
      const allBadges = document.querySelectorAll(window.WA.SELECTORS.unreadBadge);

      allBadges.forEach(badge => {
        const count = parseInt(badge.textContent.trim()) || 1;
        if (count <= 0) return;

        const chatRow = window.WA.dom.findChatRow(badge);
        if (!chatRow) return;

        const name = window.WA.dom.extractContactName(chatRow);
        if (!name) return;

        if (window.WA.BLACKLIST.includes(name.toLowerCase().trim())) return;

        if (window.WA.state.ignoredContacts.has(name)) {
          const timeIgnored = Date.now() - window.WA.state.ignoredContacts.get(name);
          if (timeIgnored < 5000) {
            // Programar un solo re-escaneo cuando expire el primer contacto ignorado.
            // Si ya hay uno pendiente no hace falta crear otro.
            if (!_pendingRescanTimer) {
              _pendingRescanTimer = setTimeout(() => {
                _pendingRescanTimer = null;
                if (window.WA.scanner && window.WA.scanner.scanUnreadChats) {
                  window.WA.scanner.scanUnreadChats();
                }
              }, 5000 - timeIgnored + 100);
            }
            return;
          } else {
            window.WA.state.ignoredContacts.delete(name);
          }
        }

        const preview = window.WA.dom.extractMessagePreview(chatRow);
        const time = window.WA.dom.extractTime(chatRow);
        const avatarUrl = window.WA.dom.extractAvatarUrl(chatRow);

        if (!window.WA.state.messageHistory) {
          window.WA.state.messageHistory = new Map();
        }
        let history = window.WA.state.messageHistory.get(name) || [];
        if (preview && !history.includes(preview)) {
          history.push(preview);
          if (history.length > 6) history.shift();
          window.WA.state.messageHistory.set(name, history);
        }

        if (!unreadChats.find(c => c.name === name)) {
          unreadChats.push({ name, count, preview, time, avatarUrl, history: [...history] });
        }
      });

    } catch (e) {
      // Silenciar errores
    }

    try {
      const isBackground = (window.name === 'wa-background-iframe');
      browser.runtime.sendMessage({
        type: 'unread_update',
        source: isBackground ? 'background' : 'sidebar',
        chats: unreadChats
      });
    } catch (e) {
      // La extensión puede no estar lista aún
    }
  }
};
