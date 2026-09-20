import { EmbedBuilder } from "discord.js";
export const colors = { primary: 0x7c3aed, success: 0x22c55e, danger: 0xef4444, warning: 0xf59e0b };
export function success(description, title = "Mr. Robot") {
  return new EmbedBuilder().setColor(colors.success).setTitle(title).setDescription(description);
}
export function error(description) {
  return new EmbedBuilder().setColor(colors.danger).setTitle("Erreur").setDescription(description);
}
export function info(description, title = "Mr. Robot") {
  return new EmbedBuilder().setColor(colors.primary).setTitle(title).setDescription(description);
}
export function interpolate(text, member, guild) {
  return text
    .replaceAll("{user}", `<@${member.id}>`)
    .replaceAll("{username}", member.user.username)
    .replaceAll("{server}", guild.name)
    .replaceAll("{membercount}", String(guild.memberCount));
}
