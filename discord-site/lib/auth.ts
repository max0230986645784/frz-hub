import { NextResponse } from "next/server";
import { getSession, type Session } from "./session";

export type GuildAccess =
  | { session: Session; guild: Session["guilds"][number] }
  | { response: NextResponse };

export async function requireGuildAccess(_: Request, guildId: string): Promise<GuildAccess> {
  const session = await getSession();
  if (!session)
    return { response: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) };
  const guild = session.guilds.find((item) => item.id === guildId);
  if (!guild) return { response: NextResponse.json({ error: "Accès refusé" }, { status: 403 }) };
  const permissions = BigInt(guild.permissions ?? "0");
  if (!guild.owner && (permissions & 0x20n) === 0n && (permissions & 0x8n) === 0n)
    return { response: NextResponse.json({ error: "Permission insuffisante" }, { status: 403 }) };
  return { session, guild };
}

export function canManageGuild(session: Session, guildId: string) {
  const guild = session.guilds.find((item) => item.id === guildId);
  if (!guild) return false;
  const permissions = BigInt(guild.permissions ?? "0");
  return guild.owner || (permissions & 0x20n) !== 0n || (permissions & 0x8n) !== 0n;
}
