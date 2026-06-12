/**
 * @file content/quickReply.js
 * @description Simulates keyboard and clipboard events to automatically send messages without user typing.
 * @context Depends on window.WA.dom. Extracts chat target and dispatches Events.
 */
window.WA = window.WA || {};

window.WA.quickReply = {
  handleQuickReply: async function(contactName, text) {
      const chatRows = window.WA.dom.getChatRows();
      let targetRow = null;
      for (const row of chatRows) {
        if (window.WA.dom.extractContactName(row) === contactName) {
          targetRow = row;
          break;
        }
      }

      if (targetRow) {
        const span = targetRow.querySelector(`span[title="${contactName}"]`);
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
        } else {
            targetRow.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
            targetRow.click();
        }

        let composeBox = null;
        for (let i = 0; i < 20; i++) {
          await new Promise(r => setTimeout(r, 100));
          composeBox = document.querySelector('[data-testid="conversation-compose-box-input"], div[contenteditable="true"][data-tab="10"]');
          if (composeBox) break;
        }

        if (composeBox) {
          composeBox.focus();

          document.execCommand('insertText', false, text);
          composeBox.dispatchEvent(new Event('input', { bubbles: true }));

          const dataTransfer = new DataTransfer();
          dataTransfer.setData('text/plain', text);
          composeBox.dispatchEvent(new ClipboardEvent('paste', {
            clipboardData: dataTransfer,
            bubbles: true,
            cancelable: true
          }));
          
          setTimeout(() => {
            let sendBtn = document.querySelector('[data-testid="send"], [aria-label="Enviar"], span[data-icon="send"]');
            if (sendBtn) {
              if (sendBtn.tagName === 'SPAN' || sendBtn.tagName === 'svg' || sendBtn.tagName === 'path') {
                  sendBtn = sendBtn.closest('button') || sendBtn.parentElement;
              }
              sendBtn.click();
            } else {
              composeBox.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', keyCode: 13 }));
              composeBox.dispatchEvent(new KeyboardEvent('keypress', { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', keyCode: 13 }));
              composeBox.dispatchEvent(new KeyboardEvent('keyup',   { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', keyCode: 13 }));
            }
            
            window.WA.state.ignoredContacts.set(contactName, Date.now());
            
            setTimeout(() => {
              const target = document.activeElement || document.body;
              const appRoot = document.querySelector('#app') || document.body;
              
              ['keydown', 'keyup'].forEach(type => {
                  const escEvent = new KeyboardEvent(type, { 
                      bubbles: true, 
                      cancelable: true, 
                      key: 'Escape', 
                      code: 'Escape', 
                      keyCode: 27,
                      which: 27
                  });
                  target.dispatchEvent(escEvent);
                  appRoot.dispatchEvent(escEvent);
              });
            }, 500);

          }, 400); 
        }
      }
  }
};
