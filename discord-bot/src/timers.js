import { EmbedBuilder } from "discord.js";
import { getGuild, saveGuild } from "./store.js";

const timers = new Map();
function later(key, at, callback) {
  if (timers.has(key)) clearTimeout(timers.get(key));
  const delay = Math.max(0, at - Date.now());
  timers.set(key, setTimeout(async () => { timers.delete(key); await callback(); }, delay));
}
export function scheduleReminder(client, guildId, id, reminder) {
  later(`reminder:${guildId}:${id}`, reminder.at, async () => {
    const user = await client.users.fetch(reminder.user).catch(() => null); await user?.send(`⏰ Rappel : ${reminder.message}`).catch(() => {});
    const cfg = await getGuild(guildId); delete cfg.reminders[id]; await saveGuild(guildId, cfg);
  });
}
export function scheduleGiveaway(client, guildId, id, giveaway) {
  later(`giveaway:${guildId}:${id}`, giveaway.endsAt, async () => {
    const guild = client.guilds.cache.get(guildId); const channel = guild?.channels.cache.get(giveaway.channel); const message = await channel?.messages.fetch(giveaway.message).catch(() => null); const participants = giveaway.participants ?? []; const winners = [...participants].sort(() => Math.random() - 0.5).slice(0, giveaway.winners);
    if (message) await message.edit({ embeds: [new EmbedBuilder().setTitle("🎉 Giveaway terminé").setDescription(`Prix : **${giveaway.prize}**\nGagnant(s) : ${winners.map((x) => `<@${x}>`).join(", ") || "Aucun participant."}`)], components: [] }).catch(() => {});
    const cfg = await getGuild(guildId); delete cfg.giveaways[id]; await saveGuild(guildId, cfg);
  });
}
export function schedulePoll(client, guildId, id, poll) {
  later(`poll:${guildId}:${id}`, poll.endsAt, async () => { const cfg = await getGuild(guildId); delete cfg.polls[id]; await saveGuild(guildId, cfg); });
}
export async function rescheduleTimers(client) {
  for (const guild of client.guilds.cache.values()) { const cfg = await getGuild(guild.id); for (const [id, reminder] of Object.entries(cfg.reminders ?? {})) scheduleReminder(client, guild.id, id, reminder); for (const [id, giveaway] of Object.entries(cfg.giveaways ?? {})) scheduleGiveaway(client, guild.id, id, giveaway); for (const [id, poll] of Object.entries(cfg.polls ?? {})) schedulePoll(client, guild.id, id, poll); }
}
