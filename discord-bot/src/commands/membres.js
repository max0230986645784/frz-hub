import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
export const data = new SlashCommandBuilder()
  .setName("membres")
  .setDescription("Explorer les membres")
  .addSubcommand((s) =>
    s
      .setName("liste")
      .setDescription("Afficher les membres")
      .addStringOption((o) =>
        o
          .setName("filtre")
          .setDescription("Filtre")
          .setRequired(false)
          .addChoices(
            { name: "Tous", value: "tous" },
            { name: "En ligne", value: "en-ligne" },
            { name: "Bots", value: "bots" },
            { name: "Nouveaux", value: "nouveaux" },
          ),
      )
      .addRoleOption((o) => o.setName("role").setDescription("Rôle").setRequired(false)),
  )
  .addSubcommand((s) => s.setName("compter").setDescription("Compter les membres"))
  .addSubcommand((s) =>
    s
      .setName("rechercher")
      .setDescription("Rechercher un membre")
      .addStringOption((o) => o.setName("texte").setDescription("Nom").setRequired(true)),
  );
export async function execute(i) {
  await i.guild.members.fetch();
  const sub = i.options.getSubcommand();
  if (sub === "compter") return i.reply(`👥 ${i.guild.memberCount} membres`);
  let members = [...i.guild.members.cache.values()];
  const q = i.options.getString("texte");
  const role = i.options.getRole("role");
  if (q)
    members = members.filter(
      (m) =>
        m.user.tag.toLowerCase().includes(q.toLowerCase()) ||
        m.displayName.toLowerCase().includes(q.toLowerCase()),
    );
  if (role) members = members.filter((m) => m.roles.cache.has(role.id));
  if (i.options.getString("filtre") === "bots") members = members.filter((m) => m.user.bot);
  const page = members.slice(0, 15);
  return i.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle(`Membres (${members.length})`)
        .setDescription(
          page
            .map(
              (m) =>
                `${m.user.bot ? "🤖" : "👤"} ${m.user.tag} — rejoint le ${m.joinedAt?.toLocaleDateString("fr-FR")}`,
            )
            .join("\n") || "Aucun membre.",
        ),
    ],
    components:
      members.length > 15
        ? [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId("members:next:1")
                .setLabel("▶")
                .setStyle(ButtonStyle.Secondary),
            ),
          ]
        : [],
  });
}
