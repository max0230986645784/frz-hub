import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { admin, getGuild, saveGuild, success } from "./_helpers.js";
import { ensurePresetRoles } from "../utils/presets.js";
export const data = admin(
  new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Installer la structure de la communauté films et séries")
    .addBooleanOption((o) =>
      o.setName("confirmer").setDescription("Confirmer la création").setRequired(true),
    ),
);
export async function execute(i) {
  if (!i.options.getBoolean("confirmer"))
    return i.reply({
      content: "Ajoutez `confirmer:true` pour lancer l'installation.",
      ephemeral: true,
    });
  const roles = await ensurePresetRoles(i.guild);
  const founder = roles["👑 Fondateur"];
  const moderator = roles["🛡️ Modérateur"];
  const vip = roles["💎 VIP"];
  const streamer = roles["🎥 Streamer"];
  const everyone = i.guild.roles.everyone.id;
  const publicReadOnly = [
    {
      id: everyone,
      allow: [PermissionFlagsBits.ViewChannel],
      deny: [PermissionFlagsBits.SendMessages],
    },
    { id: i.client.user.id, allow: [PermissionFlagsBits.SendMessages] },
  ];
  const staffOnly = [
    { id: everyone, deny: [PermissionFlagsBits.ViewChannel] },
    { id: founder.id, allow: [PermissionFlagsBits.ViewChannel] },
    { id: moderator.id, allow: [PermissionFlagsBits.ViewChannel] },
  ];
  const created = [];
  const category = async (name, permissionOverwrites) =>
    i.guild.channels.cache.find(
      (channel) => channel.type === ChannelType.GuildCategory && channel.name === name,
    ) ??
    i.guild.channels.create({
      name,
      type: ChannelType.GuildCategory,
      permissionOverwrites,
    });
  const channel = async (parent, name, type = ChannelType.GuildText, permissionOverwrites) => {
    const existing = i.guild.channels.cache.find(
      (item) => item.name === name && item.parentId === parent.id,
    );
    if (existing) return existing;
    created.push(name);
    return i.guild.channels.create({ name, type, parent: parent.id, permissionOverwrites });
  };
  const accueil = await category("📌 Accueil");
  const bienvenue = await channel(accueil, "👋-bienvenue");
  const regles = await channel(accueil, "📜-règles");
  await channel(accueil, "📢-annonces");
  await channel(accueil, "🎬-nouveautés", ChannelType.GuildText, publicReadOnly);
  const boostChannel = await channel(accueil, "🚀-boosts", ChannelType.GuildText, publicReadOnly);
  const communaute = await category("💬 Communauté");
  await channel(communaute, "💬-chat-général");
  await channel(communaute, "🎥-films");
  await channel(communaute, "📺-séries");
  const demandes = await channel(communaute, "📝-demandes");
  await channel(communaute, "⭐-avis-et-notes");
  await channel(communaute, "🤖-commandes");
  const suggestions = await channel(communaute, "💡-suggestions");
  const support = await category("🎫 Support");
  const ticketPanel = await channel(support, "🎫-ouvrir-un-ticket");
  await channel(support, "❓-faq");
  await channel(support, "🐛-bugs");
  const boostCategory = await category("🔒 Boost (VIP)", [
    { id: everyone, deny: [PermissionFlagsBits.ViewChannel] },
    { id: streamer.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: vip.id, allow: [PermissionFlagsBits.ViewChannel] },
    { id: moderator.id, allow: [PermissionFlagsBits.ViewChannel] },
    { id: founder.id, allow: [PermissionFlagsBits.ViewChannel] },
  ]);
  await channel(boostCategory, "💎-vip-chat");
  await channel(boostCategory, "🎁-avantages-boost");
  await channel(boostCategory, "🔊 VIP", ChannelType.GuildVoice);
  const vocaux = await category("🔊 Vocaux");
  await channel(vocaux, "🔊 Général", ChannelType.GuildVoice);
  await channel(vocaux, "🎬 Soirée film", ChannelType.GuildVoice);
  const generator = await channel(vocaux, "➕ Créer un vocal", ChannelType.GuildVoice);
  const staff = await category("🛠️ Staff", staffOnly);
  await channel(staff, "🛠️-staff");
  const logs = await channel(staff, "📋-logs");
  const transcripts = await channel(staff, "📨-transcripts");
  const cfg = await getGuild(i.guildId);
  cfg.logs = { ...cfg.logs, channel: logs.id };
  cfg.tempVoice = { generator: generator.id, category: vocaux.id };
  cfg.autorole = { enabled: true, roles: [streamer.id] };
  cfg.boost = { enabled: true, vipRole: vip.id, channel: boostChannel.id };
  cfg.welcome = {
    ...cfg.welcome,
    enabled: true,
    channel: bienvenue.id,
    message: cfg.welcome?.message ?? "Bienvenue {user} sur {server} !",
  };
  cfg.suggestions = { ...(cfg.suggestions ?? {}), channel: suggestions.id };
  cfg.tickets = {
    ...cfg.tickets,
    categories: [
      {
        name: "Support",
        category: support.id,
        support: moderator.id,
        welcome: "Bonjour, décrivez votre demande à l'équipe support.",
      },
    ],
    transcriptChannel: transcripts.id,
  };
  await saveGuild(i.guildId, cfg);
  if (ticketPanel.lastMessageId === null)
    await ticketPanel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0x7c3aed)
          .setTitle("🎫 Ouvrir un ticket")
          .setDescription("Cliquez sur le bouton pour contacter le support."),
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("ticket:open:Support")
            .setLabel("Ouvrir un ticket")
            .setStyle(ButtonStyle.Primary),
        ),
      ],
    });
  if (regles.lastMessageId === null)
    await regles.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0x7c3aed)
          .setTitle("📜 Règles de la communauté")
          .setDescription(
            "Soyez respectueux, utilisez les bons salons, ne partagez pas de contenu illégal et respectez les droits d'auteur.",
          ),
      ],
    });
  if (demandes.lastMessageId === null)
    await demandes.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0x7c3aed)
          .setTitle("📝 Demander un film ou une série")
          .setDescription(
            "Indiquez le titre, l'année et la plateforme souhaitée dans votre demande.",
          ),
      ],
    });
  return i.reply({
    embeds: [
      success(
        `Installation terminée pour la communauté films et séries.\nCatégories configurées : Accueil, Communauté, Support, Boost (VIP), Vocaux et Staff.\nSalons créés pendant cette exécution : ${created.join(", ") || "aucun"}.\nBienvenue, tickets, logs, transcripts, suggestions, vocaux temporaires, autorole et boosts sont configurés.`,
      ),
    ],
  });
}
