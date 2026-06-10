document.addEventListener('DOMContentLoaded', () => {
  const muteSoundToggle = document.getElementById('muteSoundToggle');
  const muteNotifsToggle = document.getElementById('muteNotifsToggle');
  const ringtoneSelect = document.getElementById('ringtoneSelect');
  const testRingtoneBtn = document.getElementById('testRingtoneBtn');

  // Cargar estado inicial desde storage
  browser.storage.local.get(['isSoundMuted', 'isNotifMuted', 'ringtone']).then((res) => {
    muteSoundToggle.checked = res.isSoundMuted || false;
    muteNotifsToggle.checked = res.isNotifMuted || false;
    ringtoneSelect.value = res.ringtone || 'black_mirror';
  });

  // Guardar cambios cuando el usuario hace toggle o select
  muteSoundToggle.addEventListener('change', (e) => {
    browser.storage.local.set({ isSoundMuted: e.target.checked });
  });

  muteNotifsToggle.addEventListener('change', (e) => {
    browser.storage.local.set({ isNotifMuted: e.target.checked });
  });

  ringtoneSelect.addEventListener('change', (e) => {
    browser.storage.local.set({ ringtone: e.target.value });
  });

  // Probar Tono
  testRingtoneBtn.addEventListener('click', () => {
    const selectedRingtone = ringtoneSelect.value;
    browser.runtime.sendMessage({ 
      type: 'test_ringtone', 
      ringtone: selectedRingtone 
    });
  });
});
