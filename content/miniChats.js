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
              if (window.WA.BLACKLIST.includes(name.toLowerCase().trim())) return;
              if (img && img.src) {
                  window.WA.state.cachedMiniChats.push({
                      name: name,
                      src: img.src
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
            if (window.WA.BLACKLIST.includes(name.toLowerCase().trim())) return;
            if (img && img.src) {
                activeChats.push({ name: name, src: img.src, rowElement: row });
            }
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

    const communitiesBtn = document.querySelector(window.WA.SELECTORS.communitiesBtn);
    if (communitiesBtn) {
        const rect = communitiesBtn.getBoundingClientRect();
        topPosition = rect.bottom + 20;
        leftPosition = rect.left + (rect.width / 2) - 27; 
    } else {
        const icons = document.querySelectorAll(window.WA.SELECTORS.headerIcons);
        if (icons.length > 0) {
            const rect = icons[icons.length - 1].getBoundingClientRect();
            topPosition = rect.bottom + 20;
            leftPosition = rect.left + (rect.width / 2) - 27;
        }
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
    
    miniChatsContainer.innerHTML = ''; 

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
