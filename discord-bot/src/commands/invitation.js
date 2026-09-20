import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import { admin, getGuild, saveGuild, success } from "./_helpers.js";
export const data = new SlashCommandBuilder()
  .setName("invitation")
  .setDescription("Gérer les invitations du serveur")
  .addSubcommand((s) =>
    s
      .setName("creer")
      .setDescription("Créer une invitation")
      .addChannelOption((o) => o.setName("salon").setDescription("Salon").setRequired(false))
      .addIntegerOption((o) =>
        o.setName("duree").setDescription("Durée en secondes").setRequired(false),
      )
      .addIntegerOption((o) =>
        o.setName("utilisations-max").setDescription("Utilisations maximum").setRequired(false),
      )
      .addBooleanOption((o) =>
        o.setName("temporaire").setDescription("Membre temporaire").setRequired(false),
      ),
  )
  .addSubcommand((s) => s.setName("liste").setDescription("Lister les invitations"))
  .addSubcommand((s) =>
    s
      .setName("supprimer")
      .setDescription("Supprimer une invitation")
      .addStringOption((o) => o.setName("code").setDescription("Code").setRequired(true)),
  )
  .addSubcommand((s) => s.setName("lien").setDescription("Afficher le lien personnalisé"))
  .addSubcommand((s) =>
    s
      .setName("config")
      .setDescription("Configurer le lien personnalisé")
      .addStringOption((o) => o.setName("url").setDescription("URL").setRequired(true)),
  )
  .addSubcommand((s) =>
    s
      .setName("compter")
      .setDescription("Compter les invitations")
      .addUserOption((o) => o.setName("membre").setDescription("Inviteur").setRequired(false)),
  );
export async function execute(i) {
  const sub = i.options.getSubcommand();
  const cfg = await getGuild(i.guildId);
  if (sub === "compter") {
    const id = i.options.getUser("membre")?.id;
    const counts = cfg.invites?.counts ?? {};
    return i.reply(
      id
        ? `Invitations utilisées : **${counts[id] ?? 0}**`
        : Object.entries(counts)
            .map(([user, count]) => `<@${user}> : ${count}`)
            .join("\n") || "Aucune invitation utilisée.",
    );
  }
  if (sub === "lien")
    return i.reply(
      cfg.invites?.vanity ?? `https://discord.gg/${i.guild.vanityURLCode ?? "non-configuré"}`,
    );
  if (sub === "config") {
    cfg.invites ??= {};
    cfg.invites.vanity = i.options.getString("url");
    await saveGuild(i.guildId, cfg);
    return i.reply({ embeds: [success("Lien personnalisé enregistré.")] });
  }
  if (sub === "creer") {
    const invite = await (i.options.getChannel("salon") ?? i.channel).createInvite({
      maxAge: i.options.getInteger("duree") ?? 0,
      maxUses: i.options.getInteger("utilisations-max") ?? 0,
      temporary: i.options.getBoolean("temporaire") ?? false,
      unique: true,
    });
    return i.reply({
      content: invite.url,
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel("Copier le lien")
            .setStyle(ButtonStyle.Link)
            .setURL(invite.url),
        ),
      ],
    });
  }
  if (sub === "supprimer") {
    const invite = await i.guild.invites.fetch(i.options.getString("code"));
    await invite.delete();
    return i.reply({ embeds: [success("Invitation supprimée.")] });
  }
  const invites = await i.guild.invites.fetch();
  return i.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle("Invitations")
        .setDescription(
          invites
            .map(
              (x) =>
                `\`${x.code}\` — ${x.inviter?.tag ?? "inconnu"} — ${x.uses}/${x.maxUses || "∞"}`,
            )
            .join("\n") || "Aucune invitation.",
        ),
    ],
  });
}
