/**
 * @file content/resizer.js
 * @description Adds draggable edges to the WhatsApp chat list and navigation rail to make them resizable inside the sidebar.
 * @context Mutates DOM style properties. Uses window.WA state to track collapse.
 */
window.WA = window.WA || {};

window.WA.resizer = {
  setupResizer: function() {
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

          resizer.addEventListener('dblclick', function(e) {
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
             e.preventDefault();
             e.stopPropagation();
          });

          const onMouseMove = function(e) {
            if (!isResizing) return;
            
            let navWidth = 64; 
            const headers = document.querySelectorAll('header');
            if (headers.length > 0) {
                const navRect = headers[0].getBoundingClientRect();
                if (navRect.left === 0 && navRect.width < 100) {
                    navWidth = navRect.width;
                }
            }
            
            let newWidth = e.clientX - navWidth;
            if (newWidth < 0) newWidth = 0;
            
            if (newWidth >= 0 && newWidth <= window.innerWidth - 20) {
              const resizerElem = document.getElementById('wa-extension-resizer');
              if (newWidth < 80) {
                 leftPane.style.flexBasis = `300px`;
                 leftPane.style.maxWidth = `300px`;
                 leftPane.style.width = `300px`;
                 leftPane.style.minWidth = `300px`;
                 
                 leftPane.style.marginLeft = `0px`;
                 leftPane.style.marginRight = `-300px`; 
                 leftPane.style.visibility = '';
                 leftPane.classList.add('wa-is-collapsed'); 
                 
                 if (resizerElem) {
                     resizerElem.style.left = '0px';
                     resizerElem.style.right = 'auto';
                 }
              } else {
                 leftPane.style.flexBasis = `${newWidth}px`;
                 leftPane.style.maxWidth = `${newWidth}px`;
                 leftPane.style.width = `${newWidth}px`;
                 leftPane.style.minWidth = `${newWidth}px`;
                 
                 leftPane.style.marginLeft = `0px`;
                 leftPane.style.marginRight = `0px`;
                 leftPane.style.visibility = '';
                 leftPane.classList.remove('wa-is-collapsed');
                 
                 if (resizerElem) {
                     resizerElem.style.left = 'auto';
                     resizerElem.style.right = '-8px'; 
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

    if (!document.getElementById('wa-extension-nav-resizer')) {
      const navHeader = window.WA.dom.getNavHeader();
        
      if (navHeader) {
        let navPane = navHeader.parentElement;
        
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

          navResizer.addEventListener('dblclick', function(e) {
              window.postMessage({ type: 'toggle_internal_panel' }, '*');
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
  },

  checkCollapseState: function() {
      const resizer = document.getElementById('wa-extension-resizer');
      if (resizer && resizer.parentElement) {
          const leftPane = resizer.parentElement;
          const marginRight = parseInt(getComputedStyle(leftPane).marginRight) || 0;
          if (marginRight < -100) {
              window.WA.state.isChatListCollapsed = true;
          } else {
              const width = leftPane.getBoundingClientRect().width;
              window.WA.state.isChatListCollapsed = (width > 0 && width < 90);
          }
      }
  }
};
