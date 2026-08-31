const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { BrowserWindow, shell } = require('electron');
const store = require('../lib/store.cjs');
const { IS_WIN } = require('../lib/run.cjs');
const account = require('./account.cjs');
const studio = require('../brain/studio.cjs');

const MAX_LINES = 400;
const RESTART_DELAY = 4000;

/** Live processes, never persisted : { child, startedAt, lines, restarts, stopping }. */
const running = new Map();

function broadcast(channel, payload) {
  for (const window of BrowserWindow.getAllWindows()) window.webContents.send(channel, payload);
}

function bots() {
  return store.get('bots') ?? [];
}

function find(id) {
  const bot = bots().find((entry) => entry.id === id);
  if (!bot) throw new Error('Bot introuvable.');
  return bot;
}

function state(bot) {
  const live = running.get(bot.id);
  const { tokenRef: _tokenRef, ...safe } = bot;
  return {
    ...safe,
    hasToken: Boolean(bot.tokenRef),
    status: live ? 'running' : 'stopped',
    pid: live?.child.pid ?? null,
    startedAt: live?.startedAt ?? null,
    restarts: live?.restarts ?? 0,
  };
}

function list() {
  return bots().map(state);
}

function patch(id, changes) {
  return store.update((current) => {
    const target = (current.bots ?? []).find((entry) => entry.id === id);
    if (target) Object.assign(target, changes, { id: target.id });
    return target;
  });
}

function push(id, stream, chunk) {
  const live = running.get(id);
  if (!live) return;
  for (const line of String(chunk).split(/\r?\n/).filter(Boolean)) {
    const entry = { at: Date.now(), stream, line };
    live.lines.push(entry);
    if (live.lines.length > MAX_LINES) live.lines.shift();
    broadcast('bots:log', { id, ...entry });
  }
}

function runtimeCommand(bot) {
  if (bot.runtime === 'python') return { command: IS_WIN ? 'python' : 'python3', args: [bot.entry] };
  return { command: process.execPath, args: [bot.entry] };
}

/**
 * Bots run on Electron's bundled Node through ELECTRON_RUN_AS_NODE, so a plain
 * Windows install never needs a separate Node.js to host a Discord bot.
 */
function environment(bot) {
  const env = { ...process.env, ELECTRON_RUN_AS_NODE: '1', NODE_ENV: 'production' };
  const token = account.reveal(bot.tokenRef);
  if (token) {
    env.DISCORD_TOKEN = token;
    env.TOKEN = token;
    env.BOT_TOKEN = token;
  }
  return env;
}

function register(entry) {
  const bot = {
    id: randomUUID(),
    name: entry.name?.trim() || 'Bot',
    directory: entry.directory,
    entry: entry.entry || 'index.js',
    runtime: entry.runtime || 'node',
    tokenRef: null,
    autostart: false,
    restartOnCrash: true,
    projectId: entry.projectId ?? null,
    createdAt: Date.now(),
  };
  store.update((current) => {
    current.bots = [bot, ...(current.bots ?? [])];
    return bot;
  });
  return state(bot);
}

/** Guesses the file to run so an imported folder works without configuration. */
async function detectEntry(directory) {
  try {
    const manifest = JSON.parse(await fsp.readFile(path.join(directory, 'package.json'), 'utf8'));
    if (typeof manifest.main === 'string') return { entry: manifest.main, runtime: 'node' };
  } catch {
    /* not a node project */
  }
  for (const candidate of ['index.js', 'bot.js', 'main.js', 'src/index.js']) {
    if (fs.existsSync(path.join(directory, candidate))) return { entry: candidate, runtime: 'node' };
  }
  for (const candidate of ['bot.py', 'main.py', 'index.py']) {
    if (fs.existsSync(path.join(directory, candidate))) return { entry: candidate, runtime: 'python' };
  }
  throw new Error("Aucun fichier de demarrage trouve (index.js, bot.js ou bot.py).");
}

/** Generates a Discord bot with Velora Studio and hosts it right away. */
async function create(request) {
  const project = await studio.generate(`bot discord ${request ?? ''}`.trim());
  const detected = await detectEntry(project.directory);
  return register({
    name: project.name,
    directory: project.directory,
    entry: detected.entry,
    runtime: detected.runtime,
    projectId: project.id,
  });
}

async function adopt(directory) {
  const detected = await detectEntry(directory);
  return register({ name: path.basename(directory), directory, ...detected });
}

function setToken(id, token) {
  find(id);
  return state(patch(id, { tokenRef: token ? account.protect(token) : null }));
}

