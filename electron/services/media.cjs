const fsp = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const store = require('../lib/store.cjs');
const { pickFile } = require('./tools.cjs');

const VIDEO = new Set(['.mp4', '.mkv', '.avi', '.mov', '.webm', '.m4v']);
const AUDIO = new Set(['.mp3', '.flac', '.wav', '.m4a', '.ogg', '.opus', '.aac']);
const IMAGE = new Set(['.jpg', '.jpeg', '.png', '.webp']);

const SERIES_PATTERN = /^(?<show>.+?)[\s._-]+[sS](?<season>\d{1,2})[\s._-]?[eE](?<episode>\d{1,3})/;

function cleanTitle(name) {
  return name
    .replace(/\.[a-z0-9]{2,4}$/i, '')
    .replace(/[._]+/g, ' ')
    .replace(/\b(1080p|720p|2160p|4k|x264|x265|hevc|web-?dl|bluray|vostfr|multi|truefrench)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function folders() {
  return store.get('mediaFolders') ?? [];
}

async function addFolder() {
  const picked = await pickFile({ directory: true });
  if (!picked) return null;
  return store.update((state) => {
    const list = state.mediaFolders ?? [];
    if (list.some((entry) => entry.path === picked)) return list;
    list.push({ id: randomUUID(), path: picked });
    state.mediaFolders = list;
    return list;
  });
}

function removeFolder(id) {
  return store.update((state) => {
    state.mediaFolders = (state.mediaFolders ?? []).filter((entry) => entry.id !== id);
    return state.mediaFolders;
  });
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
    else await onFile(full);
  }
}

/**
 * Builds the media library: movies, series grouped by SxxExx, music grouped by
 * folder (used as album), and the poster images sitting next to the files.
 */
async function scan() {
  const movies = [];
  const episodes = [];
  const tracks = [];
  const posters = new Map();

  for (const folder of folders()) {
    await walk(folder.path, 5, async (file) => {
      const extension = path.extname(file).toLowerCase();
      const name = path.basename(file);
      if (IMAGE.has(extension)) {
        posters.set(path.dirname(file), file);
        return;
      }
      let size = 0;
      let modified = 0;
      try {
        const stat = await fsp.stat(file);
        size = stat.size;
        modified = stat.mtimeMs;
      } catch {
        return;
      }
      const base = { id: randomUUID(), path: file, file: name, size, modified, directory: path.dirname(file) };
      if (VIDEO.has(extension)) {
        const match = SERIES_PATTERN.exec(cleanTitle(name));
        if (match?.groups) {
          episodes.push({
            ...base,
            show: cleanTitle(match.groups.show),
            season: Number(match.groups.season),
            episode: Number(match.groups.episode),
            title: cleanTitle(name),
          });
        } else {
          movies.push({ ...base, title: cleanTitle(name) });
        }
      } else if (AUDIO.has(extension)) {
        tracks.push({ ...base, title: cleanTitle(name), album: path.basename(path.dirname(file)) });
      }
    });
  }

  const withPoster = (entry) => ({ ...entry, poster: posters.get(entry.directory) ?? null });
  const shows = new Map();
  for (const episode of episodes) {
    const key = episode.show.toLowerCase();
    if (!shows.has(key)) shows.set(key, { id: randomUUID(), show: episode.show, poster: posters.get(episode.directory) ?? null, episodes: [] });
    shows.get(key).episodes.push(episode);
  }
  for (const show of shows.values()) show.episodes.sort((a, b) => a.season - b.season || a.episode - b.episode);

  const albums = new Map();
  for (const track of tracks.map(withPoster)) {
    if (!albums.has(track.album)) albums.set(track.album, { id: randomUUID(), album: track.album, poster: track.poster, tracks: [] });
    albums.get(track.album).tracks.push(track);
  }

  return {
    movies: movies.map(withPoster).sort((a, b) => a.title.localeCompare(b.title)),
    series: [...shows.values()].sort((a, b) => a.show.localeCompare(b.show)),
    music: [...albums.values()].sort((a, b) => a.album.localeCompare(b.album)),
    counts: { movies: movies.length, episodes: episodes.length, tracks: tracks.length },
  };
}

module.exports = { folders, addFolder, removeFolder, scan };
