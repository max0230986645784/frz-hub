import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getGuild } from "./_helpers.js";
export const data = new SlashCommandBuilder()
  .setName("rank")
  .setDescription("Voir le niveau d'un membre")
  .addUserOption((o) => o.setName("membre").setDescription("Membre").setRequired(false));
export async function execute(i) {
  const cfg = await getGuild(i.guildId);
  const id = i.options.getUser("membre")?.id ?? i.user.id;
  const value = cfg.xp?.[id] ?? { level: 0, xp: 0 };
  return i.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x7c3aed)
        .setTitle("Classement de niveau")
        .setDescription(`<@${id}> — niveau **${value.level ?? 0}**\nXP : **${value.xp ?? 0}**`),
    ],
  });
}
