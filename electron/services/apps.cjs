const fsp = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { app, dialog, shell } = require('electron');
const store = require('../lib/store.cjs');
const { IS_WIN, launchDetached, run } = require('../lib/run.cjs');

/** The FRZ projects the hub knows about, shown even before a path is set. */
const FRZ_PROJECTS = [
  { key: 'frz-repair', name: 'FRZ Repair', icon: '🛠️', accent: 'orange', kind: 'project' },
  { key: 'frz-bot', name: 'FRZ Bot', icon: '🤖', accent: 'blue', kind: 'project' },
  { key: 'streamora', name: 'Streamora', icon: '🎬', accent: 'violet', kind: 'project' },
  { key: 'fox-os', name: 'Fox OS', icon: '🖥️', accent: 'cyan', kind: 'project' },
  { key: 'empire-urbain', name: 'Empire Urbain', icon: '🎮', accent: 'red', kind: 'project' },
  { key: 'minecraft-manager', name: 'Minecraft Manager', icon: '⛏️', accent: 'green', kind: 'project' },
];

function seedProjects(apps) {
  const known = new Set(apps.map((entry) => entry.key));
  const seeded = FRZ_PROJECTS.filter((project) => !known.has(project.key)).map((project) => ({
    id: randomUUID(),
    ...project,
    target: '',
    args: [],
    favorite: true,
    launches: 0,
    lastLaunch: null,
  }));
  return seeded.length ? [...apps, ...seeded] : apps;
}

function list() {
  return store.update((state) => {
    state.apps = seedProjects(state.apps ?? []);
    return state.apps;
  });
}

function add(entry) {
  return store.update((state) => {
    const created = {
      id: randomUUID(),
      name: entry.name?.trim() || path.basename(entry.target || 'Application'),
      icon: entry.icon || '🚀',
      accent: entry.accent || 'violet',
      kind: entry.kind || 'app',
      target: entry.target || '',
      args: Array.isArray(entry.args) ? entry.args : [],
      favorite: Boolean(entry.favorite),
      launches: 0,
      lastLaunch: null,
    };
    state.apps = [...(state.apps ?? []), created];
    return created;
  });
}

function updateApp(id, patch) {
  return store.update((state) => {
    const target = (state.apps ?? []).find((entry) => entry.id === id);
    if (!target) return null;
    Object.assign(target, patch, { id: target.id });
    return target;
  });
}

function remove(id) {
  return store.update((state) => {
    state.apps = (state.apps ?? []).filter((entry) => entry.id !== id);
    return true;
  });
}

/** Remembers a launch so the dashboard can show "recently launched". */
function trackLaunch(entry, kind) {
  store.update((state) => {
    const collection = kind === 'game' ? state.games : state.apps;
    const target = (collection ?? []).find((item) => item.id === entry.id);
    if (target) {
      target.launches = (target.launches ?? 0) + 1;
      target.lastLaunch = Date.now();
    }
    const history = state.history?.launches ?? [];
    state.history = {
      launches: [
        { id: entry.id, name: entry.name, icon: entry.icon, kind, at: Date.now() },
        ...history.filter((item) => item.id !== entry.id),
      ].slice(0, 12),
    };
    return true;
  });
}

/**
 * Starts a target the way its extension expects: shortcuts and documents go
 * through the shell, scripts through their interpreter, binaries directly.
 */
async function launchTarget(target, args = []) {
  if (!target) throw new Error('Aucun chemin defini pour ce raccourci.');
  if (/^https?:\/\//i.test(target) || /^[a-z][a-z0-9+.-]*:\/\//i.test(target)) {
    await shell.openExternal(target);
    return { mode: 'url' };
  }
  const resolved = path.resolve(target);
  await fsp.access(resolved);
  const extension = path.extname(resolved).toLowerCase();
  if (extension === '.lnk' || extension === '.url' || extension === '.desktop') {
    const error = await shell.openPath(resolved);
    if (error) throw new Error(error);
    return { mode: 'shell' };
  }
  if (extension === '.py') {
    const python = IS_WIN ? 'python' : 'python3';
    return { mode: 'python', pid: launchDetached(python, [resolved, ...args], { cwd: path.dirname(resolved) }) };
  }
  if (extension === '.bat' || extension === '.cmd') {
    return { mode: 'batch', pid: launchDetached('cmd.exe', ['/c', resolved, ...args], { cwd: path.dirname(resolved) }) };
  }
  if (extension === '.ps1') {
    return {
      mode: 'powershell',
      pid: launchDetached('powershell.exe', ['-ExecutionPolicy', 'Bypass', '-File', resolved, ...args]),
    };
  }
  if (extension === '.jar') {
    return { mode: 'java', pid: launchDetached('java', ['-jar', resolved, ...args], { cwd: path.dirname(resolved) }) };
  }
  return { mode: 'exec', pid: launchDetached(resolved, args, { cwd: path.dirname(resolved) }) };
}

