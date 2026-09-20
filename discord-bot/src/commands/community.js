import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { admin, getGuild, saveGuild, success } from "./_helpers.js";
export const data = new SlashCommandBuilder()
  .setName("communaute")
  .setDescription("Outils communautaires")
  .addSubcommand((s) =>
    s
      .setName("sondage")
      .setDescription("Créer un sondage")
      .addStringOption((o) => o.setName("question").setDescription("Question").setRequired(true))
      .addStringOption((o) =>
        o.setName("options").setDescription("Options séparées par |").setRequired(true),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName("suggestion")
      .setDescription("Envoyer une suggestion")
      .addStringOption((o) => o.setName("texte").setDescription("Suggestion").setRequired(true)),
  )
  .addSubcommand((s) =>
    s
      .setName("giveaway")
      .setDescription("Créer un giveaway")
      .addStringOption((o) => o.setName("prix").setDescription("Prix").setRequired(true))
      .addIntegerOption((o) =>
        o.setName("minutes").setDescription("Durée en minutes").setRequired(true).setMinValue(1),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName("say")
      .setDescription("Faire parler le bot")
      .addStringOption((o) => o.setName("message").setDescription("Message").setRequired(true)),
  )
  .addSubcommand((s) =>
    s
      .setName("embed")
      .setDescription("Créer un embed")
      .addStringOption((o) => o.setName("titre").setDescription("Titre").setRequired(true))
      .addStringOption((o) =>
        o.setName("description").setDescription("Description").setRequired(true),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName("giveaway-end")
      .setDescription("Terminer un giveaway")
      .addStringOption((o) => o.setName("id").setDescription("Identifiant").setRequired(true)),
  )
  .addSubcommand((s) =>
    s
      .setName("giveaway-reroll")
      .setDescription("Tirer un nouveau gagnant")
      .addStringOption((o) => o.setName("id").setDescription("Identifiant").setRequired(true)),
  );
export async function execute(i) {
  const sub = i.options.getSubcommand();
  if (sub === "giveaway-end" || sub === "giveaway-reroll") {
    const cfg = await getGuild(i.guildId);
    const giveaway = cfg.giveaways?.[i.options.getString("id")];
    if (!giveaway) return i.reply({ content: "Giveaway introuvable.", ephemeral: true });
    const winners = [...(giveaway.participants ?? [])]
      .sort(() => Math.random() - 0.5)
      .slice(0, giveaway.winners);
    if (sub === "giveaway-reroll")
      return i.reply(`Nouveau gagnant : ${winners[0] ? `<@${winners[0]}>` : "aucun"}`);
    delete cfg.giveaways[i.options.getString("id")];
    await saveGuild(i.guildId, cfg);
    return i.reply(
      `Giveaway terminé. Gagnants : ${winners.map((x) => `<@${x}>`).join(", ") || "aucun"}`,
    );
  }
  if (sub === "say") {
    if (!i.member.permissions.has("ManageMessages"))
      return i.reply({ content: "Permission insuffisante.", ephemeral: true });
    await i.channel.send(i.options.getString("message"));
    return i.reply({ content: "Message envoyé.", ephemeral: true });
  }
  if (sub === "sondage") {
    const options = i.options.getString("options").split("|").slice(0, 10);
    const id = crypto.randomUUID();
    const cfg = await getGuild(i.guildId);
    cfg.polls ??= {};
    cfg.polls[id] = {
      channel: i.channelId,
      message: "",
      question: i.options.getString("question"),
      options,
      votes: {},
      endsAt: Date.now() + 7 * 86_400_000,
    };
    const row = new ActionRowBuilder().addComponents(
      options.map((_, n) =>
        new ButtonBuilder()
          .setCustomId(`poll:vote:${id}:${n}`)
          .setLabel(`${n + 1}`)
          .setStyle(ButtonStyle.Primary),
      ),
    );
    const response = await i.reply({
      fetchReply: true,
      embeds: [
        new EmbedBuilder()
          .setTitle("Sondage")
          .setDescription(
            `**${i.options.getString("question")}**\n${options.map((x, n) => `${n + 1}. ${x}`).join("\n")}`,
          ),
      ],
      components: [row],
    });
    cfg.polls[id].message = response.id;
    await saveGuild(i.guildId, cfg);
    return;
  }
  if (sub === "suggestion") {
    const embed = new EmbedBuilder()
      .setTitle("Nouvelle suggestion")
      .setDescription(i.options.getString("texte"))
      .setColor(0x7c3aed)
      .setFooter({ text: "👍 0 · 👎 0 · En attente" });
    const response = await i.reply({
      fetchReply: true,
      embeds: [embed],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("suggestion:up")
            .setLabel("👍")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId("suggestion:down")
            .setLabel("👎")
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId("suggestion:accept")
            .setLabel("Accepter")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId("suggestion:reject")
            .setLabel("Refuser")
            .setStyle(ButtonStyle.Secondary),
        ),
      ],
    });
    const cfg = await getGuild(i.guildId);
    cfg.suggestions ??= {};
    cfg.suggestions[response.id] = { up: [], down: [], status: "En attente" };
    await saveGuild(i.guildId, cfg);
    return;
  }
  if (sub === "giveaway") {
    const id = crypto.randomUUID();
    const cfg = await getGuild(i.guildId);
    cfg.giveaways ??= {};
    const giveaway = {
      channel: i.channelId,
      message: "",
      prize: i.options.getString("prix"),
      winners: 1,
      endsAt: Date.now() + i.options.getInteger("minutes") * 60_000,
      participants: [],
    };
    const response = await i.reply({
      fetchReply: true,
      embeds: [
        new EmbedBuilder()
          .setTitle("🎉 Giveaway")
          .setDescription(
            `Prix : **${giveaway.prize}**\nDurée : ${i.options.getInteger("minutes")} minutes`,
          ),
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`giveaway:join:${id}`)
            .setLabel("Participer")
            .setStyle(ButtonStyle.Primary),
        ),
      ],
    });
    giveaway.message = response.id;
    cfg.giveaways[id] = giveaway;
    await saveGuild(i.guildId, cfg);
    return;
  }
  return i.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle(i.options.getString("titre"))
        .setDescription(i.options.getString("description"))
        .setColor(0x7c3aed),
    ],
  });
}
