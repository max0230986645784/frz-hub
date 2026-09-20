import { SlashCommandBuilder } from "discord.js";
import { admin, getGuild, saveGuild, success } from "./_helpers.js";
export const data = admin(
  new SlashCommandBuilder()
    .setName("automod")
    .setDescription("Configurer la modération automatique")
    .addSubcommand((s) =>
      s
        .setName("config")
        .setDescription("Activer une protection")
        .addStringOption((o) =>
          o
            .setName("protection")
            .setDescription("Protection")
            .setRequired(true)
            .addChoices(
              { name: "Invitations", value: "invitations" },
              { name: "Liens", value: "links" },
              { name: "Majuscules", value: "capitals" },
              { name: "Mentions masse", value: "massMentions" },
            ),
        )
        .addBooleanOption((o) => o.setName("active").setDescription("Activée").setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName("mot-add")
        .setDescription("Ajouter un mot interdit")
        .addStringOption((o) => o.setName("mot").setDescription("Mot").setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName("mot-remove")
        .setDescription("Retirer un mot interdit")
        .addStringOption((o) => o.setName("mot").setDescription("Mot").setRequired(true)),
    )
    .addSubcommand((s) => s.setName("mots").setDescription("Lister les mots interdits"))
    .addSubcommand((s) =>
      s
        .setName("sanctions")
        .setDescription("Configurer les seuils de sanctions")
        .addIntegerOption((o) =>
          o.setName("avertissements").setDescription("Seuil").setRequired(true),
        ),
    ),
);
export async function execute(i) {
  const cfg = await getGuild(i.guildId);
  const sub = i.options.getSubcommand();
  if (sub === "config")
    cfg.automod[i.options.getString("protection")] = i.options.getBoolean("active");
  if (sub === "mot-add") cfg.automod.forbiddenWords.push(i.options.getString("mot").toLowerCase());
  if (sub === "mot-remove")
    cfg.automod.forbiddenWords = cfg.automod.forbiddenWords.filter(
      (x) => x !== i.options.getString("mot").toLowerCase(),
    );
  await saveGuild(i.guildId, cfg);
  return i.reply({
    content:
      sub === "mots"
        ? cfg.automod.forbiddenWords.join(", ") || "Aucun mot."
        : "Configuration automod enregistrée.",
    ephemeral: true,
  });
}
