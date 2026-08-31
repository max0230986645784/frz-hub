const { randomBytes } = require('node:crypto');
const qrcode = require('qrcode');
const store = require('../lib/store.cjs');
const account = require('./account.cjs');

const SCOPES = 'user.info.basic,user.info.profile';
const QR_URL = 'https://open.tiktokapis.com/v2/oauth/get_qrcode/';
const CHECK_URL = 'https://open.tiktokapis.com/v2/oauth/check_qrcode/';
const TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';
const USER_URL = 'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,username,avatar_url';

/** The QR flow is stateful : the ticket and the token must survive between the two IPC calls. */
let session = null;

function credentials() {
  const clientKey = store.get('settings')?.tiktokClientKey;
  const clientSecret = account.reveal(store.get('tiktokSecret'));
  if (!clientKey || !clientSecret) {
    throw new Error(
      'Ajoute ton Client Key et ton Client Secret TikTok dans Reglages (developers.tiktok.com > Manage apps > Login Kit).',
    );
  }
  return { clientKey, clientSecret };
}

function configure({ clientKey, clientSecret }) {
  store.update((state) => {
    state.settings.tiktokClientKey = clientKey?.trim() ?? '';
    return state;
  });
  if (clientSecret?.trim()) store.set('tiktokSecret', account.protect(clientSecret.trim()));
  return configured();
}

function configured() {
  return Boolean(store.get('settings')?.tiktokClientKey && store.get('tiktokSecret'));
}

async function form(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });
  const payload = await response.json();
  if (payload.error && payload.error !== 'ok') {
    throw new Error(payload.error_description || `TikTok a refuse la requete (${payload.error}).`);
  }
  return payload;
}

/** Asks TikTok for a QR code and renders it as an image the renderer can display. */
async function start() {
  const { clientKey } = credentials();
  const ticket = randomBytes(16).toString('hex');
  const state = randomBytes(12).toString('hex');
  const payload = await form(QR_URL, { client_key: clientKey, scope: SCOPES, state });
  if (!payload.scan_qrcode_url || !payload.token) throw new Error("TikTok n'a pas renvoye de QR code.");

  const target = payload.scan_qrcode_url.replace('client_ticket=tobefilled', `client_ticket=${ticket}`);
  session = { ticket, state, token: payload.token };
  const image = await qrcode.toDataURL(target, { margin: 1, width: 320, color: { dark: '#0b0b16', light: '#ffffff' } });
  return { status: 'new', image, url: target };
}

/**
 * Polls the QR status. The client_ticket is compared with ours so a tampered
 * response is dropped instead of being exchanged for a token.
 */
async function poll() {
  if (!session) throw new Error('Genere un QR code TikTok avant de verifier.');
  const { clientKey, clientSecret } = credentials();
  const payload = await form(CHECK_URL, {
    client_key: clientKey,
    client_secret: clientSecret,
    token: session.token,
  });

  const status = payload.status ?? 'new';
  if (payload.client_ticket && payload.client_ticket !== session.ticket) {
    session = null;
    throw new Error('Reponse TikTok invalide (ticket different), connexion refusee.');
  }
  if (status === 'expired') {
    session = null;
    return { status: 'expired' };
  }
  if (status !== 'confirmed') return { status };

  const redirect = new URL(payload.redirect_uri);
  const code = redirect.searchParams.get('code');
  if (!code) throw new Error("TikTok n'a pas renvoye de code d'autorisation.");
  redirect.search = '';

  const grant = await form(TOKEN_URL, {
    client_key: clientKey,
    client_secret: clientSecret,
    code: decodeURIComponent(code),
    grant_type: 'authorization_code',
    redirect_uri: redirect.toString(),
  });
  session = null;

  const profile = await (
    await fetch(USER_URL, { headers: { Authorization: `Bearer ${grant.access_token}` } })
  ).json();
  const user = profile.data?.user ?? {};

  return {
    status: 'confirmed',
    account: account.save({
      id: user.open_id || grant.open_id,
      provider: 'tiktok',
      name: user.display_name || user.username || 'TikTok',
      handle: user.username ?? '',
      avatar: user.avatar_url ?? '',
      token: account.protect(grant.access_token),
      createdAt: Date.now(),
    }),
  };
}

module.exports = { configure, configured, start, poll };
