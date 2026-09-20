import "dotenv/config";
import { Client, Collection, GatewayIntentBits, Partials, PermissionFlagsBits } from "discord.js";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { startApi } from "./api.js";
import { getGuild, saveGuild } from "./store.js";
import { buildTranscript } from "./utils/transcript.js";
import { logEvent } from "./utils/logger.js";
import { startTwitchPoller } from "./utils/twitch.js";
import { rescheduleTimers } from "./timers.js";

export async function loadCommands() {
  const dir = join(fileURLToPath(new URL(".", import.meta.url)), "commands");
  const files = (await readdir(dir)).filter((file) => file.endsWith(".js") && !file.startsWith("_"));
  return Promise.all(files.map((file) => import(pathToFileURL(join(dir, file)))));
}
async function syncInvites(guild) {
  const cfg = await getGuild(guild.id); const invites = await guild.invites.fetch().catch(() => new Map());
  cfg.invites ??= { cache: {}, counts: {} }; cfg.invites.cache = Object.fromEntries(invites.map((invite) => [invite.code, { uses: invite.uses ?? 0, inviter: invite.inviter?.id }])); await saveGuild(guild.id, cfg);
}
async function createTicket(interaction, categoryName = "default") {
  const cfg = await getGuild(interaction.guildId); const category = cfg.tickets?.categories?.find((item) => item.name === categoryName) ?? cfg.tickets?.categories?.[0];
  const channel = await interaction.guild.channels.create({ name: `ticket-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, "-"), parent: category?.category, permissionOverwrites: [{ id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] }, { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }, ...(category?.support ? [{ id: category.support, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }] : [])] });
  cfg.tickets.counter = (cfg.tickets.counter ?? 0) + 1; cfg.tickets.open ??= {}; cfg.tickets.open[channel.id] = { opener: interaction.user.id, claimedBy: null, category: categoryName }; await saveGuild(interaction.guildId, cfg);
  await channel.send({ content: category?.welcome ?? "Bonjour, un membre du support arrive bientôt.", components: [{ type: 1, components: [{ type: 2, custom_id: "ticket:claim", label: "Réclamer", style: 1 }, { type: 2, custom_id: "ticket:add", label: "Ajouter membre", style: 2 }, { type: 2, custom_id: "ticket:close", label: "Fermer", style: 4 }] }] });
  return channel;
}
async function closeTicket(interaction) {
  const cfg = await getGuild(interaction.guildId); const ticket = cfg.tickets?.open?.[interaction.channelId]; if (!ticket) return interaction.reply({ content: "Ce salon n'est pas un ticket.", ephemeral: true });
  const transcript = await buildTranscript(interaction.channel); const files = [{ attachment: transcript.html, name: "transcript.html" }, { attachment: transcript.text, name: "transcript.txt" }];
  const transcriptChannel = cfg.tickets.transcriptChannel && interaction.guild.channels.cache.get(cfg.tickets.transcriptChannel); if (transcriptChannel?.isTextBased()) await transcriptChannel.send({ content: `Transcript de ${interaction.channel.name}`, files }).catch(() => {});
  const opener = await interaction.client.users.fetch(ticket.opener).catch(() => null); await opener?.send({ content: `Votre ticket ${interaction.channel.name} est fermé.`, files }).catch(() => {});
  delete cfg.tickets.open[interaction.channelId]; await saveGuild(interaction.guildId, cfg); await interaction.update({ content: "Ticket fermé, transcript archivé.", components: [] }).catch(() => {}); await interaction.channel.delete().catch(() => {});
}
export async function createClient() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildPresences], partials: [Partials.Channel, Partials.Message] });
  client.commands = new Collection(); for (const command of await loadCommands()) client.commands.set(command.data.name, command);
  client.once("ready", async () => { console.log(`Connecté en tant que ${client.user.tag}`); for (const guild of client.guilds.cache.values()) await syncInvites(guild); await rescheduleTimers(client); startTwitchPoller(client); startApi(client); });
  client.on("inviteCreate", async (invite) => { await syncInvites(invite.guild); await logEvent(invite.guild, "invitation", `Invitation créée : ${invite.code}`); });
  client.on("inviteDelete", async (invite) => { await syncInvites(invite.guild); await logEvent(invite.guild, "invitation", `Invitation supprimée : ${invite.code}`); });
  client.on("interactionCreate", async (interaction) => {
    try {
      if (interaction.isChatInputCommand()) return await client.commands.get(interaction.commandName)?.execute(interaction);
      if (interaction.isStringSelectMenu() && interaction.customId === "ticket:select") return interaction.reply({ content: `Ticket créé : ${await createTicket(interaction, interaction.values[0])}`, ephemeral: true });
      if (interaction.isButton() && interaction.customId.startsWith("ticket:")) {
        if (interaction.customId.startsWith("ticket:open:")) return interaction.reply({ content: `Ticket créé : ${await createTicket(interaction, interaction.customId.slice("ticket:open:".length))}`, ephemeral: true });
        const cfg = await getGuild(interaction.guildId); const ticket = cfg.tickets?.open?.[interaction.channelId]; if (!ticket) return interaction.reply({ content: "Ticket introuvable.", ephemeral: true });
        if (interaction.customId === "ticket:claim") { ticket.claimedBy = interaction.user.id; await saveGuild(interaction.guildId, cfg); return interaction.reply(`Ticket réclamé par ${interaction.user}.`); }
        if (interaction.customId === "ticket:add") return interaction.reply({ content: "Utilisez `/ticket add` pour ajouter un membre.", ephemeral: true });
        if (interaction.customId === "ticket:close") return interaction.reply({ content: "Confirmez la fermeture ?", components: [{ type: 1, components: [{ type: 2, custom_id: "ticket:close:confirm", label: "Confirmer", style: 4 }] }], ephemeral: true });
        if (interaction.customId === "ticket:close:confirm") return closeTicket(interaction);
      }
      if (interaction.isButton() && interaction.customId.startsWith("giveaway:join:")) { const id = interaction.customId.split(":")[2]; const cfg = await getGuild(interaction.guildId); const giveaway = cfg.giveaways?.[id]; if (giveaway && !giveaway.participants.includes(interaction.user.id)) { giveaway.participants.push(interaction.user.id); await saveGuild(interaction.guildId, cfg); } return interaction.reply({ content: "Participation enregistrée !", ephemeral: true }); }
      if (interaction.isButton() && interaction.customId.startsWith("poll:vote:")) { const [, , id, index] = interaction.customId.split(":"); const cfg = await getGuild(interaction.guildId); const poll = cfg.polls?.[id]; if (!poll) return interaction.reply({ content: "Sondage terminé.", ephemeral: true }); poll.votes[interaction.user.id] = Number(index); await saveGuild(interaction.guildId, cfg); return interaction.reply({ content: `Vote enregistré pour l'option ${Number(index) + 1}.`, ephemeral: true }); }
      if (interaction.isButton() && interaction.customId.startsWith("config:toggle:")) { const section = interaction.customId.split(":")[2]; const cfg = await getGuild(interaction.guildId); cfg[section] ??= {}; cfg[section].enabled = !cfg[section].enabled; await saveGuild(interaction.guildId, cfg); return interaction.update({ content: `${section} : ${cfg[section].enabled ? "activé" : "désactivé"}`, embeds: [], components: [] }); }
      if (interaction.isButton() && interaction.customId.startsWith("suggestion:")) return interaction.reply({ content: "Votre vote a été enregistré.", ephemeral: true });
      if (interaction.isStringSelectMenu() && interaction.customId === "role-select") return interaction.member.roles.set(interaction.values).then(() => interaction.reply({ content: "Rôles mis à jour.", ephemeral: true }));
    } catch (error) { console.error(error); if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: "Une erreur est survenue.", ephemeral: true }).catch(() => {}); }
  });
  client.on("messageCreate", async (message) => {
    if (message.author.bot || !message.guild) return; const cfg = await getGuild(message.guild.id); const auto = cfg.automod ?? {}; if (auto.ignoredChannels?.includes(message.channel.id)) return; const content = message.content.toLowerCase();
    const keyword = (cfg.roleKeywords ?? []).find((entry) => content.trim() === entry.keyword && (!entry.channel || entry.channel === message.channel.id) && (!entry.user || entry.user === message.author.id));
    if (keyword) { await message.delete().catch(() => {}); await message.member.roles.add(keyword.role).catch(() => {}); const notice = await message.channel.send(`${message.author} ✅ rôle attribué.`).catch(() => null); if (notice) setTimeout(() => notice.delete().catch(() => {}), 3000); return; }
    if ((auto.invitations && /discord\.gg\/|discord\.com\/invite\//i.test(message.content)) || auto.forbiddenWords?.some((word) => content.includes(word)) || (auto.massMentions && message.mentions.users.size >= 5) || (auto.links && /https?:\/\//i.test(message.content))) { await message.delete().catch(() => {}); const notice = await message.channel.send(`${message.author}, ce message ne respecte pas les règles.`).catch(() => null); if (notice) setTimeout(() => notice.delete().catch(() => {}), 5000); }
    if (cfg.levels?.enabled) { cfg.xp ??= {}; const value = cfg.xp[message.author.id] ?? { xp: 0, level: 0, last: 0 }; if (Date.now() - value.last > (cfg.levels.cooldown ?? 60) * 1000) { value.xp += (15 + Math.floor(Math.random() * 11)) * (cfg.levels.multiplier ?? 1); value.last = Date.now(); while (value.xp >= 5 * value.level ** 2 + 50 * value.level + 100) value.level++; cfg.xp[message.author.id] = value; await saveGuild(message.guild.id, cfg); } }
  });
  client.on("guildMemberAdd", async (member) => { const cfg = await getGuild(member.guild.id); const before = cfg.invites?.cache ?? {}; const invites = await member.guild.invites.fetch().catch(() => new Map()); const used = [...invites.values()].find((invite) => (invite.uses ?? 0) > (before[invite.code]?.uses ?? 0)); if (used?.inviter) { cfg.invites.counts ??= {}; cfg.invites.counts[used.inviter.id] = (cfg.invites.counts[used.inviter.id] ?? 0) + 1; } cfg.invites.cache = Object.fromEntries(invites.map((invite) => [invite.code, { uses: invite.uses ?? 0, inviter: invite.inviter?.id }])); for (const role of cfg.autorole?.roles ?? []) await member.roles.add(role).catch(() => {}); await saveGuild(member.guild.id, cfg); await logEvent(member.guild, "arrivée", `${member.user.tag} a rejoint le serveur`, { invitation: used?.code ?? "inconnue", inviter: used?.inviter?.tag ?? "inconnu" }); if (cfg.welcome?.enabled && cfg.welcome.channel) await member.guild.channels.cache.get(cfg.welcome.channel)?.send(cfg.welcome.message.replaceAll("{user}", `${member}`).replaceAll("{username}", member.user.username).replaceAll("{server}", member.guild.name).replaceAll("{membercount}", String(member.guild.memberCount)).replaceAll("{invite}", cfg.invites?.vanity ?? "").replaceAll("{inviter}", used?.inviter ? `<@${used.inviter.id}>` : "inconnu")).catch(() => {}); });
  client.on("guildMemberRemove", (member) => logEvent(member.guild, "départ", `${member.user.tag} a quitté le serveur`));
  client.on("guildBanAdd", (ban) => logEvent(ban.guild, "ban", `${ban.user.tag} a été banni`));
  client.on("guildBanRemove", (ban) => logEvent(ban.guild, "unban", `${ban.user.tag} a été débanni`));
  client.on("channelCreate", (channel) => logEvent(channel.guild, "salon créé", `Salon créé : ${channel.name}`));
  client.on("channelDelete", (channel) => channel.guild && logEvent(channel.guild, "salon supprimé", `Salon supprimé : ${channel.name}`));
  client.on("roleCreate", (role) => logEvent(role.guild, "rôle créé", `Rôle créé : ${role.name}`));
  client.on("roleDelete", (role) => logEvent(role.guild, "rôle supprimé", `Rôle supprimé : ${role.name}`));
  client.on("messageDelete", (message) => message.guild && logEvent(message.guild, "message supprimé", `Message de ${message.author?.tag ?? "inconnu"} dans ${message.channel}`, { contenu: message.content || "non disponible" }));
  client.on("messageUpdate", (before, after) => before.guild && before.content !== after.content && logEvent(before.guild, "message modifié", `Message modifié par ${before.author?.tag ?? "inconnu"}`, { avant: before.content || "—", après: after.content || "—" }));
  client.on("guildMemberUpdate", (before, after) => { if (before.nickname !== after.nickname) logEvent(after.guild, "surnom", `${after.user.tag} : ${before.nickname ?? before.user.username} → ${after.nickname ?? after.user.username}`); if (before.roles.cache.size !== after.roles.cache.size) logEvent(after.guild, "rôles", `Rôles modifiés pour ${after.user.tag}`); });
  client.on("voiceStateUpdate", (before, after) => { if (before.channelId !== after.channelId) logEvent(after.guild, "vocal", `${after.member?.user.tag ?? "Membre"} : ${before.channel?.name ?? "aucun"} → ${after.channel?.name ?? "aucun"}`); });
  client.on("presenceUpdate", async (_, presence) => { const cfg = await getGuild(presence.guild.id); const role = presence.guild.roles.cache.get(cfg.liveRole); if (!role || !presence.member) return; const streaming = presence.activities.some((activity) => activity.type === 1); await presence.member.roles[streaming ? "add" : "remove"](role).catch(() => {}); });
  client.on("voiceStateUpdate", async (before, after) => { const cfg = await getGuild(after.guild.id); if (after.channelId === cfg.tempVoice?.generator) { const channel = await after.guild.channels.create({ name: `Salon de ${after.member.displayName}`, type: 2, parent: cfg.tempVoice.category, permissionOverwrites: [{ id: after.member.id, allow: ["ManageChannels", "MoveMembers"] }] }); await after.setChannel(channel); } if (before.channel?.parentId === cfg.tempVoice?.category && before.channel.members.size === 0 && before.channelId !== cfg.tempVoice.generator) await before.channel.delete().catch(() => {}); });
  return client;
}
if (process.env.DISCORD_TOKEN) { const client = await createClient(); await client.login(process.env.DISCORD_TOKEN); process.on("unhandledRejection", (error) => console.error("Rejet non géré", error)); process.on("uncaughtException", (error) => console.error("Exception non gérée", error)); }
