import { contextBridge } from 'electron';

// Expose protected methods that allow the renderer process to use
// necessary electron APIs safely through contextBridge.
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
});
