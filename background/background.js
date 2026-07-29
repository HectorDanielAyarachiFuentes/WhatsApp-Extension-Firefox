/**
 * @file background/background.js
 * @description Main extension service worker / event page. Handles action clicks, notification creation, and messaging with the sidebar.
 * @context Runs in the background page context.
 */
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
    browser.action.setBadgeText({ text: totalContacts.toString() });
    browser.action.setBadgeBackgroundColor({ color: '#25D366' });

    let tooltipText = `🟢 WHATSAPP WEB\n━━━━━━━━━━━━━━━━━━━━━━\nTienes ${totalContacts} chat${totalContacts > 1 ? 's' : ''} sin leer\n\n`;
    
    unreadChats.forEach(c => {
      let safeName = c.name.length > 20 ? c.name.substring(0, 17) + '...' : c.name;
      let previewText = c.preview ? c.preview : '📷 Archivo adjunto o sticker';
      let msgsWord = c.count === 1 ? 'mensaje' : 'mensajes';
      tooltipText += `👤 ${safeName}  [ ${c.count} ${msgsWord} ]\n💬 "${previewText}"\n\n`;
    });
    
    tooltipText += `━━━━━━━━━━━━━━━━━━━━━━\n👆 Haz clic para abrir el panel`;
    
    browser.action.setTitle({ title: tooltipText });
    if (oldChats) notifyNewContacts(oldChats, unreadChats);
  } else {
    browser.action.setBadgeText({ text: '' });
    browser.action.setTitle({ title: 'Abrir WhatsApp' });
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
  contexts: ["action"]
});

browser.menus.create({
  id: "separator-popup",
  type: "separator",
  contexts: ["action"]
});

browser.menus.create({
  id: "open-full",
  title: "Abrir WhatsApp en pestaña completa",
  contexts: ["action"]
});

browser.menus.create({
  id: "separator-1",
  type: "separator",
  contexts: ["action"]
});

browser.menus.create({
  id: "open-settings",
  title: "Configuración y Sobre mí",
  contexts: ["action"]
});

// Listener del menú
browser.menus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "open-popup-preview") {
    try {
      // 1. Asignar el popup temporalmente
      await browser.action.setPopup({ popup: "popup/popup.html" });
      // 2. Abrirlo (posible gracias al manejador de evento de usuario)
      await browser.action.openPopup();
      // 3. Quitar el popup para no romper el clic izquierdo
      await browser.action.setPopup({ popup: "" });
    } catch (error) {
      console.error("Error al intentar abrir el popup:", error);
      // Asegurarse de quitarlo en caso de error
      browser.action.setPopup({ popup: "" });
    }
  } else if (info.menuItemId === "open-full") {
    browser.tabs.create({ url: "https://web.whatsapp.com/" });
  } else if (info.menuItemId === "open-settings") {
    browser.runtime.openOptionsPage();
  }
});

// ===== 5. Gestión de WhatsApp en segundo plano =====
//
// ARQUITECTURA DEFINITIVA:
//   - El iframe de fondo corre WhatsApp SIEMPRE (nunca se navega a about:blank).
//   - Cuando el sidebar abre, autoDismiss.js (SOLO en el sidebar) hace clic en "Usar aquí"
//     → el sidebar se convierte en la instancia primaria.
//   - El iframe de fondo queda en estado "superseded" (sesión cedida), oculto, sin molestar.
//   - Cuando el sidebar cierra, recargamos el iframe de fondo → WhatsApp reconecta limpiamente
//     porque el sidebar ya no está corriendo → sin diálogo, sin loop, sin QR.
//
// CLAVE DEL FIX: autoDismiss.js verifica window.name === 'wa-background-iframe' y termina
//   inmediatamente si es verdad. Esto rompe el loop que ocurría cuando AMBAS instancias
//   competían por "Usar aquí".

let sidebarPort = null;
let backgroundIframe = null;

function ensureBackgroundIframe() {
  if (backgroundIframe && backgroundIframe.isConnected) return backgroundIframe;

  console.log('[WA Background] Creando iframe permanente de fondo...');
  backgroundIframe = document.createElement('iframe');
  backgroundIframe.id   = 'wa-background-iframe';
  backgroundIframe.name = 'wa-background-iframe'; // autoDismiss.js lo detecta por window.name
  backgroundIframe.src  = 'https://web.whatsapp.com/';
  backgroundIframe.style.cssText =
    'width:800px;height:600px;opacity:0;position:absolute;top:-9999px;left:-9999px;border:none;pointer-events:none';
  document.body.appendChild(backgroundIframe);
  return backgroundIframe;
}

function reloadBackgroundIframe() {
  if (sidebarPort) return; // El sidebar sigue abierto, no recargar aún
  const iframe = ensureBackgroundIframe();
  console.log('[WA Background] Recargando iframe de fondo → WhatsApp...');
  // Forzar recarga navegando a la misma URL
  iframe.src = 'https://web.whatsapp.com/';
}

// Escuchar conexiones del sidebar
browser.runtime.onConnect.addListener((port) => {
  if (port.name !== 'sidebar') return;

  console.log('[WA Background] Sidebar conectado.');
  sidebarPort = port;

  // Cuando el sidebar abre NO tocamos el iframe de fondo.
  // autoDismiss.js (en el sidebar) se encarga de hacer clic en "Usar aquí"
  // para que el sidebar sea la instancia primaria.
  // El iframe de fondo queda en estado superseded, sin molestar.

  port.onDisconnect.addListener(() => {
    console.log('[WA Background] Sidebar cerrado.');
    sidebarPort = null;

    // Recargar el iframe de fondo después de que el sidebar termine de cerrar.
    // En ese momento no hay otra instancia de WhatsApp activa → reconecta sin diálogo.
    setTimeout(reloadBackgroundIframe, 3000);
  });
});

// Al arrancar: inicializar el iframe de fondo.
setTimeout(ensureBackgroundIframe, 1500);

