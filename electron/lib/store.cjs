const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');

const DEFAULTS = {
  settings: {
    theme: 'frz',
    accent: 'violet',
    userName: 'FRZ',
    weather: { city: 'Bruxelles', latitude: 50.8503, longitude: 4.3517 },
    ai: {
      provider: 'local',
      model: '',
      apiKey: '',
      baseUrl: '',
      allowActions: true,
    },
  },
  apps: [],
  games: [],
  notes: [],
  mediaFolders: [],
  devices: [],
  bots: [],
  learned: [],
  history: { launches: [] },
};

let cache = null;
let file = null;

function storeFile() {
  if (!file) file = path.join(app.getPath('userData'), 'velora-os.json');
  return file;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/** Deep merge used so a new default key appears for users with an older file. */
function withDefaults(value, defaults) {
  if (Array.isArray(defaults)) return Array.isArray(value) ? value : clone(defaults);
  if (defaults && typeof defaults === 'object') {
    const out = {};
    const source = value && typeof value === 'object' ? value : {};
    for (const key of new Set([...Object.keys(defaults), ...Object.keys(source)])) {
      out[key] = key in defaults ? withDefaults(source[key], defaults[key]) : source[key];
    }
    return out;
  }
  return value === undefined ? clone(defaults) : value;
}

function read() {
  if (cache) return cache;
  try {
    cache = withDefaults(JSON.parse(fs.readFileSync(storeFile(), 'utf8')), DEFAULTS);
  } catch {
    cache = clone(DEFAULTS);
  }
  return cache;
}

function write(next) {
  cache = next;
  fs.mkdirSync(path.dirname(storeFile()), { recursive: true });
  fs.writeFileSync(storeFile(), JSON.stringify(cache, null, 2), 'utf8');
  return cache;
}

/** Reads, mutates and persists the store in one shot. */
function update(mutator) {
  const state = clone(read());
  const result = mutator(state);
  write(state);
  return result;
}

function get(key) {
  return read()[key];
}

function set(key, value) {
  return update((state) => {
    state[key] = value;
    return state[key];
  });
}

module.exports = { DEFAULTS, get, set, read, update, storeFile };
