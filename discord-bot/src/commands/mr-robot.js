import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { admin, getGuild, saveGuild, success } from "./_helpers.js";
export const data = new SlashCommandBuilder()
  .setName("mr-robot")
  .setDescription("Le centre de contrôle de Mr. Robot")
  .addSubcommand((s) => s.setName("infos").setDescription("Informations sur le bot"))
  .addSubcommand((s) => s.setName("statut").setDescription("Résumé de ce serveur"))
  .addSubcommand((s) => s.setName("config").setDescription("Voir et modifier les modules"))
  .addSubcommand((s) => s.setName("installation").setDescription("Assistant d'installation"))
  .addSubcommand((s) =>
    s
      .setName("dis")
      .setDescription("Faire répéter Mr. Robot")
      .addStringOption((o) => o.setName("texte").setDescription("Texte").setRequired(true)),
  )
  .addSubcommand((s) => s.setName("blague").setDescription("Raconter une blague"))
  .addSubcommand((s) => s.setName("pile-ou-face").setDescription("Lancer une pièce"))
  .addSubcommand((s) => s.setName("de").setDescription("Lancer un dé"))
  .addSubcommand((s) =>
    s
      .setName("8ball")
      .setDescription("Poser une question")
      .addStringOption((o) => o.setName("question").setDescription("Question").setRequired(true)),
  )
  .addSubcommand((s) =>
    s
      .setName("annonce")
      .setDescription("Publier une annonce")
      .addChannelOption((o) => o.setName("salon").setDescription("Salon").setRequired(true))
      .addStringOption((o) => o.setName("texte").setDescription("Texte").setRequired(true)),
  );
export async function execute(i) {
  const sub = i.options.getSubcommand();
  const e = (title, description) =>
    new EmbedBuilder()
      .setColor(0x7c3aed)
      .setTitle(title)
      .setDescription(description)
      .setFooter({ text: "Mr. Robot" });
  if (sub === "infos")
    return i.reply({
      embeds: [
        e(
          "Mr. Robot",
          `Version 1.0.0\nUptime : ${Math.floor(i.client.uptime / 60_000)} min\nPing : ${i.client.ws.ping} ms\nServeurs : ${i.client.guilds.cache.size}\nCommandes : ${i.client.commands.size}\nSite : https://mr-robot.example\nDashboard : https://mr-robot.example/dashboard`,
        ),
      ],
    });
  if (sub === "statut") {
    const cfg = await getGuild(i.guildId);
    return i.reply({
      embeds: [
        e(
          `Statut · ${i.guild.name}`,
          `Membres : ${i.guild.memberCount}\nEn ligne : ${i.guild.members.cache.filter((m) => m.presence?.status === "online").size}\nBoosts : ${i.guild.premiumSubscriptionCount ?? 0}\nTickets : ${Object.keys(cfg.tickets?.open ?? {}).length}\nAvertissements : ${Object.values(cfg.warns ?? {}).flat().length}\nSalons : ${i.guild.channels.cache.size}\nRôles : ${i.guild.roles.cache.size}`,
        ),
      ],
    });
  }
  if (sub === "config") {
    const cfg = await getGuild(i.guildId);
    const rows = ["welcome", "levels", "automod", "logs", "antiRaid"].map((key) =>
      new ButtonBuilder()
        .setCustomId(`config:toggle:${key}`)
        .setLabel(`${key} : ${cfg[key]?.enabled ? "activé" : "désactivé"}`)
        .setStyle(ButtonStyle.Secondary),
    );
    return i.reply({
      embeds: [
        e("Configuration Mr. Robot", "Cliquez sur un bouton pour activer ou désactiver un module."),
      ],
      components: [new ActionRowBuilder().addComponents(rows)],
    });
  }
  if (sub === "installation")
    return i.reply({
      embeds: [
        e(
          "Assistant d'installation",
          "Lancez `/setup confirmer:true` pour créer les catégories, salons, rôles et configurations recommandées. L'assistant est sans danger : les éléments existants sont conservés.",
        ),
      ],
    });
  if (sub === "dis") return i.reply({ embeds: [e("Mr. Robot dit", i.options.getString("texte"))] });
  if (sub === "blague")
    return i.reply({
      embeds: [
        e(
          "Blague",
          "Pourquoi les développeurs confondent Halloween et Noël ? Parce que OCT 31 = DEC 25.",
        ),
      ],
    });
  if (sub === "pile-ou-face")
    return i.reply({
      embeds: [e("Pile ou face", Math.random() > 0.5 ? "🪙 Pile !" : "🪙 Face !")],
    });
  if (sub === "de")
    return i.reply({
      embeds: [e("Dé", `🎲 Vous avez obtenu **${1 + Math.floor(Math.random() * 6)}**.`)],
    });
  if (sub === "8ball")
    return i.reply({
      embeds: [
        e(
          "Boule magique",
          ["Oui, absolument.", "C'est probable.", "Je ne peux pas le dire.", "Non, désolé."][
            Math.floor(Math.random() * 4)
          ],
        ),
      ],
    });
  const channel = i.options.getChannel("salon");
  if (!channel?.isTextBased()) return i.reply({ content: "Salon invalide.", ephemeral: true });
  await channel.send({ embeds: [e("📢 Annonce", i.options.getString("texte"))] });
  return i.reply({ embeds: [success("Annonce publiée.")], ephemeral: true });
}
