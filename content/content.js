// content.js — Se inyecta dentro del iframe de WhatsApp Web
// Escanea los chats no leídos y envía la info al background script

(function () {
  // Nombres que NO son contactos reales y hay que ignorar
  const BLACKLIST = ['archivados', 'archived', 'comunidades', 'communities'];

  const SELECTORS = {
    chatListContainer: '#pane-side, #side, [data-testid="chat-list"], [aria-label="Lista de chats"]',
    chatRow: '[data-testid="cell-frame-container"], [data-testid="list-item-chat"], [role="row"], [role="listitem"], [role="option"]',
    chatTitle: '[data-testid="cell-frame-title"] span, span[title]',
    unreadBadge: '[aria-label*="no leíd"], [aria-label*="unread"], [aria-label*="sin leer"], [data-testid="icon-unread-count"]',
    secondaryContent: '[data-testid="cell-frame-secondary"]',
    primaryDetail: '[data-testid="cell-frame-primary-detail"]',
    communitiesBtn: '[aria-label="Comunidades"], [title="Comunidades"], [aria-label="Communities"], [title="Communities"]',
    headerIcons: 'header span[data-icon]'
  };

  let isChatListCollapsed = false;
  let previousActiveChatsNames = '';

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
    const isBackground = (window.name === 'wa-background-iframe');

    // Observer para escanear chats no leídos solo cuando hay cambios en el DOM (Rendimiento)
    const observer = new MutationObserver(() => scanUnreadChats());
    let observerContainer = null;

    const tryObserve = () => {
      // Buscar todos los posibles contenedores de la lista de chats
      const containers = document.querySelectorAll(SELECTORS.chatListContainer);
      if (containers.length > 0) {
        const container = containers[containers.length - 1]; // Tomar el último suele ser el más específico o visible
        if (container !== observerContainer) {
          if (observerContainer) observer.disconnect();
          observer.observe(container, { childList: true, subtree: true, characterData: true });
          observerContainer = container;
        }
      }
    };

    tryObserve();
    // Intentar reconectar periódicamente por si React desmonta y recrea el contenedor
    setInterval(tryObserve, 2000);
    
    // Escaneo inicial
    setTimeout(scanUnreadChats, 200);

    if (isBackground) {
      console.log('[WA Sidebar] Ejecutando en segundo plano (modo notificaciones).');
      return;
    }

    console.log('[WA Sidebar] Ejecutando en la barra lateral interactiva.');
    // Mantenemos setInterval solo para la UI de sidebar interactivo
    setInterval(() => {
      setupResizer(); 
      checkCollapseState(); 
      renderMiniChats(); 
    }, 500);
  }

  function setupResizer() {
    // === Resizer para el panel de lista de chats ===
    if (!document.getElementById('wa-extension-resizer')) {
      const sidePanel = document.getElementById('side') || document.querySelector('[data-testid="chat-list"]');
      if (sidePanel) {
        let leftPane = sidePanel.closest('[style*="flex-basis"]');
        if (!leftPane) {
          let current = sidePanel;
          for (let i = 0; i < 5; i++) {
            if (current.parentElement && current.parentElement.classList.contains('two')) {
              leftPane = current;
              break;
            }
            current = current.parentElement;
          }
          if (!leftPane) leftPane = sidePanel.parentElement;
        }

        if (leftPane) {
          const resizer = document.createElement('div');
          resizer.id = 'wa-extension-resizer';
          
          leftPane.style.position = 'relative';
          leftPane.appendChild(resizer);
          
          let isResizing = false;

          resizer.addEventListener('mousedown', function(e) {
            isResizing = true;
            document.body.style.cursor = 'col-resize';
            e.preventDefault();
          });

          // Usamos window para el mousemove en caso de que el ratón salga del panel
          const onMouseMove = function(e) {
            if (!isResizing) return;
            
            let navWidth = 64; // Ancho típico de la barra lateral
            const headers = document.querySelectorAll('header');
            if (headers.length > 0) {
                const navRect = headers[0].getBoundingClientRect();
                if (navRect.left === 0 && navRect.width < 100) {
                    navWidth = navRect.width;
                }
            }
            
            let newWidth = e.clientX - navWidth;
            if (newWidth < 0) newWidth = 0;
            
            if (newWidth >= 0 && newWidth <= window.innerWidth - 300) {
              const resizer = document.getElementById('wa-extension-resizer');
              if (newWidth < 80) {
                 // Modo colapsado: lo mantenemos en pantalla (para que IntersectionObserver de React no lo desmonte)
                 // pero usamos margin-right negativo para que el chat principal se dibuje encima de él.
                 leftPane.style.flexBasis = `300px`;
                 leftPane.style.maxWidth = `300px`;
                 leftPane.style.width = `300px`;
                 leftPane.style.minWidth = `300px`;
                 
                 leftPane.style.marginLeft = `0px`;
                 leftPane.style.marginRight = `-300px`; // El chat principal ignorará su ancho
                 leftPane.style.visibility = '';
                 leftPane.classList.add('wa-is-collapsed'); // Delega opacidad y clics al CSS
                 
                 if (resizer) {
                     resizer.style.left = '0px';
                     resizer.style.right = 'auto';
                 }
              } else {
                 // Modo normal
                 leftPane.style.flexBasis = `${newWidth}px`;
                 leftPane.style.maxWidth = `${newWidth}px`;
                 leftPane.style.width = `${newWidth}px`;
                 leftPane.style.minWidth = `${newWidth}px`;
                 
                 leftPane.style.marginLeft = `0px`;
                 leftPane.style.marginRight = `0px`;
                 leftPane.style.visibility = '';
                 leftPane.classList.remove('wa-is-collapsed');
                 
                 if (resizer) {
                     resizer.style.left = 'auto';
                     resizer.style.right = '-8px'; // Centrado en el borde con hitbox de 16px
                 }
              }
              leftPane.style.overflow = 'hidden';
            }
          };

          const onMouseUp = function() {
            if (isResizing) {
              isResizing = false;
              document.body.style.cursor = '';
            }
          };

          document.addEventListener('mousemove', onMouseMove);
          document.addEventListener('mouseup', onMouseUp);
        }
      }
    }

    // === Resizer para la barra de navegación izquierda (iconos) ===
    if (!document.getElementById('wa-extension-nav-resizer')) {
      // En WhatsApp Web moderno, hay varios headers: [nav rail, chat list, main chat]
      // El primero en el DOM suele ser el nav rail (barra de iconos)
      const headers = document.querySelectorAll('header');
      if (headers.length > 0) {
        let navHeader = headers[0];
        
        // Asegurarnos de que este header NO sea el del panel de chats
        const sidePanel = document.getElementById('side') || document.querySelector('[data-testid="chat-list"]');
        if (sidePanel && sidePanel.parentElement && sidePanel.parentElement.contains(navHeader)) {
           navHeader = null; // No hay barra de iconos visible o no es el primer header
        }
        
        if (navHeader) {
          let navPane = navHeader.parentElement;
          
          // Buscar el contenedor que realmente define el ancho de esta columna
          let current = navPane;
          for (let i = 0; i < 4; i++) {
             if (current && current.style && (current.style.width || current.style.flexBasis || current.style.minWidth || current.style.zIndex)) {
                navPane = current;
                break;
             }
             if (current) current = current.parentElement;
          }

          if (navPane) {
            const navResizer = document.createElement('div');
            navResizer.id = 'wa-extension-nav-resizer';
            
            navPane.style.position = 'relative';
            navPane.appendChild(navResizer);

            let isNavResizing = false;

            navResizer.addEventListener('mousedown', function(e) {
              isNavResizing = true;
              document.body.style.cursor = 'col-resize';
              e.preventDefault();
              e.stopPropagation();
            });

            const onNavMouseMove = function(e) {
              if (!isNavResizing) return;
              
              const rect = navPane.getBoundingClientRect();
              const newWidth = e.clientX - rect.left;
              
              if (newWidth >= 0 && newWidth <= 350) {
                navPane.style.flexBasis = `${newWidth}px`;
                navPane.style.maxWidth = `${newWidth}px`;
                navPane.style.width = `${newWidth}px`;
                navPane.style.minWidth = `${newWidth}px`;
                navPane.style.overflow = 'hidden';
              }
            };

            const onNavMouseUp = function() {
              if (isNavResizing) {
                isNavResizing = false;
                document.body.style.cursor = '';
              }
            };

            document.addEventListener('mousemove', onNavMouseMove);
            document.addEventListener('mouseup', onNavMouseUp);
          }
        }
      }
    }
  }

  let cachedMiniChats = [];

  function checkCollapseState() {
      const resizer = document.getElementById('wa-extension-resizer');
      if (resizer && resizer.parentElement) {
          const leftPane = resizer.parentElement;
          const marginRight = parseInt(getComputedStyle(leftPane).marginRight) || 0;
          // Si tiene margin-right negativo profundo, está oculto detrás del main chat
          if (marginRight < -100) {
              isChatListCollapsed = true;
          } else {
              const width = leftPane.getBoundingClientRect().width;
              isChatListCollapsed = (width > 0 && width < 90);
          }
      }
  }

  function getChatRows() {
      // Intentamos buscar por contenedores + rol primero
      const selectors = SELECTORS.chatListContainer.split(',').map(sel => `${sel.trim()} [role="listitem"], ${sel.trim()} [role="row"]`).join(', ');
      let rows = Array.from(document.querySelectorAll(selectors));
      
      if (rows.length === 0) {
          rows = Array.from(document.querySelectorAll(SELECTORS.chatRow));
      }
      return rows;
  }

  function getNavHeader() {
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
  }

  function renderMiniChats() {
    let miniChatsContainer = document.getElementById('wa-extension-mini-chats');
    
    if (!isChatListCollapsed) {
      if (miniChatsContainer) miniChatsContainer.style.display = 'none';
      
      // Actualizar caché de contactos por si WhatsApp los desmonta al colapsar
      const currentRows = getChatRows();
      if (currentRows.length > 0) {
          cachedMiniChats = [];
          currentRows.forEach(row => {
              const img = row.querySelector('img');
              const name = extractContactName(row) || '';
              if (BLACKLIST.includes(name.toLowerCase().trim())) return;
              if (img && img.src) {
                  cachedMiniChats.push({
                      name: name,
                      src: img.src
                  });
              }
          });
      }
      return;
    }

    // Modo colapsado: usar actuales o caché
    let activeChats = [];
    const chatRows = getChatRows();
    if (chatRows.length > 0) {
        chatRows.forEach(row => {
            const img = row.querySelector('img');
            const name = extractContactName(row) || 'Contacto';
            if (BLACKLIST.includes(name.toLowerCase().trim())) return;
            if (img && img.src) {
                activeChats.push({ name: name, src: img.src, rowElement: row });
            }
        });
    } else {
        activeChats = cachedMiniChats;
    }

    if (activeChats.length === 0) return;

    // Evitar la reconstrucción agresiva del DOM si la lista de contactos no ha cambiado
    const currentChatNames = activeChats.map(c => c.name).join('|');
    if (previousActiveChatsNames === currentChatNames && miniChatsContainer && miniChatsContainer.innerHTML !== '') {
        miniChatsContainer.style.display = 'flex'; // <--- FIX: Volver a mostrarlo si estaba oculto
        return; 
    }
    previousActiveChatsNames = currentChatNames;

    // Buscar el botón de Comunidades o el último ícono para saber dónde posicionarnos
    let topPosition = 250;
    let leftPosition = 12;

    const communitiesBtn = document.querySelector(SELECTORS.communitiesBtn);
    if (communitiesBtn) {
        const rect = communitiesBtn.getBoundingClientRect();
        topPosition = rect.bottom + 20;
        leftPosition = rect.left + (rect.width / 2) - 27; // Centrado para un contenedor de 54px
    } else {
        const icons = document.querySelectorAll(SELECTORS.headerIcons);
        if (icons.length > 0) {
            const rect = icons[icons.length - 1].getBoundingClientRect();
            topPosition = rect.bottom + 20;
            leftPosition = rect.left + (rect.width / 2) - 27;
        }
    }

    const navHeader = getNavHeader();
    const parentContainer = navHeader || document.body;

    if (!miniChatsContainer) {
      miniChatsContainer = document.createElement('div');
      miniChatsContainer.id = 'wa-extension-mini-chats';
      parentContainer.appendChild(miniChatsContainer);
    } else if (miniChatsContainer.parentElement !== parentContainer) {
      parentContainer.appendChild(miniChatsContainer);
    }
    
    // Aplicar estilos flotantes
    const isFloatingInBody = (parentContainer === document.body);
    miniChatsContainer.style.display = 'flex';
    miniChatsContainer.style.position = isFloatingInBody ? 'fixed' : 'absolute';
    miniChatsContainer.style.width = `54px`; // Dar más espacio para evitar cortes en el borde derecho
    miniChatsContainer.style.flexDirection = 'column';
    miniChatsContainer.style.gap = '12px';

    if (isFloatingInBody) {
        miniChatsContainer.style.top = `${topPosition}px`;
        miniChatsContainer.style.left = `${leftPosition}px`;
        miniChatsContainer.style.right = 'auto';
        miniChatsContainer.style.margin = '0';
        miniChatsContainer.style.zIndex = '101';
    } else {
        navHeader.style.position = 'relative';
        miniChatsContainer.style.top = `${topPosition}px`;
        miniChatsContainer.style.left = '0';
        miniChatsContainer.style.right = '0';
        miniChatsContainer.style.margin = '0 auto';
        miniChatsContainer.style.zIndex = '5'; // Un z-index bajo interno es suficiente
    }
    
    miniChatsContainer.innerHTML = ''; // Reconstruir para estar actualizados

    activeChats.forEach(chat => {
      const miniContainer = document.createElement('div');
      miniContainer.className = 'wa-mini-chat-item';
      miniContainer.title = chat.name;
      
      const clone = document.createElement('img');
      clone.src = chat.src;
      clone.className = 'wa-mini-chat-img';
      
      miniContainer.appendChild(clone);
      
      miniContainer.onclick = (e) => {
        e.stopPropagation();
        
        // Ahora el panel NUNCA sale de la pantalla (gracias al margin-right negativo), 
        // así que el elemento SIEMPRE es visible para React y no pierde su estado de scroll.
        const span = document.querySelector(`#pane-side span[title="${chat.name}"], #side span[title="${chat.name}"], [aria-label="Lista de chats"] span[title="${chat.name}"]`);
        
        if (span) {
            let current = span;
            let handled = false;
            for (let i=0; i<6; i++) {
                if (current && (current.getAttribute('role')==='button' || current.getAttribute('role')==='row' || current.getAttribute('role')==='listitem' || current.getAttribute('tabindex')==='-1')) {
                    // Clic instantáneo simulando mousedown
                    current.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
                    current.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
                    current.click();
                    handled = true;
                    break;
                }
                current = current.parentElement;
            }
            if (!handled) {
                span.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
                span.click();
            }
        }
      };

      miniChatsContainer.appendChild(miniContainer);
    });
  }

  function scanUnreadChats() {
    const unreadChats = [];

    try {
      // Buscar TODOS los elementos con badge de no leído centralizado
      const allBadges = document.querySelectorAll(SELECTORS.unreadBadge);

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

      // Selectores conocidos de filas de chat en WhatsApp Web usando la config centralizada
      if (current.matches && current.matches(SELECTORS.chatRow)) return current;
      
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
