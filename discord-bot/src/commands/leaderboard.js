import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getGuild } from "./_helpers.js";
export const data = new SlashCommandBuilder()
  .setName("leaderboard")
  .setDescription("Voir le classement des niveaux");
export async function execute(i) {
  const cfg = await getGuild(i.guildId);
  const rows = Object.entries(cfg.xp ?? {})
    .sort((a, b) => (b[1].level ?? 0) - (a[1].level ?? 0))
    .slice(0, 10);
  return i.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle("🏆 Classement XP")
        .setDescription(
          rows.map(([id, x], n) => `${n + 1}. <@${id}> — niveau ${x.level ?? 0}`).join("\n") ||
            "Aucune donnée.",
        ),
    ],
  });
}
