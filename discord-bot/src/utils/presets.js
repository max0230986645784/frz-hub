import { PermissionFlagsBits } from "discord.js";

const presetDefinitions = [
  {
    name: "👑 Fondateur",
    color: "#ef4444",
    permissions: [PermissionFlagsBits.Administrator],
  },
  {
    name: "🛡️ Modérateur",
    color: "#22c55e",
    permissions: [
      PermissionFlagsBits.ManageMessages,
      PermissionFlagsBits.KickMembers,
      PermissionFlagsBits.BanMembers,
      PermissionFlagsBits.ModerateMembers,
      PermissionFlagsBits.ManageChannels,
      PermissionFlagsBits.ManageNicknames,
      PermissionFlagsBits.MuteMembers,
      PermissionFlagsBits.MoveMembers,
      PermissionFlagsBits.ViewAuditLog,
    ],
  },
  { name: "💎 VIP", color: "#ec4899", permissions: [] },
  {
    name: "🎥 Streamer",
    color: "#9146ff",
    permissions: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.Connect,
      PermissionFlagsBits.Speak,
      PermissionFlagsBits.Stream,
      PermissionFlagsBits.AddReactions,
      PermissionFlagsBits.AttachFiles,
      PermissionFlagsBits.EmbedLinks,
      PermissionFlagsBits.UseExternalEmojis,
    ],
  },
];

export async function ensurePresetRoles(guild) {
  const roles = [];
  for (const definition of presetDefinitions) {
    let role = guild.roles.cache.find((item) => item.name === definition.name);
    if (!role)
      role = await guild.roles.create({
        name: definition.name,
        color: definition.color,
        hoist: true,
        permissions: definition.permissions,
      });
    else
      await role
        .edit({ hoist: true, permissions: definition.permissions, color: definition.color })
        .catch(() => {});
    roles.push(role);
  }
  const top = guild.roles.highest.position - 1;
  await guild.roles
    .setPositions(roles.map((role, index) => ({ role: role.id, position: top - index })))
    .catch(() => {});
  return Object.fromEntries(roles.map((role) => [role.name, role]));
}
