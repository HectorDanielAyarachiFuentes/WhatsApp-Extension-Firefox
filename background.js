// ===== 1. Eliminar headers de seguridad para permitir el iframe =====
browser.webRequest.onHeadersReceived.addListener(
  function(info) {
    const headers = info.responseHeaders.filter(header => {
      const name = header.name.toLowerCase();
      return name !== 'x-frame-options' && name !== 'frame-options' && name !== 'content-security-policy';
    });
    return { responseHeaders: headers };
  },
  {
    urls: ["*://web.whatsapp.com/*"],
    types: ["sub_frame"]
  },
  ["blocking", "responseHeaders"]
);

// ===== 2. Clic en el icono: alternar sidebar =====
browser.browserAction.onClicked.addListener(() => {
  browser.sidebarAction.toggle();
});

// ===== 3. Sistema de notificaciones de mensajes no leídos =====
let unreadChats = [];
let previousUnreadNames = [];
let pulseInterval = null;
let isPulseOn = false;

const ICON_NORMAL = 'WhatsApp.svg.webp';
const ICON_ACTIVE = 'icon_active.svg';

// Escuchar mensajes del content script Y del popup
browser.runtime.onMessage.addListener((message, sender) => {
  // El popup pide los datos de chats no leídos
  if (message.type === 'get_unread') {
    return Promise.resolve({ chats: unreadChats });
  }

  // El content script envía actualización de chats no leídos
  if (message.type === 'unread_update') {
    const oldChats = unreadChats;
    unreadChats = message.chats;
    const totalContacts = unreadChats.length;

    if (totalContacts > 0) {
      // Badge verde con el número de contactos
      browser.browserAction.setBadgeBackgroundColor({ color: '#25D366' });
      browser.browserAction.setBadgeText({ text: String(totalContacts) });

      // Tooltip detallado con vista previa
      let tooltipText = `📩 ${totalContacts} chat(s) con mensajes nuevos:\n\n`;
      unreadChats.forEach(c => {
        const previewText = c.preview ? c.preview : 'Vista previa no disponible';
        tooltipText += `👤 ${c.name} (${c.count}):\n"${previewText}"\n\n`;
      });
      browser.browserAction.setTitle({ title: tooltipText.trim() });


      // Notificaciones de escritorio para contactos NUEVOS
      notifyNewContacts(oldChats, unreadChats);

      // Pulso del ícono
      startPulse();
    } else {
      // Sin mensajes: limpiar todo
      browser.browserAction.setBadgeText({ text: '' });
      browser.browserAction.setTitle({ title: 'Abrir WhatsApp' });
      previousUnreadNames = [];
      stopPulse();
      clearAllNotifications();


    }
  }
});

// ===== Notificaciones de escritorio =====
function notifyNewContacts(oldChats, newChats) {
  newChats.forEach(chat => {
    const oldChat = oldChats.find(c => c.name === chat.name);
    const isNew = !oldChat;
    const hasMore = oldChat && chat.count > oldChat.count;

    if (isNew || hasMore) {
      const notifId = `wa-${chat.name.replace(/\s+/g, '-')}`;
      const timeStr = chat.time ? ` · ${chat.time}` : '';
      const previewStr = chat.preview ? `\n📝 "${chat.preview}"` : '';

      browser.notifications.create(notifId, {
        type: 'basic',
        iconUrl: browser.runtime.getURL(ICON_NORMAL),
        title: `💬 ${chat.name}${timeStr}`,
        message: `${chat.count} mensaje(s) sin leer${previewStr}`
      });

      setTimeout(() => {
        browser.notifications.clear(notifId);
      }, 8000);
    }
  });

  const currentNames = newChats.map(c => c.name);
  previousUnreadNames.forEach(name => {
    if (!currentNames.includes(name)) {
      browser.notifications.clear(`wa-${name.replace(/\s+/g, '-')}`);
    }
  });
  previousUnreadNames = currentNames;
}

function clearAllNotifications() {
  browser.notifications.getAll().then(notifications => {
    Object.keys(notifications).forEach(id => {
      if (id.startsWith('wa-')) browser.notifications.clear(id);
    });
  });
}

// Clic en notificación → abrir sidebar
browser.notifications.onClicked.addListener((notifId) => {
  if (notifId.startsWith('wa-')) {
    browser.sidebarAction.open();
    browser.notifications.clear(notifId);
  }
});

// ===== Pulso del ícono =====
function startPulse() {
  if (pulseInterval) return;
  pulseInterval = setInterval(() => {
    isPulseOn = !isPulseOn;
    browser.browserAction.setIcon({
      path: isPulseOn ? ICON_ACTIVE : ICON_NORMAL
    });
  }, 1000);
}

function stopPulse() {
  if (pulseInterval) {
    clearInterval(pulseInterval);
    pulseInterval = null;
  }
  isPulseOn = false;
  browser.browserAction.setIcon({ path: ICON_NORMAL });
}
