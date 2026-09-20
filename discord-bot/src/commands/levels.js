import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { admin, getGuild, saveGuild, success } from "./_helpers.js";
export const data = new SlashCommandBuilder()
  .setName("niveaux")
  .setDescription("Configurer les niveaux et l'XP")
  .addSubcommand((s) =>
    s
      .setName("config")
      .setDescription("Configurer")
      .addBooleanOption((o) => o.setName("activer").setDescription("Activer").setRequired(true))
      .addNumberOption((o) =>
        o.setName("multiplicateur").setDescription("Multiplicateur").setRequired(false),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName("add")
      .setDescription("Ajouter de l'XP")
      .addUserOption((o) => o.setName("membre").setDescription("Membre").setRequired(true))
      .addIntegerOption((o) => o.setName("xp").setDescription("XP").setRequired(true)),
  )
  .addSubcommand((s) =>
    s
      .setName("remove")
      .setDescription("Retirer de l'XP")
      .addUserOption((o) => o.setName("membre").setDescription("Membre").setRequired(true))
      .addIntegerOption((o) => o.setName("xp").setDescription("XP").setRequired(true)),
  )
  .addSubcommand((s) =>
    s
      .setName("reset")
      .setDescription("Réinitialiser l'XP")
      .addUserOption((o) => o.setName("membre").setDescription("Membre").setRequired(true)),
  );
export async function execute(i) {
  const cfg = await getGuild(i.guildId);
  const sub = i.options.getSubcommand();
  if (sub === "config") {
    cfg.levels.enabled = i.options.getBoolean("activer");
    if (i.options.getNumber("multiplicateur"))
      cfg.levels.multiplier = i.options.getNumber("multiplicateur");
  } else {
    const id = i.options.getUser("membre").id;
    cfg.xp ??= {};
    if (sub === "reset") cfg.xp[id] = { xp: 0, level: 0, last: 0 };
    else {
      cfg.xp[id] ??= { xp: 0, level: 0, last: 0 };
      cfg.xp[id].xp = Math.max(
        0,
        cfg.xp[id].xp + (sub === "add" ? i.options.getInteger("xp") : -i.options.getInteger("xp")),
      );
    }
  }
  await saveGuild(i.guildId, cfg);
  return i.reply({ embeds: [success("Configuration XP enregistrée.")], ephemeral: true });
}
