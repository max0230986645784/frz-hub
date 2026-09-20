import { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } from "discord.js";
import { admin } from "./_helpers.js";
export const data = admin(
  new SlashCommandBuilder()
    .setName("reaction-role")
    .setDescription("Créer un menu de rôles")
    .addStringOption((o) => o.setName("message").setDescription("Texte").setRequired(true))
    .addRoleOption((o) => o.setName("role-1").setDescription("Rôle 1").setRequired(true))
    .addRoleOption((o) => o.setName("role-2").setDescription("Rôle 2"))
    .addRoleOption((o) => o.setName("role-3").setDescription("Rôle 3"))
    .addRoleOption((o) => o.setName("role-4").setDescription("Rôle 4"))
    .addRoleOption((o) => o.setName("role-5").setDescription("Rôle 5")),
);
export async function execute(i) {
  const roles = ["role-1", "role-2", "role-3", "role-4", "role-5"]
    .map((name) => i.options.getRole(name))
    .filter(Boolean);
  return i.reply({
    content: i.options.getString("message"),
    components: [
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`role-select:${roles.map((role) => role.id).join(",")}`)
          .setPlaceholder("Choisissez vos rôles")
          .addOptions(roles.map((role) => ({ label: role.name, value: role.id })))
          .setMinValues(0)
          .setMaxValues(roles.length),
      ),
    ],
  });
}
