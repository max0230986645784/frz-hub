const path = require('node:path');
const { app, shell } = require('electron');
const store = require('../lib/store.cjs');
const account = require('./account.cjs');
const { run, launchDetached } = require('../lib/run.cjs');

const API = 'https://api.github.com';
const SCOPES = 'repo read:user gist notifications';

function githubToken() {
  const current = store.get('account');
  if (current?.provider === 'github') return account.reveal(current.token);
  return account.reveal(store.get('githubToken'));
}

function connected() {
  return Boolean(githubToken());
}

async function api(endpoint, options = {}) {
  const token = githubToken();
  if (!token) throw new Error('Connecte-toi a GitHub depuis le profil Velora OS.');
  const response = await fetch(`${API}${endpoint}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'FRZ-HUB',
      ...options.headers,
    },
    signal: AbortSignal.timeout(15000),
  });
  if (response.status === 401) throw new Error('Token GitHub invalide ou expire, reconnecte-toi.');
  if (!response.ok) throw new Error(`GitHub a repondu ${response.status}.`);
  return response.json();
}

/**
 * Device flow: the desktop app shows a code, the user types it on github.com.
 * No client secret is ever stored, which is the supported way for a public app.
 */
async function startDeviceLogin() {
  const clientId = store.get('settings')?.githubClientId;
  if (!clientId) {
    throw new Error(
      "Ajoute ton Client ID GitHub dans Reglages (github.com/settings/developers > New OAuth App, coche 'Enable Device Flow').",
    );
  }
  const response = await fetch('https://github.com/login/device/code', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, scope: SCOPES }),
  });
  if (!response.ok) throw new Error(`GitHub a refuse la demande (${response.status}).`);
  const body = await response.json();
  await shell.openExternal(body.verification_uri);
  return {
    userCode: body.user_code,
    verificationUri: body.verification_uri,
    deviceCode: body.device_code,
    interval: body.interval ?? 5,
    expiresIn: body.expires_in ?? 900,
  };
}

async function pollDeviceLogin({ deviceCode, interval = 5, expiresIn = 900 }) {
  const clientId = store.get('settings')?.githubClientId;
  const deadline = Date.now() + expiresIn * 1000;
  let wait = interval * 1000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, wait));
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    });
    const body = await response.json();
    if (body.access_token) return loginWithToken(body.access_token);
    if (body.error === 'authorization_pending') continue;
    if (body.error === 'slow_down') {
      wait += 5000;
      continue;
    }
    throw new Error(body.error_description || 'Connexion GitHub refusee.');
  }
  throw new Error('Le code GitHub a expire, relance la connexion.');
}

/** Also used when the user pastes a personal access token. */
async function loginWithToken(token) {
  const response = await fetch(`${API}/user`, {
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'User-Agent': 'FRZ-HUB' },
  });
  if (!response.ok) throw new Error('Token GitHub refuse.');
  const profile = await response.json();
  return account.save({
    id: String(profile.id),
    provider: 'github',
    name: profile.name || profile.login,
    handle: profile.login,
    avatar: profile.avatar_url,
    profileUrl: profile.html_url,
    token: account.protect(token),
    createdAt: Date.now(),
  });
}

async function repos({ limit = 30 } = {}) {
  const list = await api(`/user/repos?sort=pushed&per_page=${limit}`);
  return list.map((repo) => ({
    id: repo.id,
    name: repo.name,
    fullName: repo.full_name,
    private: repo.private,
    description: repo.description,
    language: repo.language,
    stars: repo.stargazers_count,
    url: repo.html_url,
    cloneUrl: repo.clone_url,
    pushedAt: repo.pushed_at,
  }));
}

async function activity({ limit = 15 } = {}) {
  const profile = await api('/user');
  const events = await api(`/users/${profile.login}/events?per_page=${limit}`);
  return events.map((event) => ({
    id: event.id,
    type: event.type.replace('Event', ''),
    repo: event.repo?.name,
    at: event.created_at,
    message: event.payload?.commits?.[0]?.message ?? event.payload?.action ?? '',
  }));
}

async function notifications() {
  const list = await api('/notifications?per_page=20');
  return list.map((entry) => ({
    id: entry.id,
    title: entry.subject?.title,
    type: entry.subject?.type,
    repo: entry.repository?.full_name,
    reason: entry.reason,
    at: entry.updated_at,
  }));
}

async function pullRequests() {
  const profile = await api('/user');
  const search = await api(`/search/issues?q=${encodeURIComponent(`is:open is:pr author:${profile.login}`)}&per_page=20`);
  return (search.items ?? []).map((item) => ({
    id: item.id,
    title: item.title,
    url: item.html_url,
    repo: item.repository_url.split('/').slice(-2).join('/'),
    at: item.updated_at,
  }));
}

/** Clones a repo into the projects folder, then opens it in the explorer. */
async function clone(fullName) {
  const root = store.get('settings')?.studioPath || path.join(app.getPath('documents'), 'Velora Studio');
  const target = path.join(root, fullName.split('/').pop());
  const result = await run('git', ['clone', `https://github.com/${fullName}.git`, target], { timeout: 10 * 60 * 1000 });
  if (!result.ok) throw new Error(result.stderr.split('\n').slice(-2).join(' '));
  return { path: target };
}

function openInEditor(target) {
  try {
    launchDetached('code', [target], { shell: true });
    return true;
  } catch {
    shell.openPath(target);
    return true;
  }
}

module.exports = {
  connected,
  startDeviceLogin,
  pollDeviceLogin,
  loginWithToken,
  repos,
  activity,
  notifications,
  pullRequests,
  clone,
  openInEditor,
};
