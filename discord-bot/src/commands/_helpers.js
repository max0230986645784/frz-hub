import { EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { getGuild, saveGuild } from "../store.js";
import { error, success, info } from "../utils/embeds.js";
export function reply(interaction, content, ephemeral = true) {
  return interaction.reply({ content, ephemeral });
}
export async function configReply(interaction, section, values) {
  const cfg = await getGuild(interaction.guildId);
  cfg[section] = { ...(cfg[section] ?? {}), ...values };
  await saveGuild(interaction.guildId, cfg);
  return interaction.reply({ embeds: [success("Configuration enregistrée.")], ephemeral: true });
}
export function admin(builder) {
  return builder.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);
}
export function optionText(option, name, description, required = true) {
  return option.setName(name).setDescription(description).setRequired(required);
}
export function mention(id) {
  return id ? `<@${id}>` : "Non configuré";
}
export { EmbedBuilder, PermissionFlagsBits, getGuild, saveGuild, error, success, info };
