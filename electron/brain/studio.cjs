const fsp = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { app, shell } = require('electron');
const store = require('../lib/store.cjs');
const { normalize, countMatches, contentTokens } = require('./nlp.cjs');
const { BLUEPRINTS, genericProject, slug } = require('./templates.cjs');

const NOISE = new Set([
  'code', 'coder', 'codes', 'fais', 'faire', 'cree', 'creer', 'genere', 'generer', 'construis', 'construire',
  'developpe', 'developper', 'ecris', 'ecrire', 'moi', 'nous', 'petit', 'petite', 'gros', 'grosse', 'nouveau',
  'nouvelle', 'projet', 'programme', 'application', 'app', 'truc', 'stp', 'svp', 'veux', 'voudrais', 'peux',
  'appelle', 'nomme', 'avec', 'pour', 'sur', 'qui', 'dans',
]);

function studioRoot() {
  const configured = store.get('settings')?.studioPath;
  return configured || path.join(app.getPath('documents'), 'Velora Studio');
}

/** Picks the blueprint whose keywords the request hits the most. */
function chooseBlueprint(request) {
  let best = null;
  for (const blueprint of BLUEPRINTS) {
    const score = countMatches(request, blueprint.keywords);
    if (score > 0 && (!best || score > best.score)) best = { blueprint, score };
  }
  return best?.blueprint ?? null;
}

/** Project name: quoted text, "appele X", otherwise the meaningful words. */
function extractName(request, blueprint) {
  const quoted = /["«]([^"»]{2,40})["»]/.exec(request)?.[1];
  if (quoted) return quoted.trim();
  const named = /(?:appel[ée]e?|nomm[ée]e?|qui s'appelle)\s+([\w àâäéèêëîïôöùûüç'-]{2,40})/i.exec(request)?.[1];
  if (named) return named.trim();
  const words = contentTokens(request).filter((token) => !NOISE.has(token));
  const meaningful = words.slice(0, 4).join(' ');
  return meaningful || blueprint?.label || 'Projet FRZ';
}

function extractSections(request) {
  const listed = /(?:avec|sections?|pages?|onglets?)\s+([^.!?]+)/i.exec(request)?.[1];
  if (listed) {
    const parts = listed
      .split(/,| et | \+ /i)
      .map((part) => part.trim())
      .filter((part) => part.length > 2 && part.length < 30);
    if (parts.length >= 2) return parts.map((part) => part[0].toUpperCase() + part.slice(1));
  }
  return ['Accueil', 'Services', 'Contact'];
}

function guessLanguage(request) {
  const text = normalize(request);
  if (/python|\.py\b|pandas|django|flask/.test(text)) return 'python';
  return 'javascript';
}

async function writeProject(directory, files) {
  const written = [];
  for (const [relative, content] of Object.entries(files)) {
    const full = path.join(directory, relative);
    await fsp.mkdir(path.dirname(full), { recursive: true });
    await fsp.writeFile(full, content, 'utf8');
    written.push({ path: full, relative, bytes: Buffer.byteLength(content, 'utf8') });
  }
  return written;
}

async function uniqueDirectory(name) {
  const root = studioRoot();
  await fsp.mkdir(root, { recursive: true });
  const base = path.join(root, slug(name));
  let candidate = base;
  let index = 2;
  while (true) {
    try {
      await fsp.access(candidate);
      candidate = `${base}-${index++}`;
    } catch {
      return candidate;
    }
  }
}

/**
 * Turns a plain sentence into a real project on disk. Unknown requests still
 * produce a scaffold plus a TODO plan, the brain never answers "je ne peux pas".
 */
async function generate(request) {
  const blueprint = chooseBlueprint(request);
  const name = extractName(request, blueprint);
  const title = name[0].toUpperCase() + name.slice(1);
  const description = request.trim();
  const context = {
    name,
    title,
    description,
    request,
    sections: extractSections(request),
    task: description,
    language: guessLanguage(request),
  };
  const built = blueprint ? blueprint.build(context) : genericProject(context);
  const directory = await uniqueDirectory(name);
  const files = await writeProject(directory, built.files);
  const project = {
    id: randomUUID(),
    name: title,
    kind: blueprint?.id ?? 'custom',
    kindLabel: blueprint?.label ?? 'Squelette sur mesure',
    request,
    directory,
    run: built.run,
    files: files.map((file) => file.relative),
    createdAt: Date.now(),
  };
  store.update((state) => {
    state.projects = [project, ...(state.projects ?? [])].slice(0, 50);
    return project;
  });
  return project;
}

function list() {
  return store.get('projects') ?? [];
}

async function open(id) {
  const project = list().find((entry) => entry.id === id);
  if (!project) throw new Error('Projet introuvable.');
  const error = await shell.openPath(project.directory);
  if (error) throw new Error(error);
  return project;
}

async function readFile(id, relative) {
  const project = list().find((entry) => entry.id === id);
  if (!project) throw new Error('Projet introuvable.');
  const full = path.resolve(project.directory, relative);
  if (!full.startsWith(path.resolve(project.directory))) throw new Error('Chemin hors du projet.');
  return { path: full, content: await fsp.readFile(full, 'utf8') };
}

function remove(id) {
  return store.update((state) => {
    state.projects = (state.projects ?? []).filter((entry) => entry.id !== id);
    return true;
  });
}

module.exports = { generate, list, open, readFile, remove, studioRoot, catalogue: BLUEPRINTS.map((entry) => ({ id: entry.id, label: entry.label })) };
