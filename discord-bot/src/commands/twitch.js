import { SlashCommandBuilder } from "discord.js";
import { admin, getGuild, saveGuild, success } from "./_helpers.js";
export const data = admin(
  new SlashCommandBuilder()
    .setName("twitch")
    .setDescription("Gérer les alertes Twitch")
    .addSubcommand((s) =>
      s
        .setName("add")
        .setDescription("Ajouter une chaîne")
        .addStringOption((o) =>
          o.setName("login").setDescription("Identifiant Twitch").setRequired(true),
        )
        .addChannelOption((o) =>
          o.setName("salon").setDescription("Salon d'alerte").setRequired(true),
        )
        .addStringOption((o) => o.setName("message").setDescription("Message").setRequired(false)),
    )
    .addSubcommand((s) =>
      s
        .setName("remove")
        .setDescription("Supprimer une chaîne")
        .addStringOption((o) =>
          o.setName("login").setDescription("Identifiant Twitch").setRequired(true),
        ),
    )
    .addSubcommand((s) => s.setName("list").setDescription("Lister les chaînes")),
);
export async function execute(i) {
  const cfg = await getGuild(i.guildId);
  cfg.twitch.channels ??= [];
  const sub = i.options.getSubcommand();
  if (sub === "add")
    cfg.twitch.channels.push({
      login: i.options.getString("login"),
      channel: i.options.getChannel("salon").id,
      message: i.options.getString("message") ?? "🔴 {login} est en live !",
    });
  if (sub === "remove")
    cfg.twitch.channels = cfg.twitch.channels.filter(
      (x) => x.login !== i.options.getString("login"),
    );
  await saveGuild(i.guildId, cfg);
  return i.reply({
    content:
      sub === "list"
        ? cfg.twitch.channels.map((x) => x.login).join(", ") || "Aucune chaîne."
        : "Configuration Twitch enregistrée.",
    ephemeral: true,
  });
}
