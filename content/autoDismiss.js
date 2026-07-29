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

  // ─── GUARD: Never run in the background notification iframe ──────────────
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

  // ─── MutationObserver — catches the dialog the instant it enters the DOM ──
  const observer = new MutationObserver(tryDismiss);
  observer.observe(document.documentElement || document, {
    childList: true,
    subtree: true,
  });

  // ─── Periodic fallback — in case Shadow DOM or async renders are missed ───
  const interval = setInterval(() => {
    if (tryDismiss()) clearInterval(interval);
  }, 1000);

  // Clean up interval after 2 minutes (dialog is long gone by then)
  setTimeout(() => clearInterval(interval), 120_000);

  // Try immediately in case dialog is already rendered
  tryDismiss();
})();

