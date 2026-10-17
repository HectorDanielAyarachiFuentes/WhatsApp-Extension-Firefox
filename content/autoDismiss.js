/**
 * @file content/autoDismiss.js
 * @description Automatically dismisses the "WhatsApp is open in another window" dialog
 *              in the SIDEBAR only. Runs at document_start via a dedicated manifest entry.
 *
 *   *** CRITICAL: This script MUST NOT run in the background iframe. ***
 *   If it ran in both instances, clicking "Usar aquí" in both would create an
 *   infinite loop where each side keeps claiming primary status forever.
 *   We detect the background iframe via window.name and exit immediately.
 *
 * @context Injected at document_start into web.whatsapp.com frames.
 */
(function autoDismissMultiWindowDialog() {
  'use strict';

  // ─── GUARD 1: Never run in standard browser tabs (top-level window) ──────
  // The sidebar runs WhatsApp inside an iframe. Normal tabs are at top-level.
  if (window.top === window) {
    return;
  }

  // ─── GUARD 2: Never run in the background notification iframe ────────────
  // background.js sets backgroundIframe.name = 'wa-background-iframe'.
  // When that iframe runs this script, window.name will be 'wa-background-iframe'.
  // In that case we do NOTHING — WhatsApp will handle the supersession silently.
  if (window.name === 'wa-background-iframe') {
    console.log('[WA Sidebar] autoDismiss: iframe de fondo detectado, saliendo.');
    return;
  }

  /** Known data-testid values for the "Use here" confirm button */
  const BUTTON_SELECTORS = [
    '[data-testid="popup-controls-ok"]',
    '[data-testid="confirm-popup-ok"]',
  ];

  /** Text fragments to match against button labels (lower-case) */
  const BUTTON_TEXTS = ['usar aquí', 'usar aqui', 'use here'];

  /**
   * Scans the document for the "Usar aquí" button and clicks it.
   * @returns {boolean} true if a button was found and clicked.
   */
  function tryDismiss() {
    // Strategy 1: known data-testid attributes
    for (const sel of BUTTON_SELECTORS) {
      const btn = document.querySelector(sel);
      if (btn) {
        console.log('[WA Sidebar] Auto-dismiss: clic "Usar aquí" (testid).');
        btn.click();
        return true;
      }
    }

    // Strategy 2: text scan (handles locale variations)
    for (const btn of document.querySelectorAll('button, [role="button"]')) {
      const text = (btn.textContent || '').trim().toLowerCase();
      if (BUTTON_TEXTS.some(t => text.includes(t))) {
        console.log('[WA Sidebar] Auto-dismiss: clic "Usar aquí" (texto).');
        btn.click();
        return true;
      }
    }

    return false;
  }

  /**
   * Cierra automáticamente el cartel de "Sincronización en segundo plano"
   * (función de Chrome no soportada por Firefox que WhatsApp muestra en bucle).
   */
  function tryDismissBackgroundSync() {
    const banners = document.querySelectorAll('div, [role="alert"], [role="region"], [role="status"]');
    for (const el of banners) {
      if (el.children.length > 8) continue;
      const text = (el.textContent || '').toLowerCase();
      if (
        (text.includes('sincronización') || text.includes('sincroniza') || text.includes('sync')) &&
        (text.includes('segundo plano') || text.includes('background') || text.includes('rendimiento más rápido'))
      ) {
        const closeBtn = el.querySelector('button, [data-icon="x"], [data-testid="x"], [aria-label*="Cerrar"], [aria-label*="Close"]');
        if (closeBtn) {
          console.log('[WA] Auto-dismiss: cerrando cartel de sincronización.');
          const target = closeBtn.closest('button') || closeBtn;
          target.click?.();
        }
        el.style.setProperty('display', 'none', 'important');
        return true;
      }
    }
    return false;
  }

  function handleAllDismissals() {
    tryDismiss();
    tryDismissBackgroundSync();
  }

  // ─── MutationObserver — catches dialogs the instant they enter the DOM ──
  const observer = new MutationObserver(handleAllDismissals);
  observer.observe(document.documentElement || document, {
    childList: true,
    subtree: true,
  });

  // ─── Periodic fallback ───
  const interval = setInterval(handleAllDismissals, 1000);

  // Clean up interval after 2 minutes
  setTimeout(() => clearInterval(interval), 120_000);

  // Try immediately in case dialog is already rendered
  handleAllDismissals();
})();

