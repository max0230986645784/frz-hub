import { ChannelType, SlashCommandBuilder } from "discord.js";
import { adminPermissions } from "../utils/permissions.js";
import { success as successEmbed } from "./_helpers.js";
export const data = new SlashCommandBuilder()
  .setName("categorie")
  .setDescription("Gérer les catégories")
  .setDefaultMemberPermissions(adminPermissions)
  .addSubcommand((s) =>
    s
      .setName("creer")
      .setDescription("Créer une catégorie")
      .addStringOption((o) => o.setName("nom").setDescription("Nom").setRequired(true)),
  )
  .addSubcommand((s) =>
    s
      .setName("supprimer")
      .setDescription("Supprimer une catégorie")
      .addChannelOption((o) =>
        o
          .setName("categorie")
          .setDescription("Catégorie à supprimer")
          .addChannelTypes(ChannelType.GuildCategory)
          .setRequired(true),
      ),
  );
export async function execute(i) {
  if (i.options.getSubcommand() === "creer") {
    const c = await i.guild.channels.create({
      name: i.options.getString("nom"),
      type: ChannelType.GuildCategory,
    });
    return i.reply({ embeds: [successEmbed(`Catégorie ${c.name} créée.`)] });
  }
  const category = i.options.getChannel("categorie");
  return i.reply({
    content: `Confirmer la suppression de **${category.name}** ?`,
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            custom_id: `categorie:delete:${category.id}`,
            label: "Supprimer",
            style: 4,
          },
        ],
      },
    ],
    ephemeral: true,
  });
}