function configure(id, changes) {
  find(id);
  const allowed = {};
  if (typeof changes.name === 'string') allowed.name = changes.name.trim();
  if (typeof changes.entry === 'string') allowed.entry = changes.entry.trim();
  if (typeof changes.autostart === 'boolean') allowed.autostart = changes.autostart;
  if (typeof changes.restartOnCrash === 'boolean') allowed.restartOnCrash = changes.restartOnCrash;
  return state(patch(id, allowed));
}

/** Installs dependencies with npm (or pip) and streams the output as bot logs. */
function install(id) {
  const bot = find(id);
  if (running.has(id)) throw new Error('Arrete le bot avant de reinstaller ses dependances.');
  const isNode = bot.runtime !== 'python';
  const command = isNode ? (IS_WIN ? 'npm.cmd' : 'npm') : IS_WIN ? 'python' : 'python3';
  const args = isNode ? ['install'] : ['-m', 'pip', 'install', '-r', 'requirements.txt'];
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: bot.directory, windowsHide: true, env: process.env });
    running.set(id, { child, startedAt: Date.now(), lines: [], restarts: 0, stopping: true, task: 'install' });
    child.stdout.on('data', (chunk) => push(id, 'out', chunk));
    child.stderr.on('data', (chunk) => push(id, 'err', chunk));
    child.on('error', (error) => {
      running.delete(id);
      reject(new Error(`Installation impossible : ${error.message}`));
    });
    child.on('exit', (code) => {
      const lines = running.get(id)?.lines ?? [];
      running.delete(id);
      broadcast('bots:status', state(find(id)));
      if (code === 0) resolve({ ok: true, lines });
      else reject(new Error(`Installation echouee (code ${code}).`));
    });
  });
}

function start(id) {
  const bot = find(id);
  if (running.get(id)) return state(bot);
  const { command, args } = runtimeCommand(bot);
  const child = spawn(command, args, {
    cwd: bot.directory,
    env: environment(bot),
    windowsHide: true,
  });
  const live = { child, startedAt: Date.now(), lines: [], restarts: 0, stopping: false };
  running.set(id, live);

  child.stdout.on('data', (chunk) => push(id, 'out', chunk));
  child.stderr.on('data', (chunk) => push(id, 'err', chunk));
  child.on('error', (error) => push(id, 'err', `Velora : ${error.message}`));
  child.on('exit', (code, signal) => {
    const crashed = !live.stopping && code !== 0;
    push(id, 'err', `Velora : processus termine (code ${code ?? signal}).`);
    running.delete(id);
    broadcast('bots:status', state(find(id)));
    if (crashed && bot.restartOnCrash) {
      setTimeout(() => {
        try {
          const next = start(id);
          const restarted = running.get(id);
          if (restarted) restarted.restarts = live.restarts + 1;
          broadcast('bots:status', next);
        } catch {
          /* the bot was removed meanwhile */
        }
      }, RESTART_DELAY).unref?.();
    }
  });

  const snapshot = state(bot);
  broadcast('bots:status', snapshot);
  return snapshot;
}

function stop(id) {
  const bot = find(id);
  const live = running.get(id);
  if (!live) return state(bot);
  live.stopping = true;
  if (IS_WIN) spawn('taskkill', ['/pid', String(live.child.pid), '/t', '/f'], { windowsHide: true });
  else live.child.kill('SIGTERM');
  return state(bot);
}

function restart(id) {
  stop(id);
  return new Promise((resolve) => {
    setTimeout(() => resolve(start(id)), 800);
  });
}

function logs(id) {
  find(id);
  return running.get(id)?.lines ?? [];
}

function remove(id) {
  if (running.has(id)) stop(id);
  return store.update((current) => {
    current.bots = (current.bots ?? []).filter((entry) => entry.id !== id);
    return true;
  });
}

async function open(id) {
  const bot = find(id);
  const error = await shell.openPath(bot.directory);
  if (error) throw new Error(error);
  return state(bot);
}

/** Called once the window exists so bots marked autostart come back up. */
function bootAutostart() {
  for (const bot of bots()) {
    if (!bot.autostart || !bot.tokenRef) continue;
    try {
      start(bot.id);
    } catch {
      /* a bot whose folder disappeared must not block the boot */
    }
  }
}

function stopAll() {
  for (const id of [...running.keys()]) {
    try {
      stop(id);
    } catch {
      /* already gone */
    }
  }
}

module.exports = {
  list,
  create,
  adopt,
  install,
  start,
  stop,
  restart,
  logs,
  setToken,
  configure,
  remove,
  open,
  bootAutostart,
  stopAll,
};
