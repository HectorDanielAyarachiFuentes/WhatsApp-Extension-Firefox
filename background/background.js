// Las cabeceras de red ahora son manejadas por rules.json usando declarativeNetRequest

// ===== 2. Clic en el icono: alternar sidebar o panel interno =====
browser.action.onClicked.addListener(() => {
  if (sidebarPort) {
    browser.notifications.create({
      type: 'basic',
      iconUrl: browser.runtime.getURL('icons/WhatsApp.svg'),
      title: 'Botón superior presionado',
      message: 'La barra lateral ya está abierta. Enviando orden de expandir/colapsar al contenido.'
    });
    // Si la barra ya está abierta, no la cerramos, solo mandamos la orden de expandir/colapsar internamente
    sidebarPort.postMessage({ type: 'toggle_internal_panel' });
  } else {
    browser.notifications.create({
      type: 'basic',
      iconUrl: browser.runtime.getURL('icons/WhatsApp.svg'),
      title: 'Botón superior presionado',
      message: 'La barra estaba cerrada. Abriendo barra lateral.'
    });
    // Si está cerrada, la abrimos
    browser.sidebarAction.open();
  }
});

// ===== 3. Sistema de notificaciones de mensajes no leídos =====
let unreadChats = [];
let previousUnreadNames = [];
let isSoundMuted = false;
let isNotifMuted = false;
let currentRingtone = 'black_mirror';

// Cargar preferencias iniciales
browser.storage.local.get(['isSoundMuted', 'isNotifMuted', 'ringtone']).then((res) => {
  isSoundMuted = res.isSoundMuted || false;
  isNotifMuted = res.isNotifMuted || false;
  currentRingtone = res.ringtone || 'black_mirror';
});

// Escuchar cambios en la configuración
browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    if (changes.isSoundMuted !== undefined) isSoundMuted = changes.isSoundMuted.newValue;
    if (changes.isNotifMuted !== undefined) isNotifMuted = changes.isNotifMuted.newValue;
    if (changes.ringtone !== undefined) currentRingtone = changes.ringtone.newValue;
  }
});

const ICON_NORMAL = 'icons/WhatsApp.svg';

function updateUnreadUI(oldChats) {
  const totalContacts = unreadChats.length;
  
  if (totalContacts > 0) {
    browser.browserAction.setBadgeText({ text: totalContacts.toString() });
    browser.browserAction.setBadgeBackgroundColor({ color: '#25D366' });

    let tooltipText = `🟢 WHATSAPP WEB\n━━━━━━━━━━━━━━━━━━━━━━\nTienes ${totalContacts} chat${totalContacts > 1 ? 's' : ''} sin leer\n\n`;
    
    unreadChats.forEach(c => {
      let safeName = c.name.length > 20 ? c.name.substring(0, 17) + '...' : c.name;
      let previewText = c.preview ? c.preview : '📷 Archivo adjunto o sticker';
      let msgsWord = c.count === 1 ? 'mensaje' : 'mensajes';
      tooltipText += `👤 ${safeName}  [ ${c.count} ${msgsWord} ]\n💬 "${previewText}"\n\n`;
    });
    
    tooltipText += `━━━━━━━━━━━━━━━━━━━━━━\n👆 Haz clic para abrir el panel`;
    
    browser.browserAction.setTitle({ title: tooltipText });
    if (oldChats) notifyNewContacts(oldChats, unreadChats);
  } else {
    browser.browserAction.setBadgeText({ text: '' });
    browser.browserAction.setTitle({ title: 'Abrir WhatsApp' });
    previousUnreadNames = [];
  }
}

// Escuchar mensajes del content script Y del popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'get_unread') {
    sendResponse({ chats: unreadChats });
  } else if (message.type === 'test_ringtone') {
    playWhatsAppSound(message.ringtone);
    sendResponse({ success: true });
  } else if (message.type === 'quick_reply') {
    // 1. Reenviar a las pestañas de WhatsApp
    browser.tabs.query({ url: "*://web.whatsapp.com/*" }).then(tabs => {
      tabs.forEach(tab => {
        browser.tabs.sendMessage(tab.id, message).catch(() => {});
      });
    });

    // 2. Reenviar al sidebar si está abierto
    if (sidebarPort) {
      sidebarPort.postMessage(message);
    }

    // 3. Reenviar al iframe de fondo si la sidebar está cerrada
    const bgIframe = document.getElementById('wa-background-iframe');
    if (bgIframe && bgIframe.contentWindow) {
      bgIframe.contentWindow.postMessage(message, '*');
    }

    // 4. Actualización optimista: quitar el contacto de la lista de no leídos
    unreadChats = unreadChats.filter(c => c.name !== message.contact);
    updateUnreadUI(null);

    sendResponse({ success: true });
  }

  // El content script envía actualización de chats no leídos
  if (message.type === 'unread_update') {
    const oldChats = unreadChats;
    unreadChats = message.chats;
    updateUnreadUI(oldChats);
  }
});

// ===== Sonido de notificación =====
function playWhatsAppSound(forceTone = null) {
  try {
    const toneToPlay = forceTone || currentRingtone;

    if (toneToPlay === 'black_mirror') {
      const audio = new Audio(browser.runtime.getURL('sounds/black_mirror_text.wav'));
      audio.volume = 0.8;
      audio.play().catch(e => console.error("Error al reproducir audio local:", e));
      return;
    }

    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    if (toneToPlay === 'bubble') {
      // Tono "pop" estilo WhatsApp corto y agudo (Burbuja Original)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1);

    } else if (toneToPlay === 'bell') {
      // Tono "Campanita Blanca" suave
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.6);

    } else if (toneToPlay === 'ding') {
      // Tono "Ding Metálico"
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1000, ctx.currentTime);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    }

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
  id: "open-popup-preview",
  title: "💬 Ver mensajes nuevos (Popup)",
  contexts: ["browser_action"]
});

browser.menus.create({
  id: "separator-popup",
  type: "separator",
  contexts: ["browser_action"]
});

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

// Listener del menú
browser.menus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "open-popup-preview") {
    try {
      // 1. Asignar el popup temporalmente
      await browser.browserAction.setPopup({ popup: "popup/popup.html" });
      // 2. Abrirlo (posible gracias al manejador de evento de usuario)
      await browser.browserAction.openPopup();
      // 3. Quitar el popup para no romper el clic izquierdo
      await browser.browserAction.setPopup({ popup: "" });
    } catch (error) {
      console.error("Error al intentar abrir el popup:", error);
      // Asegurarse de quitarlo en caso de error
      browser.browserAction.setPopup({ popup: "" });
    }
  } else if (info.menuItemId === "open-full") {
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
  
  // Ocultar fuera de pantalla pero darle un tamaño real para que WhatsApp renderice 
  // la interfaz y permita hacer focus() o pegar texto.
  backgroundIframe.style.width = '800px';
  backgroundIframe.style.height = '600px';
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
