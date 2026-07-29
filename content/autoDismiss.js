/**
 * @file content/autoDismiss.js
 * @description Runs at document_start to automatically dismiss the WhatsApp
 *              "open in another window" dialog. Corre antes del renderizado de
 *              página para interceptar el diálogo lo antes posible.
 * @context Injected before document_idle scripts via a separate manifest entry.
 */
(function autoDismissMultiWindowDialog() {
  'use strict';

  /** Selectors and button texts WhatsApp uses for the "Use here" confirm button */
  const BUTTON_SELECTORS = [
    '[data-testid="popup-controls-ok"]',
    '[data-testid="confirm-popup-ok"]',
  ];
  const BUTTON_TEXTS = ['usar aquí', 'use here', 'usar aqui'];

  /**
   * Attempts to find and click the "Usar aquí" / "Use here" button.
   * @returns {boolean} true if the button was found and clicked.
   */
  function tryDismiss() {
    // Strategy 1: known data-testid attributes
    for (const sel of BUTTON_SELECTORS) {
      const btn = document.querySelector(sel);
      if (btn) {
        console.log('[WA Sidebar] Auto-dismiss: clic en "Usar aquí" (testid).');
        btn.click();
        return true;
      }
    }

    // Strategy 2: scan all buttons by visible text (case-insensitive)
    const buttons = document.querySelectorAll('button, [role="button"]');
    for (const btn of buttons) {
      const text = (btn.textContent || btn.innerText || '').trim().toLowerCase();
      if (BUTTON_TEXTS.some(t => text.includes(t))) {
        console.log('[WA Sidebar] Auto-dismiss: clic en "Usar aquí" (texto).');
        btn.click();
        return true;
      }
    }

    return false;
  }

  // ─── MutationObserver — catches the dialog the moment it enters the DOM ────
  const observer = new MutationObserver(() => {
    if (tryDismiss()) {
      // Keep the observer alive — WhatsApp may re-show the dialog after navigation
    }
  });

  // Start observing as early as possible (document_start means <html> may not
  // exist yet; fall back to documentElement which is always available).
  const root = document.documentElement || document;
  observer.observe(root, { childList: true, subtree: true });

  // Also try right away in case the dialog is already present (re-injection case)
  tryDismiss();
})();
