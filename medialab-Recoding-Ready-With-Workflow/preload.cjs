const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
  getDefaultSaveInfo: () => ipcRenderer.invoke('get-default-save-info'),
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
  onRecordingError: (callback) => { const fn = (_e, value) => callback(value); ipcRenderer.on('recording-error', fn); return () => ipcRenderer.removeListener('recording-error', fn); }
});
