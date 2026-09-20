import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} from "discord.js";
import { admin, configReply, getGuild, saveGuild, success } from "./_helpers.js";
export const data = admin(
  new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Gérer le système de tickets")
    .addSubcommand((s) => s.setName("panel").setDescription("Publier le panneau de tickets"))
    .addSubcommand((s) =>
      s
        .setName("config")
        .setDescription("Configurer une catégorie de tickets")
        .addStringOption((o) =>
          o.setName("nom").setDescription("Nom de la catégorie").setRequired(true),
        )
        .addChannelOption((o) =>
          o.setName("categorie").setDescription("Catégorie de salon").setRequired(true),
        )
        .addRoleOption((o) => o.setName("support").setDescription("Rôle support").setRequired(true))
        .addChannelOption((o) =>
          o.setName("transcripts").setDescription("Salon des transcripts").setRequired(false),
        )
        .addStringOption((o) =>
          o.setName("accueil").setDescription("Message d'accueil").setRequired(false),
        ),
    )
    .addSubcommand((s) => s.setName("close").setDescription("Fermer le ticket actuel"))
    .addSubcommand((s) =>
      s
        .setName("rename")
        .setDescription("Renommer le ticket")
        .addStringOption((o) => o.setName("nom").setDescription("Nouveau nom").setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName("add")
        .setDescription("Ajouter un membre")
        .addUserOption((o) => o.setName("membre").setDescription("Membre").setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName("remove")
        .setDescription("Retirer un membre")
        .addUserOption((o) => o.setName("membre").setDescription("Membre").setRequired(true)),
    ),
);
export async function execute(i) {
  const sub = i.options.getSubcommand();
  if (sub === "panel") {
    const cfg = await getGuild(i.guildId);
    const categories = cfg.tickets.categories ?? [];
    if (categories.length > 1)
      return i.reply({
        content: "Choisissez la catégorie de votre demande.",
        components: [
          new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId("ticket:select")
              .setPlaceholder("Catégorie du ticket")
              .addOptions(
                categories
                  .slice(0, 25)
                  .map((category) => ({ label: category.name, value: category.name })),
              ),
          ),
        ],
      });
    return i.reply({
      content: "Cliquez sur le bouton pour ouvrir un ticket.",
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`ticket:open:${categories[0]?.name ?? "default"}`)
            .setLabel("Ouvrir un ticket")
            .setStyle(ButtonStyle.Primary),
        ),
      ],
    });
  }
  if (sub === "config") {
    const cfg = await getGuild(i.guildId);
    cfg.tickets.categories ??= [];
    cfg.tickets.categories.push({
      name: i.options.getString("nom"),
      category: i.options.getChannel("categorie").id,
      support: i.options.getRole("support").id,
      welcome: i.options.getString("accueil") ?? "Bonjour, un membre du support arrive bientôt.",
    });
    if (i.options.getChannel("transcripts"))
      cfg.tickets.transcriptChannel = i.options.getChannel("transcripts").id;
    await saveGuild(i.guildId, cfg);
    return i.reply({ embeds: [success("Catégorie de ticket enregistrée.")], ephemeral: true });
  }
  if (!i.channel.name.startsWith("ticket-"))
    return i.reply({ content: "Cette action doit être utilisée dans un ticket.", ephemeral: true });
  if (sub === "rename")
    return i.channel
      .setName(
        `ticket-${i.options
          .getString("nom")
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, "-")}`,
      )
      .then(() => i.reply({ content: "Ticket renommé.", ephemeral: true }));
  if (sub === "add")
    return i.channel.permissionOverwrites
      .edit(i.options.getUser("membre").id, { ViewChannel: true, SendMessages: true })
      .then(() => i.reply({ content: "Membre ajouté.", ephemeral: true }));
  if (sub === "remove")
    return i.channel.permissionOverwrites
      .delete(i.options.getUser("membre").id)
      .then(() => i.reply({ content: "Membre retiré.", ephemeral: true }));
  if (sub === "close")
    return i.reply({
      content: "Confirmez la fermeture du ticket ?",
      components: [
        {
          type: 1,
          components: [
            { type: 2, custom_id: "ticket:close:confirm", label: "Confirmer", style: 4 },
          ],
        },
      ],
      ephemeral: true,
    });
  return i.reply({ content: "Action indisponible.", ephemeral: true });
}
