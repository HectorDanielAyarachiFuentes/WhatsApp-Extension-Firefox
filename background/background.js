// ===== 1. Eliminar headers de seguridad para permitir el iframe =====
browser.webRequest.onHeadersReceived.addListener(
  function(info) {
    const headers = info.responseHeaders.filter(header => {
      const name = header.name.toLowerCase();
      const headersToRemove = [
        'x-frame-options', 
        'frame-options', 
        'content-security-policy',
        'cross-origin-opener-policy',
        'cross-origin-embedder-policy',
        'cross-origin-resource-policy'
      ];
      return !headersToRemove.includes(name);
    });
    return { responseHeaders: headers };
  },
  {
    urls: ["<all_urls>"],
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
let isSoundMuted = false;
let isNotifMuted = false;

// Cargar preferencias iniciales
browser.storage.local.get(['isSoundMuted', 'isNotifMuted']).then((res) => {
  isSoundMuted = res.isSoundMuted || false;
  isNotifMuted = res.isNotifMuted || false;
});

// Escuchar cambios en la configuración
browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    if (changes.isSoundMuted !== undefined) isSoundMuted = changes.isSoundMuted.newValue;
    if (changes.isNotifMuted !== undefined) isNotifMuted = changes.isNotifMuted.newValue;
  }
});

const ICON_NORMAL = 'icons/WhatsApp.svg';

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
    } else {
      // Sin mensajes: limpiar todo
      browser.browserAction.setBadgeText({ text: '' });
      browser.browserAction.setTitle({ title: 'Abrir WhatsApp' });
      previousUnreadNames = [];
      clearAllNotifications();
    }
  }
});

// ===== Sonido de notificación =====
function playWhatsAppSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    // Tono "pop" estilo WhatsApp corto y agudo
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
  } catch(e) {
    console.error("Audio no soportado:", e);
  }
}

// ===== Notificaciones de escritorio =====
function notifyNewContacts(oldChats, newChats) {
  let playedSound = false;
  newChats.forEach(chat => {
    const oldChat = oldChats.find(c => c.name === chat.name);
    const isNew = !oldChat;
    const hasMore = oldChat && chat.count > oldChat.count;

    if (isNew || hasMore) {
      if (!playedSound && !isSoundMuted) {
        playWhatsAppSound();
        playedSound = true;
      }

      if (!isNotifMuted) {
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

// ===== 4. Menú contextual (Clic derecho en el icono) =====
browser.menus.create({
  id: "open-full",
  title: "Abrir WhatsApp en pestaña completa",
  contexts: ["browser_action"]
});

browser.menus.create({
  id: "separator-1",
  type: "separator",
  contexts: ["browser_action"]
});

browser.menus.create({
  id: "open-settings",
  title: "Configuración y Sobre mí",
  contexts: ["browser_action"]
});

browser.menus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "open-full") {
    browser.tabs.create({ url: "https://web.whatsapp.com/" });
  } else if (info.menuItemId === "open-settings") {
    browser.runtime.openOptionsPage();
  }
});
