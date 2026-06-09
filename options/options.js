document.addEventListener('DOMContentLoaded', () => {
  const muteSoundToggle = document.getElementById('muteSoundToggle');
  const muteNotifsToggle = document.getElementById('muteNotifsToggle');

  // Cargar estado inicial desde storage
  browser.storage.local.get(['isSoundMuted', 'isNotifMuted']).then((res) => {
    muteSoundToggle.checked = res.isSoundMuted || false;
    muteNotifsToggle.checked = res.isNotifMuted || false;
  });

  // Guardar cambios cuando el usuario hace toggle
  muteSoundToggle.addEventListener('change', (e) => {
    browser.storage.local.set({ isSoundMuted: e.target.checked });
  });

  muteNotifsToggle.addEventListener('change', (e) => {
    browser.storage.local.set({ isNotifMuted: e.target.checked });
  });
});
