import { SlashCommandBuilder } from "discord.js";
import { admin, getGuild, saveGuild, success } from "./_helpers.js";
export const data = admin(new SlashCommandBuilder().setName("logs").setDescription("Configurer les journaux").addSubcommand((s) => s.setName("config").setDescription("Définir le salon").addChannelOption((o) => o.setName("salon").setDescription("Salon de logs").setRequired(true))));
export async function execute(i) { const cfg = await getGuild(i.guildId); cfg.logs.channel = i.options.getChannel("salon").id; await saveGuild(i.guildId, cfg); return i.reply({ embeds: [success("Journaux configurés.")], ephemeral: true }); }
