const dns = require('node:dns').promises;
const net = require('node:net');
const os = require('node:os');
const { randomUUID } = require('node:crypto');
const store = require('../lib/store.cjs');
const { IS_WIN, run } = require('../lib/run.cjs');

const DOWNLOAD_URL = 'https://speed.cloudflare.com/__down?bytes=';
const UPLOAD_URL = 'https://speed.cloudflare.com/__up';

/** TCP handshake latency, a portable stand-in for ICMP ping. */
function tcpLatency(host, port = 443, timeout = 3000) {
  return new Promise((resolve) => {
    const started = Date.now();
    const socket = new net.Socket();
    const finish = (value) => {
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(timeout);
    socket.once('connect', () => finish(Date.now() - started));
    socket.once('timeout', () => finish(null));
    socket.once('error', () => finish(null));
    socket.connect(port, host);
  });
}

function localInterfaces() {
  const interfaces = os.networkInterfaces();
  const out = [];
  for (const [name, addresses] of Object.entries(interfaces)) {
    for (const address of addresses ?? []) {
      if (address.family !== 'IPv4' || address.internal) continue;
      out.push({ name, address: address.address, mac: address.mac, netmask: address.netmask });
    }
  }
  return out;
}

async function status() {
  const [latency, dnsOk] = await Promise.all([
    tcpLatency('1.1.1.1'),
    dns.resolve4('cloudflare.com').then(() => true).catch(() => false),
  ]);
  const interfaces = localInterfaces();
  return {
    online: latency !== null,
    ping: latency,
    dns: dnsOk,
    interfaces,
    gateway: await gateway(),
    publicIp: latency === null ? null : await publicIp(),
  };
}

async function publicIp() {
  try {
    const response = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(4000) });
    const body = await response.json();
    return body.ip ?? null;
  } catch {
    return null;
  }
}

async function gateway() {
  if (IS_WIN) {
    const result = await run('powershell.exe', [
      '-NoProfile',
      '-Command',
      '(Get-NetRoute -DestinationPrefix "0.0.0.0/0" | Sort-Object RouteMetric | Select-Object -First 1).NextHop',
    ]);
    return result.stdout.trim() || null;
  }
  const result = await run('sh', ['-c', "ip route | awk '/default/ {print $3; exit}'"]);
  return result.stdout.trim() || null;
}

/** Cloudflare based speed test: 20 MB down, 5 MB up, in Mb/s. */
async function speedtest(onProgress = () => {}) {
  const result = { download: null, upload: null, ping: await tcpLatency('1.1.1.1') };
  onProgress({ stage: 'ping', ...result });
  try {
    const bytes = 20 * 1024 * 1024;
    const started = Date.now();
    const response = await fetch(`${DOWNLOAD_URL}${bytes}`, { signal: AbortSignal.timeout(30000) });
    const buffer = await response.arrayBuffer();
    const seconds = (Date.now() - started) / 1000;
    result.download = Math.round(((buffer.byteLength * 8) / seconds / 1e6) * 10) / 10;
  } catch {
    result.download = null;
  }
  onProgress({ stage: 'download', ...result });
  try {
    const payload = Buffer.alloc(5 * 1024 * 1024, 7);
    const started = Date.now();
    await fetch(UPLOAD_URL, { method: 'POST', body: payload, signal: AbortSignal.timeout(30000) });
    const seconds = (Date.now() - started) / 1000;
    result.upload = Math.round(((payload.length * 8) / seconds / 1e6) * 10) / 10;
  } catch {
    result.upload = null;
  }
  onProgress({ stage: 'done', ...result });
  return result;
}

function pingHostCommand(host) {
  return IS_WIN ? run('ping', ['-n', '1', '-w', '900', host], { timeout: 4000 }) : run('ping', ['-c', '1', '-W', '1', host], { timeout: 4000 });
}

async function ping(host) {
  const started = Date.now();
  const result = await pingHostCommand(host);
  const match = /time[=<]\s*([\d.]+)\s*ms/i.exec(result.stdout);
  return {
    host,
    alive: result.ok,
    ms: match ? Number(match[1]) : result.ok ? Date.now() - started : null,
    output: result.stdout.trim().split(/\r?\n/).slice(0, 6).join('\n'),
  };
}

/** Pings the /24 around the machine so the ARP table lists the neighbours. */
async function sweep(base) {
  const targets = [];
  for (let host = 1; host < 255; host += 1) targets.push(`${base}.${host}`);
  const alive = [];
  const workers = 32;
  let cursor = 0;
  await Promise.all(
    Array.from({ length: workers }, async () => {
      while (cursor < targets.length) {
        const address = targets[cursor++];
        const result = await pingHostCommand(address);
        if (result.ok) alive.push(address);
      }
    }),
  );
  return alive;
}

async function arpTable() {
  const result = IS_WIN ? await run('arp', ['-a']) : await run('sh', ['-c', 'ip neigh show || arp -an']);
  const table = new Map();
  for (const line of result.stdout.split(/\r?\n/)) {
    const ip = /(\d{1,3}(?:\.\d{1,3}){3})/.exec(line)?.[1];
    const mac = /([0-9a-f]{2}[:-]){5}[0-9a-f]{2}/i.exec(line)?.[0];
    if (ip && mac && !/^(0{1,3}\.){3}0{1,3}$/.test(ip)) table.set(ip, mac.toLowerCase().replace(/-/g, ':'));
  }
  return table;
}

async function hostnameOf(address) {
  try {
    const names = await dns.reverse(address);
    return names[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Local network map: saved devices keep their FRZ name and are marked
 * online/offline, freshly discovered ones are appended.
 */
async function devices({ deep = true } = {}) {
  const primary = localInterfaces()[0];
  const base = primary ? primary.address.split('.').slice(0, 3).join('.') : null;
  const alive = new Set(base && deep ? await sweep(base) : []);
  if (primary) alive.add(primary.address);
  const table = await arpTable();
  for (const address of table.keys()) if (!base || address.startsWith(`${base}.`)) alive.add(address);

  const saved = store.get('devices') ?? [];
  const merged = [];
  for (const device of saved) {
    merged.push({
      ...device,
      online: alive.has(device.address),
      mac: table.get(device.address) ?? device.mac ?? null,
      lastSeen: alive.has(device.address) ? Date.now() : device.lastSeen ?? null,
    });
  }
  for (const address of alive) {
    if (merged.some((device) => device.address === address)) continue;
    const isSelf = address === primary?.address;
    merged.push({
      id: randomUUID(),
      name: isSelf ? os.hostname().toUpperCase() : (await hostnameOf(address)) ?? address,
      address,
      mac: table.get(address) ?? null,
      icon: isSelf ? '💻' : '📱',
      self: isSelf,
      online: true,
      lastSeen: Date.now(),
    });
  }
  store.set('devices', merged.map(({ online: _online, ...device }) => device));
  return merged.sort((a, b) => Number(b.online) - Number(a.online) || a.address.localeCompare(b.address));
}

function renameDevice(id, name) {
  return store.update((state) => {
    const device = (state.devices ?? []).find((entry) => entry.id === id);
    if (device) device.name = name;
    return device ?? null;
  });
}

function forgetDevice(id) {
  return store.update((state) => {
    state.devices = (state.devices ?? []).filter((entry) => entry.id !== id);
    return true;
  });
}

module.exports = { status, speedtest, ping, devices, renameDevice, forgetDevice, localInterfaces };
