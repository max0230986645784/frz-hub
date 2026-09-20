import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
export const data = new SlashCommandBuilder()
  .setName("embed")
  .setDescription("Créer un embed personnalisé")
  .addStringOption((o) => o.setName("titre").setDescription("Titre").setRequired(true))
  .addStringOption((o) => o.setName("description").setDescription("Description").setRequired(true))
  .addStringOption((o) =>
    o.setName("couleur").setDescription("Couleur hexadécimale").setRequired(false),
  )
  .addStringOption((o) => o.setName("image").setDescription("URL de l'image").setRequired(false));
export async function execute(i) {
  const e = new EmbedBuilder()
    .setTitle(i.options.getString("titre"))
    .setDescription(i.options.getString("description"))
    .setColor(i.options.getString("couleur") ?? "#7c3aed");
  if (i.options.getString("image")) e.setImage(i.options.getString("image"));
  return i.reply({ embeds: [e] });
}
