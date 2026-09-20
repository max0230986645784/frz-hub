import { PermissionFlagsBits } from "discord.js";
export const adminPermissions = PermissionFlagsBits.ManageGuild.toString();
export function isAdmin(member) { return member?.permissions?.has(PermissionFlagsBits.ManageGuild) || member?.permissions?.has(PermissionFlagsBits.Administrator); }
export function canManage(member, target) { return isAdmin(member) || (member?.roles?.highest?.comparePositionTo(target?.roles?.highest) > 0); }
