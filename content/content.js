/**
 * @file content/content.js
 * @description The main entry point for the content script. Starts Observers and connects all modules.
 * @context Evaluated last in the content_scripts array.
 */
window.WA = window.WA || {};

(function () {
  let initAttempts = 0;
  const waitForApp = setInterval(() => {
    initAttempts++;
    const app = document.querySelector('#app');
    const isLoaded = document.querySelector('#side, #pane-side, [data-testid="chat-list"], header');
    if (app && isLoaded) {
      clearInterval(waitForApp);
      console.log('[WA Sidebar] WhatsApp detectado, iniciando escaneo...');
      init();
    }
    if (initAttempts > 60) {
      clearInterval(waitForApp);
    }
  }, 2000);

  function init() {
    const isBackground = (window.name === 'wa-background-iframe');

    const observer = new MutationObserver(() => window.WA.scanner.scanUnreadChats());
    let observerContainer = null;

    const tryObserve = () => {
      const containers = document.querySelectorAll(window.WA.SELECTORS.chatListContainer);
      if (containers.length > 0) {
        const container = containers[containers.length - 1]; 
        if (container !== observerContainer) {
          if (observerContainer) observer.disconnect();
          observer.observe(container, { childList: true, subtree: true, characterData: true });
          observerContainer = container;
        }
      }
    };

    tryObserve();
    setInterval(tryObserve, 2000);
    setTimeout(window.WA.scanner.scanUnreadChats, 200);

    if (isBackground) {
      console.log('[WA Sidebar] Ejecutando en segundo plano (modo notificaciones).');
      return;
    }

    console.log('[WA Sidebar] Ejecutando en la barra lateral interactiva.');
    setInterval(() => {
      window.WA.resizer.setupResizer(); 
      window.WA.resizer.checkCollapseState(); 
      window.WA.miniChats.renderMiniChats(); 
    }, 500);
  }

  browser.runtime.onMessage.addListener(async (message) => {
    if (message.type === 'quick_reply') {
      await window.WA.quickReply.handleQuickReply(message.contact, message.message);
    }
  });

  window.addEventListener('message', async (event) => {
    if (event.data && event.data.type === 'quick_reply') {
      await window.WA.quickReply.handleQuickReply(event.data.contact, event.data.message);
    } else if (event.data && event.data.type === 'toggle_internal_panel') {
      const resizer = document.getElementById('wa-extension-resizer');
      if (resizer && resizer.parentElement) {
         const leftPane = resizer.parentElement;
         const currentWidth = leftPane.getBoundingClientRect().width;
         const marginRight = parseInt(getComputedStyle(leftPane).marginRight) || 0;
         
         if (currentWidth < 150 || marginRight < -100) {
            leftPane.style.flexBasis = `350px`;
            leftPane.style.maxWidth = `350px`;
            leftPane.style.width = `350px`;
            leftPane.style.minWidth = `350px`;
            leftPane.style.marginLeft = `0px`;
            leftPane.style.marginRight = `0px`;
            leftPane.style.visibility = '';
            leftPane.classList.remove('wa-is-collapsed');
            resizer.style.left = 'auto';
            resizer.style.right = '-8px';
         } else {
            leftPane.style.flexBasis = `300px`;
            leftPane.style.maxWidth = `300px`;
            leftPane.style.width = `300px`;
            leftPane.style.minWidth = `300px`;
            leftPane.style.marginLeft = `0px`;
            leftPane.style.marginRight = `-300px`; 
            leftPane.style.visibility = '';
            leftPane.classList.add('wa-is-collapsed');
            resizer.style.left = '0px';
            resizer.style.right = 'auto';
         }
      }
    }
  });
})();
