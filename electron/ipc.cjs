const { ipcMain, shell, clipboard } = require('electron');
const store = require('./lib/store.cjs');
const system = require('./services/system.cjs');
const apps = require('./services/apps.cjs');
const games = require('./services/games.cjs');
const network = require('./services/network.cjs');
const toolbox = require('./services/tools.cjs');
const media = require('./services/media.cjs');
const weather = require('./services/weather.cjs');
const account = require('./services/account.cjs');
const github = require('./services/github.cjs');
const tiktok = require('./services/tiktok.cjs');
const studio = require('./brain/studio.cjs');
const brain = require('./brain/index.cjs');

/** Every capability the renderer can call, one flat map of pure functions. */
const handlers = {
  'settings:get': () => store.get('settings'),
  'settings:set': (patch) => store.update((state) => {
    state.settings = { ...state.settings, ...patch };
    return state.settings;
  }),

  'system:snapshot': () => system.snapshot(),
  'system:report': () => system.report(),
  'system:processes': (limit) => system.processes(limit ?? 12),
  'system:kill': (pid) => system.killProcess(pid),

  'apps:list': () => apps.list(),
  'apps:add': (entry) => apps.add(entry),
  'apps:update': ({ id, patch }) => apps.update(id, patch),
  'apps:remove': (id) => apps.remove(id),
  'apps:launch': (id) => apps.launch(id),
  'apps:pick': () => apps.pickTarget(),
  'apps:scan': () => apps.scanInstalled(),
  'apps:recent': () => apps.recentLaunches(),

  'games:list': () => games.list(),
  'games:add': (entry) => games.add(entry),
  'games:update': ({ id, patch }) => games.update(id, patch),
  'games:remove': (id) => games.remove(id),
  'games:launch': (id) => games.launch(id),
  'games:favorite': (id) => games.toggleFavorite(id),
  'games:scan': () => games.scan(),
  'games:sessions': () => games.sessions(),

  'network:status': () => network.status(),
  'network:speedtest': () => network.speedtest(),
  'network:ping': (host) => network.ping(host),
  'network:devices': (options) => network.devices(options ?? {}),
  'network:rename': ({ id, name }) => network.renameDevice(id, name),
  'network:forget': (id) => network.forgetDevice(id),

  'tools:password': (options) => toolbox.password(options ?? {}),
  'tools:compress': (options) => toolbox.compress(options),
  'tools:extract': (options) => toolbox.extract(options),
  'tools:convertVideo': (options) => toolbox.convertVideo(options),
  'tools:cutVideo': (options) => toolbox.cutVideo(options),
  'tools:convertAudio': (options) => toolbox.convertAudio(options),
  'tools:convertImage': (options) => toolbox.convertImage(options),
  'tools:pdfToImages': (options) => toolbox.pdfToImages(options),
  'tools:cleanTemp': (options) => toolbox.cleanTemp(options ?? {}),
  'tools:search': (options) => toolbox.searchFiles(options),
  'tools:notes': () => toolbox.notes(),
  'tools:saveNote': (note) => toolbox.saveNote(note),
  'tools:deleteNote': (id) => toolbox.deleteNote(id),
  'tools:pick': (options) => toolbox.pickFile(options ?? {}),
  'tools:reveal': (target) => toolbox.reveal(target),
  'tools:openPath': (target) => toolbox.openPath(target),
  'tools:ffmpeg': () => toolbox.ffmpeg(),

  'media:folders': () => media.folders(),
  'media:addFolder': () => media.addFolder(),
  'media:removeFolder': (id) => media.removeFolder(id),
  'media:scan': () => media.scan(),

  'weather:current': () => weather.current(),
  'weather:search': (query) => weather.searchCity(query),

  'account:current': () => account.current(),
  'account:local': (profile) => account.loginLocal(profile),
  'account:discord': () => account.loginDiscord(),
  'account:logout': () => account.logout(),
  'account:pickAvatar': () => account.pickAvatar(),
  'account:setAvatar': (target) => account.setAvatar(target),

  'tiktok:configured': () => tiktok.configured(),
  'tiktok:configure': (payload) => tiktok.configure(payload),
  'tiktok:start': () => tiktok.start(),
  'tiktok:poll': () => tiktok.poll(),

  'github:connected': () => github.connected(),
  'github:deviceStart': () => github.startDeviceLogin(),
  'github:devicePoll': (payload) => github.pollDeviceLogin(payload),
  'github:token': (token) => github.loginWithToken(token),
  'github:repos': (options) => github.repos(options ?? {}),
  'github:activity': () => github.activity(),
  'github:notifications': () => github.notifications(),
  'github:pulls': () => github.pullRequests(),
  'github:clone': (fullName) => github.clone(fullName),
  'github:open': (target) => github.openInEditor(target),

  'studio:generate': (request) => studio.generate(request),
  'studio:list': () => studio.list(),
  'studio:open': (id) => studio.open(id),
  'studio:read': ({ id, file }) => studio.readFile(id, file),
  'studio:remove': (id) => studio.remove(id),
  'studio:catalogue': () => studio.catalogue,

  'brain:ask': (text) => brain.ask(text),
  'brain:capabilities': () => brain.capabilities(),
  'brain:suggestions': () => brain.suggestions(),
  'brain:transcript': () => brain.transcript(),
  'brain:forget': () => brain.forget(),
  'brain:laws': () => brain.LAWS,
  'brain:learned': () => brain.learned(),

  'shell:openExternal': (url) => shell.openExternal(url),
  'clipboard:write': (text) => clipboard.writeText(String(text ?? '')),
};

function register() {
  ipcMain.handle('frz:invoke', async (_event, channel, payload) => {
    const handler = handlers[channel];
    if (!handler) throw new Error(`Canal inconnu : ${channel}`);
    return handler(payload);
  });
}

module.exports = { register, handlers };
