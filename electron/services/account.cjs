const http = require('node:http');
const { createHash, randomBytes, randomUUID } = require('node:crypto');
const { safeStorage, shell } = require('electron');
const store = require('../lib/store.cjs');

const DISCORD_SCOPES = 'identify email guilds';
const REDIRECT_PORT = 53682;
const REDIRECT_URI = `http://127.0.0.1:${REDIRECT_PORT}/callback`;

/** Tokens are encrypted with the OS keychain when Electron exposes it. */
function protect(secret) {
  if (!secret) return null;
  if (safeStorage.isEncryptionAvailable()) {
    return { encrypted: true, value: safeStorage.encryptString(secret).toString('base64') };
  }
  return { encrypted: false, value: secret };
}

function reveal(entry) {
  if (!entry) return null;
  if (!entry.encrypted) return entry.value;
  try {
    return safeStorage.decryptString(Buffer.from(entry.value, 'base64'));
  } catch {
    return null;
  }
}

function current() {
  const account = store.get('account');
  if (!account) return null;
  const { token: _token, ...safe } = account;
  return { ...safe, connected: Boolean(account.token) };
}

function token() {
  return reveal(store.get('account')?.token);
}

function save(account) {
  store.set('account', account);
  return current();
}

function loginLocal({ name, avatar }) {
  return save({
    id: randomUUID(),
    provider: 'local',
    name: name?.trim() || 'FRZ',
    avatar: avatar || '',
    createdAt: Date.now(),
  });
}

function logout() {
  store.set('account', null);
  return null;
}

function base64url(buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Waits for the OAuth redirect on a loopback server. Desktop apps are public
 * clients, so the exchange uses PKCE instead of a client secret.
 */
function waitForCode(expectedState, timeout = 180000) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((request, response) => {
      const url = new URL(request.url, REDIRECT_URI);
      if (url.pathname !== '/callback') {
        response.writeHead(404).end();
        return;
      }
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(
        `<!doctype html><html><body style="background:#0b0b16;color:#f4f6ff;font-family:system-ui;display:grid;place-content:center;height:100vh">
         <h2>${code ? 'Connexion Velora OS reussie' : 'Connexion annulee'}</h2>
         <p>Tu peux fermer cet onglet et revenir dans Velora OS.</p></body></html>`,
      );
      server.close();
      clearTimeout(timer);
      if (!code) reject(new Error('Connexion annulee.'));
      else if (state !== expectedState) reject(new Error('Etat OAuth invalide, connexion refusee.'));
      else resolve(code);
    });
    const timer = setTimeout(() => {
      server.close();
      reject(new Error('Delai de connexion depasse.'));
    }, timeout);
    server.on('error', reject);
    server.listen(REDIRECT_PORT, '127.0.0.1');
  });
}

async function loginDiscord() {
  const clientId = store.get('settings')?.discordClientId;
  if (!clientId) {
    throw new Error(
      "Ajoute d'abord ton Client ID Discord dans Reglages (portail Discord Developers > OAuth2, redirect http://127.0.0.1:53682/callback).",
    );
  }
  const verifier = base64url(randomBytes(48));
  const challenge = base64url(createHash('sha256').update(verifier).digest());
  const state = base64url(randomBytes(16));
  const authorize = new URL('https://discord.com/oauth2/authorize');
  authorize.searchParams.set('client_id', clientId);
  authorize.searchParams.set('response_type', 'code');
  authorize.searchParams.set('redirect_uri', REDIRECT_URI);
  authorize.searchParams.set('scope', DISCORD_SCOPES);
  authorize.searchParams.set('code_challenge', challenge);
  authorize.searchParams.set('code_challenge_method', 'S256');
  authorize.searchParams.set('state', state);

  const pending = waitForCode(state);
  await shell.openExternal(authorize.toString());
  const code = await pending;

  const response = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    }),
  });
  if (!response.ok) throw new Error(`Discord a refuse la connexion (${response.status}).`);
  const grant = await response.json();
  const profile = await (
    await fetch('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${grant.access_token}` } })
  ).json();
  return save({
    id: profile.id,
    provider: 'discord',
    name: profile.global_name || profile.username,
    handle: profile.username,
    avatar: profile.avatar ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png` : '',
    token: protect(grant.access_token),
    createdAt: Date.now(),
  });
}

module.exports = { current, token, save, protect, reveal, loginLocal, loginDiscord, logout, REDIRECT_URI };
