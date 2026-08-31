const { contextBridge, ipcRenderer } = require('electron');

const invoke = (channel, payload) => ipcRenderer.invoke('frz:invoke', channel, payload);

const EVENTS = ['bots:log', 'bots:status', 'editor:progress'];

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
    if (!EVENTS.includes(channel)) throw new Error(`Canal inconnu : ${channel}`);
    const wrapped = (_event, payload) => listener(payload);
    ipcRenderer.on(channel, wrapped);
    return () => ipcRenderer.removeListener(channel, wrapped);
  },
});
