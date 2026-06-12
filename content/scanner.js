/**
 * @file content/scanner.js
 * @description Scans the DOM for unread message badges and sends updates to background.js.
 * @context Depends on window.WA.dom functions.
 */
window.WA = window.WA || {};

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
          if (Date.now() - window.WA.state.ignoredContacts.get(name) < 5000) {
            return;
          } else {
            window.WA.state.ignoredContacts.delete(name);
          }
        }

        const preview = window.WA.dom.extractMessagePreview(chatRow);
        const time = window.WA.dom.extractTime(chatRow);

        if (!unreadChats.find(c => c.name === name)) {
          unreadChats.push({ name, count, preview, time });
        }
      });

    } catch (e) {
      // Silenciar errores
    }

    try {
      browser.runtime.sendMessage({
        type: 'unread_update',
        chats: unreadChats
      });
    } catch (e) {
      // La extensión puede no estar lista aún
    }
  }
};
