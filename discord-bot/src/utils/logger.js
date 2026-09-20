import { EmbedBuilder } from "discord.js";
import { getGuild } from "../store.js";

export async function logEvent(guild, type, description, details = {}) {
  const cfg = await getGuild(guild.id);
  if (!cfg.logs?.channel || cfg.logs.toggles?.[type] === false) return;
  const channel = guild.channels.cache.get(cfg.logs.channel);
  if (!channel?.isTextBased()) return;
  const embed = new EmbedBuilder()
    .setColor(0x7c3aed)
    .setTitle(`Journal · ${type}`)
    .setDescription(description)
    .setTimestamp();
  if (Object.keys(details).length)
    embed.addFields(
      Object.entries(details).map(([name, value]) => ({
        name,
        value: String(value).slice(0, 1024),
        inline: true,
      })),
    );
  await channel.send({ embeds: [embed] }).catch(() => {});
}
