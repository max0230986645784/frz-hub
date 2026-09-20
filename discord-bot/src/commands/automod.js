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
          o.setName("avertissements").setDescription("Seuil").setRequired(true).setMinValue(1),
        )
        .addStringOption((o) =>
          o
            .setName("action")
            .setDescription("Action")
            .setRequired(true)
            .addChoices(
              { name: "Mute", value: "mute" },
              { name: "Kick", value: "kick" },
              { name: "Ban", value: "ban" },
              { name: "Aucune", value: "aucune" },
            ),
        )
        .addIntegerOption((o) =>
          o.setName("duree-minutes").setDescription("Durée du mute en minutes").setMinValue(1),
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
  if (sub === "sanctions") {
    const threshold = i.options.getInteger("avertissements");
    const action = i.options.getString("action");
    cfg.automod.sanctions ??= {};
    cfg.automod.sanctionDurations ??= {};
    if (action === "aucune") {
      delete cfg.automod.sanctions[threshold];
      delete cfg.automod.sanctionDurations[threshold];
    } else {
      cfg.automod.sanctions[threshold] = action;
      const duration = i.options.getInteger("duree-minutes");
      if (action === "mute" && duration) cfg.automod.sanctionDurations[threshold] = duration;
      else delete cfg.automod.sanctionDurations[threshold];
    }
  }
  await saveGuild(i.guildId, cfg);
  return i.reply({
    content:
      sub === "mots"
        ? cfg.automod.forbiddenWords.join(", ") || "Aucun mot."
        : sub === "sanctions"
          ? `Seuils : ${
              Object.entries(cfg.automod.sanctions ?? {})
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([threshold, action]) => {
                  const duration = cfg.automod.sanctionDurations?.[threshold];
                  return `${threshold} avertissement(s) → ${action}${duration ? ` (${duration} min)` : ""}`;
                })
                .join(", ") || "Aucun seuil."
            }`
          : "Configuration automod enregistrée.",
    ephemeral: true,
  });
}
