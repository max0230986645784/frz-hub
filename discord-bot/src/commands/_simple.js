import { SlashCommandBuilder } from "discord.js";
import { admin, configReply, getGuild, saveGuild, success } from "./_helpers.js";
export function simple(name, description, options = [], handler, needsAdmin = false) {
  let builder = new SlashCommandBuilder().setName(name).setDescription(description);
  for (const add of options) builder = add(builder);
  if (needsAdmin) builder = admin(builder);
  return { data: builder, execute: handler ?? ((i) => i.reply({ embeds: [success("Action effectuée.")], ephemeral: true })) };
}
export const text = (name, description, required = true) => (builder) => builder.addStringOption((o) => o.setName(name).setDescription(description).setRequired(required));
export const integer = (name, description, required = true) => (builder) => builder.addIntegerOption((o) => o.setName(name).setDescription(description).setRequired(required));
export const user = (name = "membre", description = "Membre concerné") => (builder) => builder.addUserOption((o) => o.setName(name).setDescription(description).setRequired(false));
export const channel = (name, description) => (builder) => builder.addChannelOption((o) => o.setName(name).setDescription(description).setRequired(true));
export const role = (name, description) => (builder) => builder.addRoleOption((o) => o.setName(name).setDescription(description).setRequired(true));
export { configReply, getGuild, saveGuild, success };
