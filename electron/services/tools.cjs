const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { randomBytes, randomUUID } = require('node:crypto');
const { app, dialog, shell } = require('electron');
const store = require('../lib/store.cjs');
const { IS_WIN, run, powershell, hasBinary } = require('../lib/run.cjs');

const ALPHABET = {
  lower: 'abcdefghijkmnopqrstuvwxyz',
  upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
  digits: '23456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.?',
};

/** Cryptographically sound password, never Math.random. */
function password({ length = 20, upper = true, digits = true, symbols = true } = {}) {
  const pool = [ALPHABET.lower, upper ? ALPHABET.upper : '', digits ? ALPHABET.digits : '', symbols ? ALPHABET.symbols : ''].join('');
  const size = Math.min(128, Math.max(6, Number(length) || 20));
  const bytes = randomBytes(size * 2);
  let out = '';
  for (let index = 0; out.length < size; index += 1) out += pool[bytes[index % bytes.length] % pool.length];
  const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^\w]/].filter((pattern) => pattern.test(out)).length;
  return { value: out, strength: Math.min(100, Math.round((size / 24) * 60 + variety * 10)) };
}

async function ffmpeg() {
  const configured = store.get('settings')?.ffmpegPath;
  if (configured) return configured;
  return (await hasBinary('ffmpeg')) ? 'ffmpeg' : null;
}

async function requireFfmpeg() {
  const binary = await ffmpeg();
  if (!binary) throw new Error("ffmpeg est introuvable. Installe-le puis indique son chemin dans les Reglages.");
  return binary;
}

function outputFor(input, suffix, extension) {
  const directory = path.dirname(input);
  const base = path.basename(input, path.extname(input));
  return path.join(directory, `${base}${suffix}.${extension}`);
}

async function convertVideo({ input, format = 'mp4', quality = 'balanced' }) {
  const binary = await requireFfmpeg();
  const output = outputFor(input, '-frz', format);
  const crf = quality === 'small' ? '30' : quality === 'high' ? '18' : '23';
  const result = await run(binary, ['-y', '-i', input, '-c:v', 'libx264', '-crf', crf, '-preset', 'veryfast', '-c:a', 'aac', output], {
    timeout: 30 * 60 * 1000,
  });
  if (!result.ok) throw new Error(result.stderr.split(/\r?\n/).slice(-3).join(' '));
  return { output };
}

async function cutVideo({ input, start = '00:00:00', end }) {
  const binary = await requireFfmpeg();
  const output = outputFor(input, '-cut', path.extname(input).slice(1) || 'mp4');
  const args = ['-y', '-ss', String(start)];
  if (end) args.push('-to', String(end));
  args.push('-i', input, '-c', 'copy', output);
  const result = await run(binary, args, { timeout: 20 * 60 * 1000 });
  if (!result.ok) throw new Error(result.stderr.split(/\r?\n/).slice(-3).join(' '));
  return { output };
}

async function convertAudio({ input, format = 'mp3', bitrate = '192k' }) {
  const binary = await requireFfmpeg();
  const output = outputFor(input, '-frz', format);
  const result = await run(binary, ['-y', '-i', input, '-vn', '-b:a', bitrate, output], { timeout: 15 * 60 * 1000 });
  if (!result.ok) throw new Error(result.stderr.split(/\r?\n/).slice(-3).join(' '));
  return { output };
}

async function convertImage({ input, format = 'png', width }) {
  const binary = await requireFfmpeg();
  const output = outputFor(input, '-frz', format);
  const args = ['-y', '-i', input];
  if (width) args.push('-vf', `scale=${Number(width)}:-1`);
  args.push(output);
  const result = await run(binary, args, { timeout: 3 * 60 * 1000 });
  if (!result.ok) throw new Error(result.stderr.split(/\r?\n/).slice(-3).join(' '));
  return { output };
}

/** PDF pages to PNG, using pdftoppm when available (poppler) . */
async function pdfToImages({ input, dpi = 150 }) {
  if (!(await hasBinary('pdftoppm'))) throw new Error('pdftoppm (poppler-utils) est requis pour convertir un PDF.');
  const directory = path.join(path.dirname(input), `${path.basename(input, '.pdf')}-pages`);
  await fsp.mkdir(directory, { recursive: true });
  const result = await run('pdftoppm', ['-png', '-r', String(dpi), input, path.join(directory, 'page')], {
    timeout: 10 * 60 * 1000,
  });
  if (!result.ok) throw new Error(result.stderr);
  const files = await fsp.readdir(directory);
  return { output: directory, pages: files.length };
}

async function compress({ inputs, output }) {
  const sources = Array.isArray(inputs) ? inputs : [inputs];
  const archive = output || `${sources[0].replace(/[\\/]$/, '')}.zip`;
  if (IS_WIN) {
    const list = sources.map((entry) => `'${entry.replace(/'/g, "''")}'`).join(',');
    const result = await powershell(`Compress-Archive -Path ${list} -DestinationPath '${archive.replace(/'/g, "''")}' -Force`, {
      timeout: 10 * 60 * 1000,
    });
    if (!result.ok) throw new Error(result.stderr);
  } else {
    const result = await run('zip', ['-r', archive, ...sources.map((entry) => path.basename(entry))], {
      cwd: path.dirname(sources[0]),
      timeout: 10 * 60 * 1000,
    });
    if (!result.ok) throw new Error(result.stderr);
  }
  const stat = await fsp.stat(archive);
  return { output: archive, size: stat.size };
}

