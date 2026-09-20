import { getGuild, saveGuild } from "../store.js";

export async function addWarning(guild, member, reason, moderatorId = null) {
  const cfg = await getGuild(guild.id);
  cfg.warns ??= {};
  cfg.warns[member.id] ??= [];
  cfg.warns[member.id].push({
    id: crypto.randomUUID(),
    reason,
    at: Date.now(),
    moderator: moderatorId,
  });
  const count = cfg.warns[member.id].length;
  await saveGuild(guild.id, cfg);
  const sanctions = cfg.automod?.sanctions ?? { 3: "mute", 5: "kick" };
  const action = Object.entries(sanctions)
    .map(([threshold, sanction]) => [Number(threshold), sanction])
    .filter(([threshold]) => count >= threshold)
    .sort(([a], [b]) => b - a)[0]?.[1];
  if (action === "mute") await member.timeout(60 * 60 * 1000, reason).catch(() => {});
  if (action === "kick") await member.kick(reason).catch(() => {});
  if (action === "ban") await member.ban({ reason }).catch(() => {});
  return { count, action };
}
