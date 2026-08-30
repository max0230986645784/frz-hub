const { contextBridge, ipcRenderer } = require('electron');

const invoke = (channel, payload) => ipcRenderer.invoke('frz:invoke', channel, payload);

/** Single, explicit surface exposed to the UI. No node access in the renderer. */
contextBridge.exposeInMainWorld('frz', {
  platform: process.platform,
  invoke,
  window: {
    minimize: () => ipcRenderer.send('frz:window', 'minimize'),
    maximize: () => ipcRenderer.send('frz:window', 'maximize'),
    close: () => ipcRenderer.send('frz:window', 'close'),
  },
  on: (channel, listener) => {
    const wrapped = (_event, payload) => listener(payload);
    ipcRenderer.on(channel, wrapped);
    return () => ipcRenderer.removeListener(channel, wrapped);
  },
});
