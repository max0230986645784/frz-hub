import { NextResponse } from "next/server";
import { getSession, type Session } from "./session";

export function dashboardOwnerIds() {
  return (process.env.DASHBOARD_OWNER_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => /^\d{15,25}$/.test(id));
}

export function isDashboardOwner(userId: string) {
  const owners = dashboardOwnerIds();
  return owners.length === 0 || owners.includes(userId);
}

export type GuildAccess =
  | { session: Session; guild: Session["guilds"][number] }
  | { response: NextResponse };

export async function requireGuildAccess(_: Request, guildId: string): Promise<GuildAccess> {
  const session = await getSession();
  if (!session)
    return { response: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) };
  if (!isDashboardOwner(session.user.id))
    return {
      response: NextResponse.json({ error: "Accès réservé au propriétaire" }, { status: 403 }),
    };
  const guild = session.guilds.find((item) => item.id === guildId);
  if (!guild) return { response: NextResponse.json({ error: "Accès refusé" }, { status: 403 }) };
  const permissions = BigInt(guild.permissions ?? "0");
  if (!guild.owner && (permissions & 0x20n) === 0n && (permissions & 0x8n) === 0n)
    return { response: NextResponse.json({ error: "Permission insuffisante" }, { status: 403 }) };
  return { session, guild };
}

export function canManageGuild(session: Session, guildId: string) {
  if (!isDashboardOwner(session.user.id)) return false;
  const guild = session.guilds.find((item) => item.id === guildId);
  if (!guild) return false;
  const permissions = BigInt(guild.permissions ?? "0");
  return guild.owner || (permissions & 0x20n) !== 0n || (permissions & 0x8n) !== 0n;
}
