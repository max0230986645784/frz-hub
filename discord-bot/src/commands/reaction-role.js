import { SlashCommandBuilder, ActionRowBuilder, RoleSelectMenuBuilder } from "discord.js";
import { admin } from "./_helpers.js";
export const data = admin(new SlashCommandBuilder().setName("reaction-role").setDescription("Créer un menu de rôles").addStringOption((o) => o.setName("message").setDescription("Texte").setRequired(true)));
export async function execute(i) { return i.reply({ content: i.options.getString("message"), components: [new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId("role-select").setPlaceholder("Choisissez vos rôles").setMinValues(0).setMaxValues(5))] }); }
