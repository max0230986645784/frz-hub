const path = require('node:path');
const { spawn } = require('node:child_process');
const { app, BrowserWindow, dialog } = require('electron');
const { run } = require('../lib/run.cjs');
const tools = require('./tools.cjs');

let job = null;

async function binary() {
  const found = await tools.ffmpeg();
  if (!found) throw new Error("ffmpeg est introuvable. Installe-le puis indique son chemin dans les Reglages.");
  return found;
}

function broadcast(channel, payload) {
  for (const window of BrowserWindow.getAllWindows()) window.webContents.send(channel, payload);
}

function seconds(value) {
  const parts = String(value ?? '').split(':').map(Number);
  if (parts.some(Number.isNaN)) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

/** Reads duration/size from ffmpeg's own probe output, no ffprobe needed. */
async function probe(input) {
  const result = await run(await binary(), ['-hide_banner', '-i', input], { timeout: 60_000 });
  const text = `${result.stdout}${result.stderr}`;
  const duration = text.match(/Duration:\s*(\d+:\d+:\d+\.\d+)/);
  const size = text.match(/,\s*(\d{2,5})x(\d{2,5})/);
  return {
    path: input,
    name: path.basename(input),
    duration: duration ? seconds(duration[1]) : 0,
    width: size ? Number(size[1]) : 0,
    height: size ? Number(size[2]) : 0,
  };
}

async function pickClips() {
  const picked = await dialog.showOpenDialog({
    title: 'Choisir des clips',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Video', extensions: ['mp4', 'mkv', 'mov', 'avi', 'webm', 'm4v'] }],
  });
  if (picked.canceled) return [];
  return Promise.all(picked.filePaths.map(probe));
}

async function pickMusic() {
  const picked = await dialog.showOpenDialog({
    title: 'Choisir une musique',
    properties: ['openFile'],
    filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg'] }],
  });
  return picked.canceled ? null : picked.filePaths[0];
}

/**
 * Every clip is trimmed then rescaled to the same canvas before concat, so
 * mixing phone videos with game captures never breaks the export.
 */
function timeline(clips, { width, height }) {
  const filters = [];
  const labels = [];
  clips.forEach((clip, index) => {
    const from = seconds(clip.start ?? 0);
    const to = clip.end ? seconds(clip.end) : null;
    const trim = to ? `trim=start=${from}:end=${to}` : `trim=start=${from}`;
    filters.push(
      `[${index}:v]${trim},setpts=PTS-STARTPTS,scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
        `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v${index}]`,
    );
    filters.push(
      `[${index}:a]a${trim},asetpts=PTS-STARTPTS,aresample=async=1:first_pts=0,aformat=sample_rates=48000:channel_layouts=stereo[a${index}]`,
    );
    labels.push(`[v${index}][a${index}]`);
  });
  filters.push(`${labels.join('')}concat=n=${clips.length}:v=1:a=1[vout][acat]`);
  return filters;
}

/** Renders the montage; progress is streamed to the UI as a percentage. */
async function render({ clips, music, musicVolume = 0.3, keepOriginalAudio = true, resolution = '1080p', output }) {
  if (job) throw new Error('Un montage est deja en cours.');
  if (!clips?.length) throw new Error('Ajoute au moins un clip.');

  const size = resolution === '720p' ? { width: 1280, height: 720 } : { width: 1920, height: 1080 };
  const target =
    output ||
    path.join(app.getPath('videos'), `velora-montage-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')}.mp4`);

  const filters = timeline(clips, size);
  const args = ['-y'];
  for (const clip of clips) args.push('-i', clip.path);
  if (music) args.push('-i', music);

  if (music) {
    const index = clips.length;
    filters.push(`[${index}:a]volume=${musicVolume}[music]`);
    if (keepOriginalAudio) filters.push('[acat][music]amix=inputs=2:duration=first:dropout_transition=0[aout]');
    else filters.push('[music]atrim=start=0,asetpts=PTS-STARTPTS[aout]');
  } else {
    filters.push('[acat]anull[aout]');
  }

  args.push(
    '-filter_complex', filters.join(';'),
    '-map', '[vout]',
    '-map', '[aout]',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
    '-c:a', 'aac', '-b:a', '192k',
    '-shortest',
    target,
  );

  const total = clips.reduce((sum, clip) => {
    const from = seconds(clip.start ?? 0);
    const to = clip.end ? seconds(clip.end) : clip.duration || 0;
    return sum + Math.max(0, to - from);
  }, 0);

  const child = spawn(await binary(), args, { windowsHide: true });
  job = { child, target };
  let tail = '';

  child.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    tail = `${tail}${text}`.slice(-2000);
    const time = text.match(/time=(\d+:\d+:\d+\.\d+)/);
    if (time && total > 0) {
      broadcast('editor:progress', { percent: Math.min(99, Math.round((seconds(time[1]) / total) * 100)) });
    }
  });

  return new Promise((resolve, reject) => {
    child.on('error', (error) => {
      job = null;
      reject(error);
    });
    child.on('close', (code) => {
      job = null;
      if (code !== 0) {
        broadcast('editor:progress', { percent: 0 });
        return reject(new Error(tail.split(/\r?\n/).filter(Boolean).slice(-3).join(' ') || 'Le montage a echoue.'));
      }
      broadcast('editor:progress', { percent: 100 });
      resolve({ output: target });
    });
  });
}

function cancel() {
  if (!job) return false;
  job.child.kill('SIGKILL');
  job = null;
  broadcast('editor:progress', { percent: 0 });
  return true;
}

module.exports = { probe, pickClips, pickMusic, render, cancel };
