import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const dataDir = join(process.cwd(), "data");
const cache = new Map();
const pending = new Map();
const defaults = {
  tickets: { categories: [], counter: 0, transcriptChannel: null, open: {} },
  automod: { invitations: true, links: false, spam: { count: 5, seconds: 8 }, capitals: false, massMentions: true, forbiddenWords: [], ignoredChannels: [], ignoredRoles: [], sanctions: { 3: "mute", 5: "kick" } },
  levels: { enabled: true, cooldown: 60, announcementChannel: null, message: "Bravo {user}, tu passes niveau {level} !", rewards: {}, ignoredChannels: [], multiplier: 1 },
  logs: { channel: null, toggles: {} },
  welcome: { enabled: false, channel: null, message: "Bienvenue {user} sur {server} !", embed: true },
  goodbye: { enabled: false, channel: null, message: "{username} nous quitte. À bientôt !", embed: true },
  autorole: { roles: [] },
  warns: {}, xp: {}, economy: {}, twitch: { channels: [], live: {} }, giveaways: {}, polls: {}, reminders: {}, invites: { cache: {}, counts: {} }, roleKeywords: [], antiRaid: { enabled: false, threshold: 10, window: 10, lockdown: false },
  tempVoice: { generator: null, category: null }
};
function fresh() { return structuredClone(defaults); }
export async function getGuild(id) {
  if (cache.has(id)) return cache.get(id);
  await mkdir(dataDir, { recursive: true });
  try {
    const value = JSON.parse(await readFile(join(dataDir, `${id}.json`), "utf8"));
    const merged = { ...fresh(), ...value };
    cache.set(id, merged);
    return merged;
  } catch {
    const value = fresh();
    cache.set(id, value);
    return value;
  }
}
export async function saveGuild(id, config) {
  cache.set(id, config);
  clearTimeout(pending.get(id));
  pending.set(id, setTimeout(async () => {
    await mkdir(dataDir, { recursive: true });
    await writeFile(join(dataDir, `${id}.json`), JSON.stringify(config, null, 2));
    pending.delete(id);
  }, 250));
  return config;
}
export async function updateGuild(id, patch) {
  const config = await getGuild(id);
  return saveGuild(id, { ...config, ...patch });
}
export { defaults };