async function launch(id) {
  const entry = list().find((item) => item.id === id);
  if (!entry) throw new Error('Application introuvable.');
  const result = await launchTarget(entry.target, entry.args);
  trackLaunch(entry, 'app');
  return { ...result, name: entry.name };
}

/** Launch by fuzzy name, the entry point the AI agent uses. */
async function launchByName(query) {
  const needle = String(query || '').toLowerCase().trim();
  const candidates = [...list(), ...(store.get('games') ?? [])];
  const match =
    candidates.find((entry) => entry.name.toLowerCase() === needle) ??
    candidates.find((entry) => entry.name.toLowerCase().includes(needle)) ??
    candidates.find((entry) => needle.includes(entry.name.toLowerCase()));
  if (match) {
    if (!match.target) throw new Error(`"${match.name}" n'a pas encore de chemin, ajoute-le dans le Launcher.`);
    const result = await launchTarget(match.target, match.args);
    trackLaunch(match, match.kind === 'game' ? 'game' : 'app');
    return { ...result, name: match.name };
  }
  // Not in the library: try the OS itself (Discord, Spotify, notepad...).
  if (IS_WIN) {
    const started = await run('cmd.exe', ['/c', 'start', '', needle], { timeout: 8000 });
    if (started.ok) return { mode: 'os', name: needle };
  } else {
    const which = await run('which', [needle]);
    if (which.ok && which.stdout.trim()) {
      return { mode: 'os', name: needle, pid: launchDetached(which.stdout.trim(), []) };
    }
  }
  throw new Error(`Je ne trouve pas "${query}" dans le Launcher ni sur le systeme.`);
}

async function pickTarget() {
  const result = await dialog.showOpenDialog({
    title: 'Choisir un programme',
    properties: ['openFile'],
    filters: IS_WIN
      ? [
          { name: 'Programmes', extensions: ['exe', 'lnk', 'bat', 'cmd', 'ps1', 'py', 'jar'] },
          { name: 'Tous les fichiers', extensions: ['*'] },
        ]
      : [{ name: 'Tous les fichiers', extensions: ['*'] }],
  });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
}

/** Scans the Start Menu (or .desktop files) to propose installed programs. */
async function scanInstalled() {
  const found = [];
  const push = (name, target) => {
    if (!found.some((entry) => entry.name.toLowerCase() === name.toLowerCase())) found.push({ name, target });
  };
  if (IS_WIN) {
    const roots = [
      path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
      path.join(process.env.ProgramData ?? 'C:\\ProgramData', 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
    ];
    for (const root of roots) {
      await walk(root, 4, (file) => {
        if (path.extname(file).toLowerCase() === '.lnk') push(path.basename(file, '.lnk'), file);
      });
    }
  } else {
    for (const root of ['/usr/share/applications', path.join(app.getPath('home'), '.local/share/applications')]) {
      await walk(root, 2, (file) => {
        if (path.extname(file) === '.desktop') push(path.basename(file, '.desktop'), file);
      });
    }
  }
  return found.sort((a, b) => a.name.localeCompare(b.name)).slice(0, 400);
}

async function walk(root, depth, onFile) {
  if (depth < 0) return;
  let entries = [];
  try {
    entries = await fsp.readdir(root, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) await walk(full, depth - 1, onFile);
    else onFile(full);
  }
}

function recentLaunches() {
  return store.get('history')?.launches ?? [];
}

module.exports = {
  FRZ_PROJECTS,
  list,
  add,
  update: updateApp,
  remove,
  launch,
  launchByName,
  launchTarget,
  trackLaunch,
  pickTarget,
  scanInstalled,
  recentLaunches,
  walk,
};
