const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow, ipcMain, net, protocol, shell } = require('electron');
const { register } = require('./ipc.cjs');
const bots = require('./services/bots.cjs');

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const DIST = path.join(__dirname, '..', 'dist');

let mainWindow = null;

protocol.registerSchemesAsPrivileged([
  { scheme: 'frz-app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
  { scheme: 'frz-file', privileges: { standard: false, secure: true, supportFetchAPI: true, stream: true, bypassCSP: false } },
]);

/** Serves the built UI so the app never needs file:// URLs. */
function serveApp() {
  protocol.handle('frz-app', (request) => {
    const url = new URL(request.url);
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    const target = path.join(DIST, relative);
    const safe = target.startsWith(DIST) && fs.existsSync(target) ? target : path.join(DIST, 'index.html');
    return net.fetch(`file://${safe.split(path.sep).join('/')}`);
  });
}

/** Streams local media (posters, movies, music) picked by the user. */
function serveFiles() {
  protocol.handle('frz-file', (request) => {
    const target = decodeURIComponent(new URL(request.url).pathname.replace(/^\/+/, ''));
    if (!fs.existsSync(target)) return new Response('Not found', { status: 404 });
    return net.fetch(`file://${target.split(path.sep).join('/')}`);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    show: false,
    backgroundColor: '#080814',
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (DEV_SERVER_URL) mainWindow.loadURL(DEV_SERVER_URL);
  else mainWindow.loadURL('frz-app://hub/index.html');
}

ipcMain.on('frz:window', (_event, action) => {
  if (!mainWindow) return;
  if (action === 'minimize') mainWindow.minimize();
  else if (action === 'maximize') {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  } else if (action === 'close') mainWindow.close();
});

app.whenReady().then(() => {
  serveApp();
  serveFiles();
  register();
  createWindow();
  bots.bootAutostart();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => bots.stopAll());

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
