import "dotenv/config";
import {
  Client,
  Collection,
  EmbedBuilder,
  GatewayIntentBits,
  MessageType,
  Partials,
  PermissionFlagsBits,
} from "discord.js";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { startApi } from "./api.js";
import { getGuild, saveGuild } from "./store.js";
import { buildTranscript } from "./utils/transcript.js";
import { logEvent } from "./utils/logger.js";
import { startTwitchPoller } from "./utils/twitch.js";
import { pollPresentation, rescheduleTimers } from "./timers.js";
import { addWarning } from "./utils/warnings.js";
import { levelForXp } from "./utils/levels.js";
import { isOwner, ownerExempt, ownersConfigured } from "./utils/owners.js";

export async function loadCommands() {
  const dir = join(fileURLToPath(new URL(".", import.meta.url)), "commands");
  const files = (await readdir(dir)).filter(
    (file) => file.endsWith(".js") && !file.startsWith("_"),
  );
  return Promise.all(files.map((file) => import(pathToFileURL(join(dir, file)))));
}
async function syncInvites(guild) {
  const cfg = await getGuild(guild.id);
  const invites = await guild.invites.fetch().catch(() => new Map());
  cfg.invites ??= { cache: {}, counts: {} };
  cfg.invites.cache = Object.fromEntries(
    invites.map((invite) => [invite.code, { uses: invite.uses ?? 0, inviter: invite.inviter?.id }]),
  );
  await saveGuild(guild.id, cfg);
}
async function createTicket(interaction, categoryName = "default") {
  const cfg = await getGuild(interaction.guildId);
  const category =
    cfg.tickets?.categories?.find((item) => item.name === categoryName) ??
    cfg.tickets?.categories?.[0];
  const channel = await interaction.guild.channels.create({
    name: `ticket-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
    parent: category?.category,
    permissionOverwrites: [
      { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      {
        id: interaction.user.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
      },
      ...(category?.support
        ? [
            {
              id: category.support,
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
            },
          ]
        : []),
    ],
  });
  cfg.tickets.counter = (cfg.tickets.counter ?? 0) + 1;
  cfg.tickets.open ??= {};
  cfg.tickets.open[channel.id] = {
    opener: interaction.user.id,
    claimedBy: null,
    category: categoryName,
  };
  await saveGuild(interaction.guildId, cfg);
  await channel.send({
    content: category?.welcome ?? "Bonjour, un membre du support arrive bientôt.",
    components: [
      {
        type: 1,
        components: [
          { type: 2, custom_id: "ticket:claim", label: "Réclamer", style: 1 },
          { type: 2, custom_id: "ticket:add", label: "Ajouter membre", style: 2 },
          { type: 2, custom_id: "ticket:close", label: "Fermer", style: 4 },
        ],
      },
    ],
  });
  return channel;
}
async function closeTicket(interaction) {
  const cfg = await getGuild(interaction.guildId);
  const ticket = cfg.tickets?.open?.[interaction.channelId];
  if (!ticket)
    return interaction.reply({ content: "Ce salon n'est pas un ticket.", ephemeral: true });
  const transcript = await buildTranscript(interaction.channel);
  const files = [
    { attachment: transcript.html, name: "transcript.html" },
    { attachment: transcript.text, name: "transcript.txt" },
  ];
  const transcriptChannel =
    cfg.tickets.transcriptChannel &&
    interaction.guild.channels.cache.get(cfg.tickets.transcriptChannel);
  if (transcriptChannel?.isTextBased())
    await transcriptChannel
      .send({ content: `Transcript de ${interaction.channel.name}`, files })
      .catch(() => {});
  const opener = await interaction.client.users.fetch(ticket.opener).catch(() => null);
  await opener
    ?.send({ content: `Votre ticket ${interaction.channel.name} est fermé.`, files })
    .catch(() => {});
  delete cfg.tickets.open[interaction.channelId];
  await saveGuild(interaction.guildId, cfg);
  const response = { content: "Ticket fermé, transcript archivé.", components: [] };
  if (interaction.isButton() && !interaction.replied)
    await interaction.update(response).catch(() => {});
  else if (!interaction.replied)
    await interaction.reply({ ...response, ephemeral: true }).catch(() => {});
  await interaction.channel.delete().catch(() => {});
}
export async function createClient() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildPresences,
    ],
    partials: [Partials.Channel, Partials.Message],
  });
  client.commands = new Collection();
  for (const command of await loadCommands()) client.commands.set(command.data.name, command);
  const spamWindows = new Map();
  const raidWindows = new Map();
  const interactionHandlers = new Map();
  interactionHandlers.set("ticket:open", async (interaction) =>
    interaction.reply({
      content: `Ticket créé : ${await createTicket(interaction, interaction.customId.slice("ticket:open:".length))}`,
      ephemeral: true,
    }),
  );
  interactionHandlers.set("ticket:claim", async (interaction) => {
    const cfg = await getGuild(interaction.guildId);
    const ticket = cfg.tickets?.open?.[interaction.channelId];
    if (!ticket) return interaction.reply({ content: "Ticket introuvable.", ephemeral: true });
    ticket.claimedBy = interaction.user.id;
    await saveGuild(interaction.guildId, cfg);
    return interaction.reply(`Ticket réclamé par ${interaction.user}.`);
  });
  interactionHandlers.set("ticket:add", async (interaction) =>
    interaction.reply({
      content: "Sélectionnez le membre à ajouter.",
      components: [
        {
          type: 1,
          components: [
            {
              type: 5,
              custom_id: "ticket:adduser",
              placeholder: "Membre à ajouter",
              min_values: 1,
              max_values: 1,
            },
          ],
        },
      ],
      ephemeral: true,
    }),
  );
  interactionHandlers.set("ticket:close", async (interaction) =>
    interaction.reply({
      content: "Confirmez la fermeture ?",
      components: [
        {
          type: 1,
          components: [
            { type: 2, custom_id: "ticket:close:confirm", label: "Confirmer", style: 4 },
          ],
        },
      ],
      ephemeral: true,
    }),
  );
  interactionHandlers.set("ticket:close:confirm", closeTicket);
  interactionHandlers.set("categorie:delete", async (interaction) => {
    const category = interaction.guild.channels.cache.get(interaction.customId.split(":")[2]);
    if (!category || category.type !== 4)
      return interaction.update({ content: "Catégorie introuvable.", components: [] });
    await category.delete().catch(() => {});
    return interaction.update({ content: "Catégorie supprimée.", components: [] });
  });
  interactionHandlers.set("giveaway:join", async (interaction) => {
    const id = interaction.customId.split(":")[2];
    const cfg = await getGuild(interaction.guildId);
    const giveaway = cfg.giveaways?.[id];
    if (giveaway && !giveaway.participants.includes(interaction.user.id)) {
      giveaway.participants.push(interaction.user.id);
      await saveGuild(interaction.guildId, cfg);
    }
    return interaction.reply({ content: "Participation enregistrée !", ephemeral: true });
  });
  interactionHandlers.set("poll:vote", async (interaction) => {
    const [, , id, index] = interaction.customId.split(":");
    const cfg = await getGuild(interaction.guildId);
    const poll = cfg.polls?.[id];
    if (!poll) return interaction.reply({ content: "Sondage terminé.", ephemeral: true });
    poll.votes[interaction.user.id] = Number(index);
    await saveGuild(interaction.guildId, cfg);
    const embed = pollPresentation(poll);
    const message = await interaction.channel.messages.fetch(poll.message).catch(() => null);
    if (message)
      await message
        .edit({
          embeds: [{ title: embed.title, description: embed.description }],
          components: interaction.message.components,
        })
        .catch(() => {});
    return interaction.reply({
      content: `Vote enregistré pour l'option ${Number(index) + 1}.`,
      ephemeral: true,
    });
  });
  interactionHandlers.set("config:toggle", async (interaction) => {
    const section = interaction.customId.split(":")[2];
    const cfg = await getGuild(interaction.guildId);
    cfg[section] ??= {};
    cfg[section].enabled = !cfg[section].enabled;
    await saveGuild(interaction.guildId, cfg);
    return interaction.update({
      content: `${section} : ${cfg[section].enabled ? "activé" : "désactivé"}`,
      embeds: [],
      components: [],
    });
  });
  interactionHandlers.set("suggestion:up", (interaction) =>
    handleSuggestionVote(interaction, "up"),
  );
  interactionHandlers.set("suggestion:down", (interaction) =>
    handleSuggestionVote(interaction, "down"),
  );
  interactionHandlers.set("suggestion:accept", (interaction) =>
    handleSuggestionStatus(interaction, "Acceptée"),
  );
  interactionHandlers.set("suggestion:reject", (interaction) =>
    handleSuggestionStatus(interaction, "Refusée"),
  );
  interactionHandlers.set("role-select", async (interaction) => {
    const managed = new Set(interaction.customId.split(":")[1]?.split(",").filter(Boolean) ?? []);
    const current = interaction.member.roles.cache;
    const selected = new Set(interaction.values);
    for (const roleId of managed) {
      if (selected.has(roleId)) await interaction.member.roles.add(roleId).catch(() => {});
      else if (current.has(roleId)) await interaction.member.roles.remove(roleId).catch(() => {});
    }
    return interaction.reply({ content: "Rôles mis à jour.", ephemeral: true });
  });
  async function handleSuggestionVote(interaction, vote) {
    const cfg = await getGuild(interaction.guildId);
    const suggestion = cfg.suggestions?.[interaction.message.id];
    if (!suggestion)
      return interaction.reply({ content: "Suggestion introuvable.", ephemeral: true });
    suggestion.up = suggestion.up.filter((id) => id !== interaction.user.id);
    suggestion.down = suggestion.down.filter((id) => id !== interaction.user.id);
    suggestion[vote].push(interaction.user.id);
    await saveGuild(interaction.guildId, cfg);
    const embed = EmbedBuilder.from(interaction.message.embeds[0]).setFooter({
      text: `👍 ${suggestion.up.length} · 👎 ${suggestion.down.length} · ${suggestion.status}`,
    });
    await interaction.message.edit({ embeds: [embed] }).catch(() => {});
    return interaction.reply({ content: "Votre vote a été enregistré.", ephemeral: true });
  }
  async function handleSuggestionStatus(interaction, status) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild))
      return interaction.reply({ content: "Permission insuffisante.", ephemeral: true });
    const cfg = await getGuild(interaction.guildId);
    const suggestion = cfg.suggestions?.[interaction.message.id];
    if (!suggestion)
      return interaction.reply({ content: "Suggestion introuvable.", ephemeral: true });
    suggestion.status = status;
    await saveGuild(interaction.guildId, cfg);
    const embed = EmbedBuilder.from(interaction.message.embeds[0])
      .setColor(status === "Acceptée" ? 0x22c55e : 0xef4444)
      .setFooter({ text: `👍 ${suggestion.up.length} · 👎 ${suggestion.down.length} · ${status}` });
    return interaction.update({ embeds: [embed], components: [] });
  }
  client.once("ready", async () => {
    console.log(`Connecté en tant que ${client.user.tag}`);
    for (const guild of client.guilds.cache.values()) await syncInvites(guild);
    await rescheduleTimers(client);
    startTwitchPoller(client);
    startApi(client);
  });
  client.on("inviteCreate", async (invite) => {
    await syncInvites(invite.guild);
    await logEvent(invite.guild, "invitation", `Invitation créée : ${invite.code}`);
  });
  client.on("inviteDelete", async (invite) => {
    await syncInvites(invite.guild);
    await logEvent(invite.guild, "invitation", `Invitation supprimée : ${invite.code}`);
  });
  client.on("interactionCreate", async (interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        if (
          !ownerExempt(interaction) &&
          (await ownersConfigured()) &&
          !(await isOwner(interaction.user.id))
        )
          return interaction.reply({ content: "Réservé au propriétaire.", ephemeral: true });
        return await client.commands.get(interaction.commandName)?.execute(interaction);
      }
      if (interaction.isStringSelectMenu() && interaction.customId === "ticket:select")
        return interaction.reply({
          content: `Ticket créé : ${await createTicket(interaction, interaction.values[0])}`,
          ephemeral: true,
        });
      if (interaction.isUserSelectMenu() && interaction.customId === "ticket:adduser") {
        await interaction.channel.permissionOverwrites.edit(interaction.values[0], {
          ViewChannel: true,
          SendMessages: true,
        });
        return interaction.update({ content: "Membre ajouté au ticket.", components: [] });
      }
      const customId = interaction.customId;
      const key = customId.startsWith("role-select")
        ? "role-select"
        : customId.split(":").slice(0, 2).join(":");
      const handler = interactionHandlers.get(customId) ?? interactionHandlers.get(key);
      if (handler) return await handler(interaction);
    } catch (error) {
      console.error(error);
      if (!interaction.replied && !interaction.deferred)
        await interaction
          .reply({ content: "Une erreur est survenue.", ephemeral: true })
          .catch(() => {});
    }
  });
  client.on("messageCreate", async (message) => {
    if (!message.guild) return;
    const cfg = await getGuild(message.guild.id);
    if (
      [
        MessageType.GuildBoost,
        MessageType.GuildBoostTier1,
        MessageType.GuildBoostTier2,
        MessageType.GuildBoostTier3,
      ].includes(message.type)
    ) {
      const channel = cfg.boost?.channel && message.guild.channels.cache.get(cfg.boost.channel);
      if (cfg.boost?.enabled && channel?.isTextBased())
        await channel
          .send({
            embeds: [
              new EmbedBuilder()
                .setColor(0xec4899)
                .setDescription(`🚀 ${message.author} a boosté le serveur ! Merci 💎`),
            ],
          })
          .catch(() => {});
      return;
    }
    if (message.author.bot) return;
    const auto = cfg.automod ?? {};
    if (
      auto.ignoredChannels?.includes(message.channel.id) ||
      auto.ignoredRoles?.some((id) => message.member?.roles.cache.has(id))
    )
      return;
    const content = message.content.toLowerCase();
    const keyword = (cfg.roleKeywords ?? []).find(
      (entry) =>
        content.trim() === entry.keyword &&
        (!entry.channel || entry.channel === message.channel.id) &&
        (!entry.user || entry.user === message.author.id),
    );
    if (keyword) {
      await message.delete().catch(() => {});
      await message.member.roles.add(keyword.role).catch(() => {});
      const notice = await message.channel
        .send(`${message.author} ✅ rôle attribué.`)
        .catch(() => null);
      if (notice) setTimeout(() => notice.delete().catch(() => {}), 3000);
      return;
    }
    const urls = [...message.content.matchAll(/https?:\/\/[^\s]+/gi)].map(([url]) => {
      try {
        return new URL(url).hostname.toLowerCase();
      } catch {
        return "";
      }
    });
    const whitelisted =
      urls.length > 0 &&
      urls.every((host) =>
        (auto.linkWhitelist ?? []).some((domain) => host === domain || host.endsWith(`.${domain}`)),
      );
    const letters = message.content.match(/[a-zà-ÿ]/gi) ?? [];
    const capitals =
      letters.length > 8 &&
      (message.content.match(/[A-ZÀ-Ÿ]/g) ?? []).length / letters.length > 0.7;
    const spamKey = `${message.guild.id}:${message.author.id}`;
    const now = Date.now();
    const history = (spamWindows.get(spamKey) ?? []).filter(
      (time) => now - time < (auto.spam?.seconds ?? 8) * 1000,
    );
    history.push(now);
    spamWindows.set(spamKey, history);
    const spam = auto.spam && history.length >= (auto.spam.count ?? 5);
    let reason = null;
    if (auto.invitations && /discord\.gg\/|discord\.com\/invite\//i.test(message.content))
      reason = "Invitation Discord interdite";
    else if (auto.links && urls.length && !whitelisted) reason = "Lien interdit";
    else if (auto.forbiddenWords?.some((word) => content.includes(word))) reason = "Mot interdit";
    else if (auto.massMentions && message.mentions.users.size >= 5) reason = "Mentions de masse";
    else if (auto.capitals && capitals) reason = "Usage excessif des majuscules";
    else if (spam) reason = "Spam";
    if (reason) {
      await message.delete().catch(() => {});
      const result = await addWarning(message.guild, message.member, reason, client.user?.id);
      await logEvent(message.guild, "automod", `${message.author.tag} : ${reason}`, {
        avertissements: result.count,
      });
      const notice = await message.channel
        .send(`${message.author}, ${reason.toLowerCase()} détecté. Avertissement ${result.count}.`)
        .catch(() => null);
      if (notice) setTimeout(() => notice.delete().catch(() => {}), 5000);
      return;
    }
    if (cfg.levels?.enabled && !cfg.levels.ignoredChannels?.includes(message.channel.id)) {
      cfg.xp ??= {};
      const value = cfg.xp[message.author.id] ?? { xp: 0, level: 0, last: 0 };
      if (Date.now() - value.last > (cfg.levels.cooldown ?? 60) * 1000) {
        const previousLevel = value.level;
        value.xp += (15 + Math.floor(Math.random() * 11)) * (cfg.levels.multiplier ?? 1);
        value.last = Date.now();
        value.level = levelForXp(value.xp);
        cfg.xp[message.author.id] = value;
        await saveGuild(message.guild.id, cfg);
        if (value.level > previousLevel) {
          const target = cfg.levels.announcementChannel
            ? message.guild.channels.cache.get(cfg.levels.announcementChannel)
            : message.channel;
          const announcement = (cfg.levels.message ?? "Bravo {user}, tu passes niveau {level} !")
            .replaceAll("{user}", `${message.author}`)
            .replaceAll("{level}", String(value.level));
          await target?.send(announcement).catch(() => {});
          const reward = cfg.levels.rewards?.[value.level];
          if (reward) await message.member.roles.add(reward).catch(() => {});
        }
      }
    }
  });
  client.on("guildMemberAdd", async (member) => {
    const cfg = await getGuild(member.guild.id);
    if (cfg.antiRaid?.enabled) {
      const now = Date.now();
      const joins = (raidWindows.get(member.guild.id) ?? []).filter(
        (time) => now - time < cfg.antiRaid.window * 1000,
      );
      joins.push(now);
      raidWindows.set(member.guild.id, joins);
      if (joins.length >= cfg.antiRaid.threshold && !cfg.antiRaid.lockdown) {
        cfg.antiRaid.lockdown = true;
        for (const channel of member.guild.channels.cache.values())
          if (channel.isTextBased())
            await channel.permissionOverwrites
              .edit(member.guild.roles.everyone, { SendMessages: false })
              .catch(() => {});
        await logEvent(
          member.guild,
          "anti-raid",
          `Anti-raid activé après ${joins.length} arrivées.`,
        );
      }
    }
    const before = cfg.invites?.cache ?? {};
    const invites = await member.guild.invites.fetch().catch(() => new Map());
    const used = [...invites.values()].find(
      (invite) => (invite.uses ?? 0) > (before[invite.code]?.uses ?? 0),
    );
    if (used?.inviter) {
      cfg.invites.counts ??= {};
      cfg.invites.counts[used.inviter.id] = (cfg.invites.counts[used.inviter.id] ?? 0) + 1;
    }
    cfg.invites.cache = Object.fromEntries(
      invites.map((invite) => [
        invite.code,
        { uses: invite.uses ?? 0, inviter: invite.inviter?.id },
      ]),
    );
    for (const role of cfg.autorole?.roles ?? []) await member.roles.add(role).catch(() => {});
    await saveGuild(member.guild.id, cfg);
    await logEvent(member.guild, "arrivée", `${member.user.tag} a rejoint le serveur`, {
      invitation: used?.code ?? "inconnue",
      inviter: used?.inviter?.tag ?? "inconnu",
    });
    if (cfg.welcome?.enabled && cfg.welcome.channel)
      await member.guild.channels.cache
        .get(cfg.welcome.channel)
        ?.send(
          cfg.welcome.message
            .replaceAll("{user}", `${member}`)
            .replaceAll("{username}", member.user.username)
            .replaceAll("{server}", member.guild.name)
            .replaceAll("{membercount}", String(member.guild.memberCount))
            .replaceAll("{invite}", cfg.invites?.vanity ?? "")
            .replaceAll("{inviter}", used?.inviter ? `<@${used.inviter.id}>` : "inconnu"),
        )
        .catch(() => {});
  });
  client.on("guildMemberRemove", async (member) => {
    const cfg = await getGuild(member.guild.id);
    await logEvent(member.guild, "départ", `${member.user.tag} a quitté le serveur`);
    if (cfg.goodbye?.enabled && cfg.goodbye.channel)
      await member.guild.channels.cache
        .get(cfg.goodbye.channel)
        ?.send(
          (cfg.goodbye.message ?? "{username} nous quitte. À bientôt !")
            .replaceAll("{user}", `${member}`)
            .replaceAll("{username}", member.user.username)
            .replaceAll("{server}", member.guild.name)
            .replaceAll("{membercount}", String(member.guild.memberCount)),
        )
        .catch(() => {});
  });
  client.on("guildBanAdd", (ban) => logEvent(ban.guild, "ban", `${ban.user.tag} a été banni`));
  client.on("guildBanRemove", (ban) =>
    logEvent(ban.guild, "unban", `${ban.user.tag} a été débanni`),
  );
  client.on("channelCreate", (channel) =>
    logEvent(channel.guild, "salon créé", `Salon créé : ${channel.name}`),
  );
  client.on(
    "channelDelete",
    (channel) =>
      channel.guild &&
      logEvent(channel.guild, "salon supprimé", `Salon supprimé : ${channel.name}`),
  );
  client.on("roleCreate", (role) => logEvent(role.guild, "rôle créé", `Rôle créé : ${role.name}`));
  client.on("roleDelete", (role) =>
    logEvent(role.guild, "rôle supprimé", `Rôle supprimé : ${role.name}`),
  );
  client.on(
    "messageDelete",
    (message) =>
      message.guild &&
      logEvent(
        message.guild,
        "message supprimé",
        `Message de ${message.author?.tag ?? "inconnu"} dans ${message.channel}`,
        { contenu: message.content || "non disponible" },
      ),
  );
  client.on(
    "messageUpdate",
    (before, after) =>
      before.guild &&
      before.content !== after.content &&
      logEvent(
        before.guild,
        "message modifié",
        `Message modifié par ${before.author?.tag ?? "inconnu"}`,
        { avant: before.content || "—", après: after.content || "—" },
      ),
  );
  client.on("guildMemberUpdate", async (before, after) => {
    if (before.nickname !== after.nickname)
      logEvent(
        after.guild,
        "surnom",
        `${after.user.tag} : ${before.nickname ?? before.user.username} → ${after.nickname ?? after.user.username}`,
      );
    if (before.roles.cache.size !== after.roles.cache.size)
      logEvent(after.guild, "rôles", `Rôles modifiés pour ${after.user.tag}`);
    const cfg = await getGuild(after.guild.id);
    if (cfg.boost?.enabled && cfg.boost.vipRole) {
      const channel = cfg.boost.channel && after.guild.channels.cache.get(cfg.boost.channel);
      if (!before.premiumSince && after.premiumSince) {
        await after.roles.add(cfg.boost.vipRole).catch(() => {});
        if (channel?.isTextBased())
          await channel
            .send({
              embeds: [
                new EmbedBuilder()
                  .setColor(0xec4899)
                  .setDescription(`🚀 ${after} a boosté le serveur ! Merci 💎`),
              ],
            })
            .catch(() => {});
      } else if (before.premiumSince && !after.premiumSince) {
        await after.roles.remove(cfg.boost.vipRole).catch(() => {});
      }
    }
  });
  client.on("voiceStateUpdate", (before, after) => {
    if (before.channelId !== after.channelId)
      logEvent(
        after.guild,
        "vocal",
        `${after.member?.user.tag ?? "Membre"} : ${before.channel?.name ?? "aucun"} → ${after.channel?.name ?? "aucun"}`,
      );
  });
  client.on("presenceUpdate", async (_, presence) => {
    const cfg = await getGuild(presence.guild.id);
    const role = presence.guild.roles.cache.get(cfg.liveRole);
    if (!role || !presence.member) return;
    const streaming = presence.activities.some((activity) => activity.type === 1);
    await presence.member.roles[streaming ? "add" : "remove"](role).catch(() => {});
  });
  client.on("voiceStateUpdate", async (before, after) => {
    const cfg = await getGuild(after.guild.id);
    if (after.channelId === cfg.tempVoice?.generator) {
      const channel = await after.guild.channels.create({
        name: `Salon de ${after.member.displayName}`,
        type: 2,
        parent: cfg.tempVoice.category,
        permissionOverwrites: [{ id: after.member.id, allow: ["ManageChannels", "MoveMembers"] }],
      });
      await after.setChannel(channel);
    }
    if (
      before.channel?.parentId === cfg.tempVoice?.category &&
      before.channel.members.size === 0 &&
      before.channelId !== cfg.tempVoice.generator
    )
      await before.channel.delete().catch(() => {});
  });
  return client;
}
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain && process.env.DISCORD_TOKEN) {
  const client = await createClient();
  await client.login(process.env.DISCORD_TOKEN);
  process.on("unhandledRejection", (error) => console.error("Rejet non géré", error));
  process.on("uncaughtException", (error) => console.error("Exception non gérée", error));
}
