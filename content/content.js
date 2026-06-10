// content.js — Se inyecta dentro del iframe de WhatsApp Web
// Escanea los chats no leídos y envía la info al background script

(function () {
  // Nombres que NO son contactos reales y hay que ignorar
  const BLACKLIST = ['archivados', 'archived', 'comunidades', 'communities'];

  let isChatListCollapsed = false;

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
    setInterval(() => {
      scanUnreadChats();
      setupResizer(); // Asegurar que el resizer exista siempre
      checkCollapseState(); // Comprobar si la lista está colapsada midiendo su ancho
      renderMiniChats(); // Renderizar caritas si está colapsado
    }, 500);
    // Escaneo inicial rápido
    setTimeout(scanUnreadChats, 200);
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
            // Para la lista de chats, el ancho suele ser desde el resizer de nav hasta el ratón.
            // Para simplificar, usamos event.clientX pero restando la posición izquierda si es necesario.
            const rect = leftPane.getBoundingClientRect();
            // calculamos el ancho asumiendo que leftPane empieza en rect.left
            const newWidth = e.clientX - rect.left;
            
            if (newWidth >= 0 && newWidth <= window.innerWidth) {
              leftPane.style.flexBasis = `${newWidth}px`;
              leftPane.style.maxWidth = `${newWidth}px`;
              leftPane.style.width = `${newWidth}px`;
              // Añadimos minWidth para forzar que WhatsApp no lo expanda
              leftPane.style.minWidth = `${newWidth}px`;
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
          const width = resizer.parentElement.getBoundingClientRect().width;
          isChatListCollapsed = (width > 0 && width < 90);
      }
  }

  function getChatRows() {
      let rows = Array.from(document.querySelectorAll('#pane-side [role="listitem"], #pane-side [role="row"], #side [role="listitem"], #side [role="row"], [aria-label="Lista de chats"] [role="listitem"]'));
      if (rows.length === 0) {
          rows = Array.from(document.querySelectorAll('[data-testid="cell-frame-container"], [data-testid="list-item-chat"]'));
      }
      return rows;
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

    // Buscar el botón de Comunidades o el último ícono para saber dónde posicionarnos
    let topPosition = 250;
    let leftPosition = 12;

    const communitiesBtn = document.querySelector('[aria-label="Comunidades"], [title="Comunidades"], [aria-label="Communities"], [title="Communities"]');
    if (communitiesBtn) {
        const rect = communitiesBtn.getBoundingClientRect();
        topPosition = rect.bottom + 20;
        leftPosition = rect.left + (rect.width / 2) - 27; // Centrado para un contenedor de 54px
    } else {
        const icons = document.querySelectorAll('header span[data-icon]');
        if (icons.length > 0) {
            const rect = icons[icons.length - 1].getBoundingClientRect();
            topPosition = rect.bottom + 20;
            leftPosition = rect.left + (rect.width / 2) - 27;
        }
    }

    if (!miniChatsContainer) {
      miniChatsContainer = document.createElement('div');
      miniChatsContainer.id = 'wa-extension-mini-chats';
      document.body.appendChild(miniChatsContainer);
    }
    
    // Aplicar estilos flotantes
    miniChatsContainer.style.display = 'flex';
    miniChatsContainer.style.position = 'fixed';
    miniChatsContainer.style.top = `${topPosition}px`;
    miniChatsContainer.style.left = `${leftPosition}px`;
    miniChatsContainer.style.width = `54px`; // Dar más espacio para evitar cortes en el borde derecho
    miniChatsContainer.style.zIndex = '99999';
    miniChatsContainer.style.flexDirection = 'column';
    miniChatsContainer.style.gap = '12px';
    
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
        
        // WhatsApp desmonta los chats cuando la lista mide 0px.
        // Para hacer clic, tenemos que "engañar" a WhatsApp expandiendo la lista 
        // de forma invisible por una fracción de segundo para que React la vuelva a cargar.
        const resizer = document.getElementById('wa-extension-resizer');
        let leftPane = null;
        if (resizer) leftPane = resizer.parentElement;

        if (leftPane) {
            // Guardar estilos originales
            const oldWidth = leftPane.style.width;
            
            // Expandir de forma invisible usando margin negativo para que no mueva el flexbox
            leftPane.style.opacity = '0.01'; // Casi invisible
            leftPane.style.marginLeft = '-300px'; // Compensa los 300px de ancho
            
            leftPane.style.flexBasis = '300px';
            leftPane.style.width = '300px';
            leftPane.style.minWidth = '300px';

            // Esperar 300ms a que React reaccione y renderice el DOM
            setTimeout(() => {
                let clicked = false;
                
                // Buscar dentro del contenedor de chats específicamente
                const span = document.querySelector(`#pane-side span[title="${chat.name}"], #side span[title="${chat.name}"], [aria-label="Lista de chats"] span[title="${chat.name}"]`);
                
                if (span) {
                    let current = span;
                    for (let i=0; i<6; i++) {
                        if (current && (current.getAttribute('role')==='button' || current.getAttribute('role')==='row' || current.getAttribute('role')==='listitem' || current.getAttribute('tabindex')==='-1')) {
                            // WhatsApp usa mousedown para la mayoría de sus interacciones de lista
                            current.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
                            current.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
                            current.click();
                            clicked = true;
                            break;
                        }
                        current = current.parentElement;
                    }
                    if (!clicked) {
                        span.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
                        span.click();
                    }
                }

                // Restaurar el estado colapsado
                leftPane.style.position = 'relative'; 
                leftPane.style.opacity = '1';
                leftPane.style.marginLeft = '0px';
                
                leftPane.style.flexBasis = '0px';
                leftPane.style.width = '0px';
                leftPane.style.minWidth = '0px';
            }, 300);
        }
      };

      miniChatsContainer.appendChild(miniContainer);
    });
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