async function extract({ input, output }) {
  const destination = output || path.join(path.dirname(input), path.basename(input, path.extname(input)));
  await fsp.mkdir(destination, { recursive: true });
  if (IS_WIN) {
    const result = await powershell(
      `Expand-Archive -Path '${input.replace(/'/g, "''")}' -DestinationPath '${destination.replace(/'/g, "''")}' -Force`,
      { timeout: 10 * 60 * 1000 },
    );
    if (!result.ok) throw new Error(result.stderr);
  } else {
    const result = await run('unzip', ['-o', input, '-d', destination], { timeout: 10 * 60 * 1000 });
    if (!result.ok) throw new Error(result.stderr);
  }
  return { output: destination };
}

function tempTargets() {
  const targets = [os.tmpdir()];
  if (IS_WIN) {
    const windowsTemp = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'Temp');
    targets.push(windowsTemp);
    const prefetch = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'Prefetch');
    targets.push(prefetch);
  } else {
    targets.push(path.join(app.getPath('home'), '.cache'));
  }
  return [...new Set(targets)];
}

/**
 * Measures (dry run) or deletes temporary files. Only files older than an hour
 * are touched so nothing in use disappears.
 */
async function cleanTemp({ dryRun = true } = {}) {
  const cutoff = Date.now() - 60 * 60 * 1000;
  let bytes = 0;
  let files = 0;
  let failures = 0;
  for (const target of tempTargets()) {
    let entries = [];
    try {
      entries = await fsp.readdir(target, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(target, entry.name);
      try {
        const stat = await fsp.stat(full);
        if (stat.mtimeMs > cutoff) continue;
        const size = entry.isDirectory() ? await directorySize(full) : stat.size;
        if (!dryRun) await fsp.rm(full, { recursive: true, force: true });
        bytes += size;
        files += 1;
      } catch {
        failures += 1;
      }
    }
  }
  return { bytes, files, failures, dryRun, targets: tempTargets() };
}

async function directorySize(target, depth = 4) {
  if (depth < 0) return 0;
  let total = 0;
  let entries = [];
  try {
    entries = await fsp.readdir(target, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    const full = path.join(target, entry.name);
    try {
      if (entry.isDirectory()) total += await directorySize(full, depth - 1);
      else total += (await fsp.stat(full)).size;
    } catch {
      /* skip locked file */
    }
  }
  return total;
}

/** Breadth-limited file search, fast enough to feel instant in the UI. */
async function searchFiles({ query, root, limit = 60 }) {
  const needle = String(query || '').toLowerCase();
  if (!needle) return [];
  const start = root || app.getPath('home');
  const results = [];
  const queue = [{ dir: start, depth: 0 }];
  const skip = new Set(['node_modules', '.git', 'AppData', 'Windows', '$Recycle.Bin', 'proc', 'sys']);
  while (queue.length && results.length < limit) {
    const { dir, depth } = queue.shift();
    if (depth > 6) continue;
    let entries = [];
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (skip.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.name.toLowerCase().includes(needle)) {
        let size = 0;
        try {
          size = entry.isFile() ? (await fsp.stat(full)).size : 0;
        } catch {
          /* unreadable */
        }
        results.push({ path: full, name: entry.name, directory: entry.isDirectory(), size });
        if (results.length >= limit) break;
      }
      if (entry.isDirectory()) queue.push({ dir: full, depth: depth + 1 });
    }
  }
  return results;
}

function notes() {
  return store.get('notes') ?? [];
}

function saveNote({ id, title, body }) {
  return store.update((state) => {
    const list = state.notes ?? [];
    const existing = list.find((note) => note.id === id);
    if (existing) {
      Object.assign(existing, { title, body, updatedAt: Date.now() });
      state.notes = list;
      return existing;
    }
    const created = { id: id || randomUUID(), title: title || 'Note', body: body || '', updatedAt: Date.now() };
    state.notes = [created, ...list];
    return created;
  });
}

function deleteNote(id) {
  return store.update((state) => {
    state.notes = (state.notes ?? []).filter((note) => note.id !== id);
    return true;
  });
}

async function pickFile({ directory = false, multi = false, filters } = {}) {
  const properties = [directory ? 'openDirectory' : 'openFile'];
  if (multi) properties.push('multiSelections');
  const result = await dialog.showOpenDialog({ properties, filters });
  if (result.canceled) return null;
  return multi ? result.filePaths : result.filePaths[0];
}

function reveal(target) {
  shell.showItemInFolder(target);
  return true;
}

async function openPath(target) {
  const error = await shell.openPath(target);
  if (error) throw new Error(error);
  return true;
}

module.exports = {
  password,
  convertVideo,
  cutVideo,
  convertAudio,
  convertImage,
  pdfToImages,
  compress,
  extract,
  cleanTemp,
  searchFiles,
  directorySize,
  notes,
  saveNote,
  deleteNote,
  pickFile,
  reveal,
  openPath,
  ffmpeg,
};
