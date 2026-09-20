import { SlashCommandBuilder } from "discord.js";
import { admin, getGuild, saveGuild, error, success } from "./_helpers.js";
import { addWarning } from "../utils/warnings.js";
const target = (o) =>
  o.addUserOption((x) => x.setName("membre").setDescription("Membre concerné").setRequired(true));
export const data = admin(
  new SlashCommandBuilder()
    .setName("moderation")
    .setDescription("Actions de modération")
    .addSubcommand((s) =>
      target(s.setName("ban").setDescription("Bannir un membre")).addStringOption((o) =>
        o.setName("raison").setDescription("Raison").setRequired(false),
      ),
    )
    .addSubcommand((s) => target(s.setName("kick").setDescription("Expulser un membre")))
    .addSubcommand((s) =>
      target(s.setName("mute").setDescription("Mettre un membre en timeout")).addIntegerOption(
        (o) =>
          o.setName("duree").setDescription("Durée en minutes").setRequired(true).setMinValue(1),
      ),
    )
    .addSubcommand((s) => target(s.setName("unmute").setDescription("Retirer le timeout")))
    .addSubcommand((s) =>
      target(s.setName("warn").setDescription("Avertir un membre")).addStringOption((o) =>
        o.setName("raison").setDescription("Raison").setRequired(false),
      ),
    )
    .addSubcommand((s) => target(s.setName("warnings").setDescription("Voir les avertissements")))
    .addSubcommand((s) =>
      s
        .setName("clear")
        .setDescription("Supprimer des messages")
        .addIntegerOption((o) =>
          o
            .setName("nombre")
            .setDescription("Nombre")
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(100),
        ),
    )
    .addSubcommand((s) => s.setName("lock").setDescription("Verrouiller le salon"))
    .addSubcommand((s) => s.setName("unlock").setDescription("Déverrouiller le salon"))
    .addSubcommand((s) =>
      s
        .setName("unban")
        .setDescription("Débannir un membre")
        .addStringOption((o) =>
          o.setName("identifiant").setDescription("Identifiant Discord").setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("unwarn")
        .setDescription("Retirer un avertissement")
        .addUserOption((o) => o.setName("membre").setDescription("Membre").setRequired(true))
        .addStringOption((o) => o.setName("id").setDescription("Identifiant").setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName("purge-liens")
        .setDescription("Supprimer les liens")
        .addIntegerOption((o) =>
          o
            .setName("nombre")
            .setDescription("Messages à analyser")
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(100),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("nuke")
        .setDescription("Recréer ce salon")
        .addBooleanOption((o) =>
          o.setName("confirmer").setDescription("Confirmer").setRequired(true),
        ),
    ),
);
export async function execute(i) {
  const sub = i.options.getSubcommand();
  const user = i.options.getUser("membre");
  const member = user && (await i.guild.members.fetch(user.id).catch(() => null));
  if (sub === "unban") {
    await i.guild.bans.remove(i.options.getString("identifiant"));
    return i.reply({ embeds: [success("Membre débanni.")] });
  }
  if (sub === "unwarn") {
    const cfg = await getGuild(i.guildId);
    cfg.warns[user.id] = (cfg.warns[user.id] ?? []).filter(
      (warning) => warning.id !== i.options.getString("id"),
    );
    await saveGuild(i.guildId, cfg);
    return i.reply({ embeds: [success("Avertissement retiré.")] });
  }
  if (sub === "purge-liens") {
    const messages = await i.channel.messages.fetch({ limit: i.options.getInteger("nombre") });
    const links = messages.filter((m) => /https?:\/\//i.test(m.content));
    await i.channel.bulkDelete(links, true);
    return i.reply({ content: `${links.size} liens supprimés.`, ephemeral: true });
  }
  if (sub === "nuke") {
    if (!i.options.getBoolean("confirmer"))
      return i.reply({ content: "Ajoutez `confirmer:true`.", ephemeral: true });
    const old = i.channel;
    const copy = await old.clone();
    await old.delete();
    return copy.send("Salon recréé par Mr. Robot.");
  }
  if (sub === "ban") {
    await i.guild.members.ban(user, {
      reason: i.options.getString("raison") ?? "Modération Mr. Robot",
    });
    return i.reply({ embeds: [success(`${user.tag} a été banni.`)] });
  }
  if (sub === "kick") {
    await member?.kick("Modération Mr. Robot");
    return i.reply({ embeds: [success(`${user.tag} a été expulsé.`)] });
  }
  if (sub === "mute" || sub === "unmute") {
    await member?.timeout(
      sub === "mute" ? i.options.getInteger("duree") * 60_000 : null,
      "Modération Mr. Robot",
    );
    return i.reply({
      embeds: [success(sub === "mute" ? `${user.tag} est en timeout.` : "Timeout retiré.")],
    });
  }
  if (sub === "clear") {
    const n = i.options.getInteger("nombre");
    await i.channel.bulkDelete(n, true);
    return i.reply({ embeds: [success(`${n} messages supprimés.`)], ephemeral: true });
  }
  if (sub === "lock" || sub === "unlock") {
    await i.channel.permissionOverwrites.edit(i.guild.roles.everyone, {
      SendMessages: sub === "unlock" ? null : false,
    });
    return i.reply({
      embeds: [success(sub === "lock" ? "Salon verrouillé." : "Salon déverrouillé.")],
    });
  }
  if (sub === "warnings") {
    const cfg = await getGuild(i.guildId);
    const list = cfg.warns?.[user.id] ?? [];
    return i.reply({
      content: list.length
        ? list.map((w, n) => `${n + 1}. ${w.reason}`).join("\n")
        : "Aucun avertissement.",
      ephemeral: true,
    });
  }
  if (sub === "warn") {
    const result = await addWarning(
      i.guild,
      member,
      i.options.getString("raison") ?? "Aucune raison",
      i.user.id,
    );
    return i.reply({ embeds: [success(`${user.tag} a reçu un avertissement (${result.count}).`)] });
  }
  return i.reply({ embeds: [error("Action non disponible.")], ephemeral: true });
}
