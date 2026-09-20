import { SlashCommandBuilder } from "discord.js";
import { admin, getGuild, saveGuild, success } from "./_helpers.js";
export const data = admin(new SlashCommandBuilder().setName("live-role").setDescription("Rôle automatique des streamers").addSubcommand((s) => s.setName("config").setDescription("Configurer le rôle").addRoleOption((o) => o.setName("role").setDescription("Rôle live").setRequired(true))));
export async function execute(i) { const cfg = await getGuild(i.guildId); cfg.liveRole = i.options.getRole("role").id; await saveGuild(i.guildId, cfg); return i.reply({ embeds: [success("Rôle live configuré.")] }); }
