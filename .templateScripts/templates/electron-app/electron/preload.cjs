const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Add preload APIs here
});