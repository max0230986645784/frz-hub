import { ChannelType, SlashCommandBuilder } from "discord.js";
import { admin, success } from "./_helpers.js";
const kinds = { texte: ChannelType.GuildText, vocal: ChannelType.GuildVoice, annonce: ChannelType.GuildAnnouncement, forum: ChannelType.GuildForum };
export const data = admin(new SlashCommandBuilder().setName("salon").setDescription("Gérer les salons")
  .addSubcommand((s) => s.setName("creer").setDescription("Créer un salon").addStringOption((o) => o.setName("type").setDescription("Type").setRequired(true).addChoices(...Object.keys(kinds).map((name) => ({ name, value: name })))).addStringOption((o) => o.setName("nom").setDescription("Nom").setRequired(true)).addChannelOption((o) => o.setName("categorie").setDescription("Catégorie").setRequired(false)))
  .addSubcommand((s) => s.setName("supprimer").setDescription("Supprimer ce salon"))
  .addSubcommand((s) => s.setName("renommer").setDescription("Renommer ce salon").addStringOption((o) => o.setName("nom").setDescription("Nom").setRequired(true)))
  .addSubcommand((s) => s.setName("verrouiller").setDescription("Verrouiller ce salon"))
  .addSubcommand((s) => s.setName("deverrouiller").setDescription("Déverrouiller ce salon"))
  .addSubcommand((s) => s.setName("slowmode").setDescription("Configurer le mode lent").addIntegerOption((o) => o.setName("secondes").setDescription("Secondes").setRequired(true).setMinValue(0).setMaxValue(21600))));
export async function execute(i) {
  const sub = i.options.getSubcommand();
  if (sub === "creer") { const c = await i.guild.channels.create({ name: i.options.getString("nom"), type: kinds[i.options.getString("type")], parent: i.options.getChannel("categorie")?.id }); return i.reply({ embeds: [success(`Salon ${c} créé.`)] }); }
  if (sub === "supprimer") { await i.channel.delete(); return; }
  if (sub === "renommer") await i.channel.setName(i.options.getString("nom"));
  if (sub === "slowmode") await i.channel.setRateLimitPerUser(i.options.getInteger("secondes"));
  if (sub === "verrouiller" || sub === "deverrouiller") await i.channel.permissionOverwrites.edit(i.guild.roles.everyone, { SendMessages: sub === "deverrouiller" ? null : false });
  return i.reply({ embeds: [success("Modification effectuée.")] });
}
