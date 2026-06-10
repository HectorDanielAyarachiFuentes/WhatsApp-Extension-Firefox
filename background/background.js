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

// ===== 5. Gestión de WhatsApp en segundo plano (Iframe oculto) =====
let sidebarPort = null;
let backgroundIframe = null;

function createBackgroundIframe() {
  if (backgroundIframe) return; // Ya existe
  
  console.log('[WA Background] Creando iframe de fondo para WhatsApp Web...');
  backgroundIframe = document.createElement('iframe');
  backgroundIframe.id = 'wa-background-iframe';
  backgroundIframe.name = 'wa-background-iframe'; // Permite que content.js lo reconozca
  backgroundIframe.src = 'https://web.whatsapp.com/';
  
  // Ocultar fuera de pantalla para garantizar que el navegador mantenga activa su ejecución
  backgroundIframe.style.width = '0px';
  backgroundIframe.style.height = '0px';
  backgroundIframe.style.opacity = '0';
  backgroundIframe.style.position = 'absolute';
  backgroundIframe.style.top = '-9999px';
  backgroundIframe.style.left = '-9999px';
  backgroundIframe.style.border = 'none';
  
  document.body.appendChild(backgroundIframe);
}

function destroyBackgroundIframe() {
  if (!backgroundIframe) return;
  console.log('[WA Background] Destruyendo iframe de fondo...');
  backgroundIframe.remove();
  backgroundIframe = null;
}

// Escuchar conexiones del sidebar
browser.runtime.onConnect.addListener((port) => {
  if (port.name === 'sidebar') {
    console.log('[WA Background] Puerto del sidebar conectado (sidebar abierto).');
    sidebarPort = port;
    
    // Destruir el iframe de fondo inmediatamente para evitar conflicto de sesión única
    destroyBackgroundIframe();
    
    port.onDisconnect.addListener(() => {
      console.log('[WA Background] Puerto del sidebar desconectado (sidebar cerrado).');
      sidebarPort = null;
      
      // Esperar un momento antes de recrear el de fondo para evitar conflictos de conexiones
      setTimeout(() => {
        if (!sidebarPort) {
          createBackgroundIframe();
        }
      }, 2000);
    });
  }
});

// Inicializar el iframe de fondo al arrancar la extensión si el sidebar no está abierto
setTimeout(() => {
  if (!sidebarPort) {
    createBackgroundIframe();
  }
}, 1000);
