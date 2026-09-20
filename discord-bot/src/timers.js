import { EmbedBuilder } from "discord.js";
import { getGuild, saveGuild } from "./store.js";

const timers = new Map();
export function pollPresentation(poll, ended = false) {
  const votes = Object.values(poll.votes ?? {});
  const total = votes.length;
  const lines = poll.options.map((option, index) => {
    const count = votes.filter((vote) => vote === index).length;
    const percent = total ? Math.round((count / total) * 100) : 0;
    return `${index + 1}. ${option} — ${"█".repeat(Math.round(percent / 10)) || "·"} ${percent}% (${count})`;
  });
  return {
    title: ended ? "Sondage terminé" : "Sondage",
    description: `**${poll.question}**\n${lines.join("\n")}`,
  };
}
function later(key, at, callback) {
  if (timers.has(key)) clearTimeout(timers.get(key));
  const delay = Math.max(0, at - Date.now());
  timers.set(
    key,
    setTimeout(async () => {
      timers.delete(key);
      await callback();
    }, delay),
  );
}
export function scheduleReminder(client, guildId, id, reminder) {
  later(`reminder:${guildId}:${id}`, reminder.at, async () => {
    const user = await client.users.fetch(reminder.user).catch(() => null);
    await user?.send(`⏰ Rappel : ${reminder.message}`).catch(() => {});
    const cfg = await getGuild(guildId);
    delete cfg.reminders[id];
    await saveGuild(guildId, cfg);
  });
}
export function scheduleGiveaway(client, guildId, id, giveaway) {
  later(`giveaway:${guildId}:${id}`, giveaway.endsAt, () => finishGiveaway(client, guildId, id));
}
export async function finishGiveaway(client, guildId, id, { reroll = false } = {}) {
  const cfg = await getGuild(guildId);
  const giveaway = cfg.giveaways?.[id];
  if (!giveaway) return null;
  const guild = client.guilds.cache.get(guildId);
  const channel = guild?.channels.cache.get(giveaway.channel);
  const message = await channel?.messages.fetch(giveaway.message).catch(() => null);
  const participants = giveaway.participants ?? [];
  const winners = [...participants].sort(() => Math.random() - 0.5).slice(0, giveaway.winners);
  if (message)
    await message
      .edit({
        embeds: [
          new EmbedBuilder()
            .setTitle(reroll ? "🎉 Nouveau tirage" : "🎉 Giveaway terminé")
            .setDescription(
              `Prix : **${giveaway.prize}**\nGagnant(s) : ${winners.map((x) => `<@${x}>`).join(", ") || "Aucun participant."}`,
            ),
        ],
        components: reroll ? message.components : [],
      })
      .catch(() => {});
  if (!reroll) {
    delete cfg.giveaways[id];
    await saveGuild(guildId, cfg);
  }
  return { giveaway, winners };
}
export function schedulePoll(client, guildId, id, poll) {
  later(`poll:${guildId}:${id}`, poll.endsAt, async () => {
    const guild = client.guilds.cache.get(guildId);
    const channel = guild?.channels.cache.get(poll.channel);
    const message = await channel?.messages.fetch(poll.message).catch(() => null);
    if (message)
      await message
        .edit({
          embeds: [
            new EmbedBuilder()
              .setTitle(pollPresentation(poll, true).title)
              .setDescription(pollPresentation(poll, true).description),
          ],
          components: [],
        })
        .catch(() => {});
    const cfg = await getGuild(guildId);
    delete cfg.polls[id];
    await saveGuild(guildId, cfg);
  });
}
export async function rescheduleTimers(client) {
  for (const guild of client.guilds.cache.values()) {
    const cfg = await getGuild(guild.id);
    for (const [id, reminder] of Object.entries(cfg.reminders ?? {}))
      scheduleReminder(client, guild.id, id, reminder);
    for (const [id, giveaway] of Object.entries(cfg.giveaways ?? {}))
      scheduleGiveaway(client, guild.id, id, giveaway);
    for (const [id, poll] of Object.entries(cfg.polls ?? {}))
      schedulePoll(client, guild.id, id, poll);
  }
}
