const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
  getDefaultSaveInfo: (fallbackPath) => ipcRenderer.invoke('get-default-save-info', fallbackPath),
  savePreferences: (preferences) => ipcRenderer.invoke('save-preferences', preferences),
  getOpenWindows: () => ipcRenderer.invoke('get-open-windows'),
  chooseFolder: (format) => ipcRenderer.invoke('choose-folder', format),
  selectRegion: () => ipcRenderer.invoke('select-region'),
  startRecord: (options) => ipcRenderer.invoke('start-record', options),
  pauseRecord: () => ipcRenderer.invoke('pause-record'),
  resumeRecord: () => ipcRenderer.invoke('resume-record'),
  stopSave: () => ipcRenderer.invoke('stop-save'),
  onRegionUpdated: (callback) => { const fn = (_e, value) => callback(value); ipcRenderer.on('region-updated', fn); return () => ipcRenderer.removeListener('region-updated', fn); },
  onRecordingSaved: (callback) => { const fn = (_e, value) => callback(value); ipcRenderer.on('recording-saved', fn); return () => ipcRenderer.removeListener('recording-saved', fn); },
  onRecordingStatusChange: (callback) => { const fn = (_e, value) => callback(value); ipcRenderer.on('recording-status-change', fn); return () => ipcRenderer.removeListener('recording-status-change', fn); },
  prepareAudio: (options) => ipcRenderer.invoke('prepare-audio', options),
  cancelAudioPrepare: () => ipcRenderer.invoke('cancel-audio-prepare'),
  onHotkeyStart: (callback) => { const fn = () => callback(); ipcRenderer.on('hotkey-start', fn); return () => ipcRenderer.removeListener('hotkey-start', fn); },
  onRecordingError: (callback) => { const fn = (_e, value) => callback(value); ipcRenderer.on('recording-error', fn); return () => ipcRenderer.removeListener('recording-error', fn); }
});
