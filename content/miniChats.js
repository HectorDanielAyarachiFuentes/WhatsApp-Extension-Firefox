/**
 * @file content/miniChats.js
 * @description Renders floating contact avatars when the left pane is fully collapsed to save space.
 * @context Reads from window.WA.state.cachedMiniChats. Interacts with the WhatsApp DOM.
 */
window.WA = window.WA || {};

window.WA.miniChats = {
  renderMiniChats: function() {
    let miniChatsContainer = document.getElementById('wa-extension-mini-chats');
    
    if (!window.WA.state.isChatListCollapsed) {
      if (miniChatsContainer) miniChatsContainer.style.display = 'none';
      
      const currentRows = window.WA.dom.getChatRows();
      if (currentRows.length > 0) {
          window.WA.state.cachedMiniChats = [];
          currentRows.forEach(row => {
              const img = row.querySelector('img');
              const name = window.WA.dom.extractContactName(row) || '';
              const cleanName = name.toLowerCase().trim();
              if (window.WA.BLACKLIST.includes(cleanName) || cleanName.includes('meta ai') || cleanName.includes('meta')) return;
              if (row.querySelector('[data-icon*="meta"], [aria-label*="Meta"]')) return;
              const imgSrc = (img && img.src && !img.src.includes('meta')) ? img.src : null;
              if (name) {
                  window.WA.state.cachedMiniChats.push({
                      name: name,
                      src: imgSrc
                  });
              }
          });
      }
      return;
    }

    let activeChats = [];
    const chatRows = window.WA.dom.getChatRows();
    if (chatRows.length > 0) {
        chatRows.forEach(row => {
            const img = row.querySelector('img');
            const name = window.WA.dom.extractContactName(row) || 'Contacto';
            const cleanName = name.toLowerCase().trim();
            if (window.WA.BLACKLIST.includes(cleanName) || cleanName.includes('meta ai') || cleanName.includes('meta')) return;
            if (row.querySelector('[data-icon*="meta"], [aria-label*="Meta"]')) return;
            const imgSrc = (img && img.src && !img.src.includes('meta')) ? img.src : null;
            activeChats.push({ name: name, src: imgSrc, rowElement: row });
        });
    } else {
        activeChats = window.WA.state.cachedMiniChats;
    }

    if (activeChats.length === 0) return;

    const currentChatNames = activeChats.map(c => c.name).join('|');
    if (window.WA.state.previousActiveChatsNames === currentChatNames && miniChatsContainer && miniChatsContainer.innerHTML !== '') {
        miniChatsContainer.style.display = 'flex'; 
        return; 
    }
    window.WA.state.previousActiveChatsNames = currentChatNames;

    let topPosition = 250;
    let leftPosition = 12;

    const metaAiIcon = document.querySelector('[aria-label*="Meta"], [title*="Meta"], [data-icon*="meta"]');
    const communitiesBtn = document.querySelector(window.WA.SELECTORS.communitiesBtn);
    const navIcons = document.querySelectorAll(window.WA.SELECTORS.headerIcons);

    let lowestElement = metaAiIcon || communitiesBtn;
    if (navIcons.length > 0) {
        const lastNavIcon = navIcons[navIcons.length - 1];
        if (!lowestElement || (lastNavIcon.getBoundingClientRect().bottom > lowestElement.getBoundingClientRect().bottom)) {
            lowestElement = lastNavIcon;
        }
    }

    if (lowestElement) {
        const rect = lowestElement.getBoundingClientRect();
        topPosition = rect.bottom + 15;
        leftPosition = rect.left + (rect.width / 2) - 27;
    }

    const navHeader = window.WA.dom.getNavHeader();
    const parentContainer = navHeader || document.body;

    if (!miniChatsContainer) {
      miniChatsContainer = document.createElement('div');
      miniChatsContainer.id = 'wa-extension-mini-chats';
      parentContainer.appendChild(miniChatsContainer);
    } else if (miniChatsContainer.parentElement !== parentContainer) {
      parentContainer.appendChild(miniChatsContainer);
    }
    
    const isFloatingInBody = (parentContainer === document.body);
    miniChatsContainer.style.display = 'flex';
    miniChatsContainer.style.position = isFloatingInBody ? 'fixed' : 'absolute';
    miniChatsContainer.style.width = `54px`; 
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
        miniChatsContainer.style.zIndex = '5'; 
    }
    
    const defaultAvatar = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23aebac1"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-3.8-1.04-4.84-2.6.03-1.6 3.23-2.4 4.84-2.4s4.81.8 4.84 2.4C15.8 18.96 14.03 20 12 20z"/></svg>`;

    miniChatsContainer.innerHTML = ''; 

    activeChats.forEach(chat => {
      const miniContainer = document.createElement('div');
      miniContainer.className = 'wa-mini-chat-item';
      miniContainer.title = chat.name;
      
      const clone = document.createElement('img');
      clone.className = 'wa-mini-chat-img';
      clone.onerror = () => {
        clone.src = defaultAvatar;
      };
      clone.src = chat.src || defaultAvatar;
      
      miniContainer.appendChild(clone);
      
      miniContainer.onclick = (e) => {
        e.stopPropagation();
        
        const span = document.querySelector(`#pane-side span[title="${chat.name}"], #side span[title="${chat.name}"], [aria-label="Lista de chats"] span[title="${chat.name}"]`);
        
        if (span) {
            let current = span;
            let handled = false;
            for (let i=0; i<6; i++) {
                if (current && (current.getAttribute('role')==='button' || current.getAttribute('role')==='row' || current.getAttribute('role')==='listitem' || current.getAttribute('tabindex')==='-1')) {
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
};
