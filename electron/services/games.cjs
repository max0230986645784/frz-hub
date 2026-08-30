const fsp = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const store = require('../lib/store.cjs');
const { IS_WIN } = require('../lib/run.cjs');
const apps = require('./apps.cjs');

const running = new Map();

function list() {
  return store.get('games') ?? [];
}

function add(entry) {
  return store.update((state) => {
    const created = {
      id: randomUUID(),
      name: entry.name?.trim() || 'Jeu',
      icon: entry.icon || '🎮',
      accent: entry.accent || 'blue',
      kind: 'game',
      platform: entry.platform || 'local',
      target: entry.target || '',
      args: Array.isArray(entry.args) ? entry.args : [],
      cover: entry.cover || '',
      favorite: Boolean(entry.favorite),
      playtime: 0,
      launches: 0,
      lastLaunch: null,
      mods: [],
    };
    state.games = [...(state.games ?? []), created];
    return created;
  });
}

function updateGame(id, patch) {
  return store.update((state) => {
    const target = (state.games ?? []).find((entry) => entry.id === id);
    if (!target) return null;
    Object.assign(target, patch, { id: target.id });
    return target;
  });
}

function remove(id) {
  return store.update((state) => {
    state.games = (state.games ?? []).filter((entry) => entry.id !== id);
    return true;
  });
}

function toggleFavorite(id) {
  const game = list().find((entry) => entry.id === id);
  if (!game) return null;
  return updateGame(id, { favorite: !game.favorite });
}

/**
 * Watches a launched game so its playtime is real: the session closes when the
 * process disappears, which `process.kill(pid, 0)` detects without any native
 * dependency.
 */
function watchSession(game, pid) {
  if (!pid) return;
  const startedAt = Date.now();
  running.set(game.id, { pid, startedAt });
  const timer = setInterval(() => {
    let alive = true;
    try {
      process.kill(pid, 0);
    } catch {
      alive = false;
    }
    if (alive) return;
    clearInterval(timer);
    running.delete(game.id);
    const minutes = Math.round((Date.now() - startedAt) / 60000);
    store.update((state) => {
      const target = (state.games ?? []).find((entry) => entry.id === game.id);
      if (target) {
        target.playtime = (target.playtime ?? 0) + minutes;
        target.lastSession = { startedAt, endedAt: Date.now(), minutes };
      }
      return true;
    });
  }, 30000);
  timer.unref?.();
}

async function launch(id) {
  const game = list().find((entry) => entry.id === id);
  if (!game) throw new Error('Jeu introuvable.');
  const result = await apps.launchTarget(game.target, game.args);
  apps.trackLaunch(game, 'game');
  watchSession(game, result.pid);
  return { ...result, name: game.name };
}

function sessions() {
  return [...running.entries()].map(([id, session]) => ({
    id,
    startedAt: session.startedAt,
    minutes: Math.round((Date.now() - session.startedAt) / 60000),
  }));
}

/** Reads Steam's appmanifest files, the cheapest reliable library scan. */
async function scanSteam() {
  const roots = IS_WIN
    ? ['C:\\Program Files (x86)\\Steam\\steamapps', 'C:\\Program Files\\Steam\\steamapps']
    : [path.join(process.env.HOME ?? '', '.steam/steam/steamapps'), path.join(process.env.HOME ?? '', '.local/share/Steam/steamapps')];
  const libraries = new Set(roots);
  for (const root of roots) {
    try {
      const vdf = await fsp.readFile(path.join(root, 'libraryfolders.vdf'), 'utf8');
      for (const match of vdf.matchAll(/"path"\s+"([^"]+)"/g)) {
        libraries.add(path.join(match[1].replace(/\\\\/g, '\\'), 'steamapps'));
      }
    } catch {
      /* library file absent */
    }
  }
  const games = [];
  for (const library of libraries) {
    let entries = [];
    try {
      entries = await fsp.readdir(library);
    } catch {
      continue;
    }
    for (const entry of entries.filter((file) => /^appmanifest_\d+\.acf$/.test(file))) {
      try {
        const manifest = await fsp.readFile(path.join(library, entry), 'utf8');
        const appid = /"appid"\s+"(\d+)"/.exec(manifest)?.[1];
        const name = /"name"\s+"([^"]+)"/.exec(manifest)?.[1];
        if (appid && name) games.push({ name, platform: 'steam', target: `steam://rungameid/${appid}`, icon: '🎮' });
      } catch {
        /* unreadable manifest */
      }
    }
  }
  return games;
}

/** Epic writes one JSON manifest per installed game. */
async function scanEpic() {
  const root = path.join(process.env.ProgramData ?? 'C:\\ProgramData', 'Epic', 'EpicGamesLauncher', 'Data', 'Manifests');
  let entries = [];
  try {
    entries = await fsp.readdir(root);
  } catch {
    return [];
  }
  const games = [];
  for (const entry of entries.filter((file) => file.endsWith('.item'))) {
    try {
      const manifest = JSON.parse(await fsp.readFile(path.join(root, entry), 'utf8'));
      if (!manifest.DisplayName) continue;
      games.push({
        name: manifest.DisplayName,
        platform: 'epic',
        target:
          manifest.InstallLocation && manifest.LaunchExecutable
            ? path.join(manifest.InstallLocation, manifest.LaunchExecutable)
            : `com.epicgames.launcher://apps/${manifest.AppName}?action=launch&silent=true`,
        icon: '🎮',
      });
    } catch {
      /* unreadable manifest */
    }
  }
  return games;
}

/** Scans every known store and adds the games missing from the library. */
async function scan() {
  const found = [...(await scanSteam()), ...(await scanEpic())];
  const existing = new Set(list().map((game) => game.name.toLowerCase()));
  const added = [];
  for (const game of found) {
    if (existing.has(game.name.toLowerCase())) continue;
    existing.add(game.name.toLowerCase());
    added.push(add(game));
  }
  return { found: found.length, added: added.length, games: list() };
}

module.exports = { list, add, update: updateGame, remove, toggleFavorite, launch, scan, sessions };
