import { SlashCommandBuilder } from "discord.js";
import { admin, success } from "./_helpers.js";
import { getGuild, saveGuild } from "../store.js";
export const data = admin(
  new SlashCommandBuilder()
    .setName("role")
    .setDescription("Gérer les rôles")
    .addSubcommand((s) =>
      s
        .setName("creer")
        .setDescription("Créer un rôle")
        .addStringOption((o) => o.setName("nom").setDescription("Nom").setRequired(true))
        .addStringOption((o) => o.setName("couleur").setDescription("Couleur hexadécimale"))
        .addBooleanOption((o) => o.setName("separe").setDescription("Afficher séparément"))
        .addBooleanOption((o) => o.setName("mentionnable").setDescription("Mentionnable")),
    )
    .addSubcommand((s) =>
      s
        .setName("supprimer")
        .setDescription("Supprimer un rôle")
        .addRoleOption((o) => o.setName("role").setDescription("Rôle").setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName("donner")
        .setDescription("Donner un rôle")
        .addUserOption((o) => o.setName("membre").setDescription("Membre").setRequired(true))
        .addRoleOption((o) => o.setName("role").setDescription("Rôle").setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName("retirer")
        .setDescription("Retirer un rôle")
        .addUserOption((o) => o.setName("membre").setDescription("Membre").setRequired(true))
        .addRoleOption((o) => o.setName("role").setDescription("Rôle").setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName("tous")
        .setDescription("Donner à tous")
        .addRoleOption((o) => o.setName("role").setDescription("Rôle").setRequired(true)),
    )
    .addSubcommand((s) => s.setName("liste").setDescription("Lister les rôles"))
    .addSubcommand((s) =>
      s
        .setName("info")
        .setDescription("Informations d'un rôle")
        .addRoleOption((o) => o.setName("role").setDescription("Rôle").setRequired(true)),
    )
    .addSubcommand((s) =>
      s.setName("presets").setDescription("Créer les rôles streaming standards"),
    )
    .addSubcommand((s) =>
      s
        .setName("auto-mot")
        .setDescription("Configurer un mot-clé automatique")
        .addStringOption((o) => o.setName("mot").setDescription("Mot-clé").setRequired(true))
        .addRoleOption((o) => o.setName("role").setDescription("Rôle").setRequired(true))
        .addChannelOption((o) => o.setName("salon").setDescription("Salon autorisé"))
        .addUserOption((o) => o.setName("membre-autorise").setDescription("Membre autorisé")),
    ),
);
export async function execute(i) {
  const sub = i.options.getSubcommand();
  const role = i.options.getRole("role");
  const member = i.options.getMember("membre");
  if (sub === "creer") {
    const r = await i.guild.roles.create({
      name: i.options.getString("nom"),
      color: i.options.getString("couleur") ?? "Grey",
      hoist: i.options.getBoolean("separe") ?? false,
      mentionable: i.options.getBoolean("mentionnable") ?? false,
    });
    return i.reply({ embeds: [success(`Rôle ${r} créé.`)] });
  }
  if (sub === "supprimer") {
    await role.delete();
    return i.reply({ embeds: [success("Rôle supprimé.")] });
  }
  if (sub === "donner") {
    await member.roles.add(role);
    return i.reply({ embeds: [success("Rôle attribué.")] });
  }
  if (sub === "retirer") {
    await member.roles.remove(role);
    return i.reply({ embeds: [success("Rôle retiré.")] });
  }
  if (sub === "tous") {
    for (const m of i.guild.members.cache.values()) await m.roles.add(role).catch(() => {});
    return i.reply({ embeds: [success("Rôle attribué aux membres disponibles.")] });
  }
  if (sub === "auto-mot") {
    const cfg = await getGuild(i.guildId);
    cfg.roleKeywords ??= [];
    cfg.roleKeywords.push({
      keyword: i.options.getString("mot").toLowerCase(),
      role: role.id,
      channel: i.options.getChannel("salon")?.id,
      user: i.options.getUser("membre-autorise")?.id,
    });
    await saveGuild(i.guildId, cfg);
    return i.reply({ embeds: [success("Mot-clé de rôle configuré.")] });
  }
  if (sub === "info")
    return i.reply(`**${role.name}** — ${role.members.size} membres — ${role.hexColor}`);
  if (sub === "liste")
    return i.reply(
      i.guild.roles.cache
        .filter((r) => r.id !== i.guild.id)
        .map((r) => `${r} (${r.members.size})`)
        .join("\n") || "Aucun rôle.",
    );
  const presets = [
    ["Fondateur", "#ef4444"],
    ["Co-Fondateur", "#f97316"],
    ["Administrateur", "#eab308"],
    ["Modérateur", "#22c55e"],
    ["Support", "#06b6d4"],
    ["Streamer", "#9146ff"],
    ["VIP", "#ec4899"],
    ["Booster", "#f472b6"],
    ["Membre", "#94a3b8"],
  ];
  for (const [name, color] of presets)
    if (!i.guild.roles.cache.find((r) => r.name === name))
      await i.guild.roles.create({ name, color });
  return i.reply({
    embeds: [success("Rôles standards créés (les rôles existants ont été conservés).")],
  });
}
