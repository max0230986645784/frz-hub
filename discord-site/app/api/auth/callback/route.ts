import { NextResponse } from "next/server";
import { setSession } from "../../../../lib/session";
export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code"); if (!code) return NextResponse.redirect(new URL("/dashboard?error=oauth", request.url));
  const body = new URLSearchParams({ client_id: process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID ?? "", client_secret: process.env.DISCORD_CLIENT_SECRET ?? "", grant_type: "authorization_code", code, redirect_uri: process.env.DISCORD_REDIRECT_URI ?? "" });
  const token = await fetch("https://discord.com/api/oauth2/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body }).then((r) => r.json());
  if (!token.access_token) return NextResponse.redirect(new URL("/dashboard?error=oauth", request.url));
  const headers = { Authorization: `Bearer ${token.access_token}` }; const [user, guilds] = await Promise.all([fetch("https://discord.com/api/users/@me", { headers }).then((r) => r.json()), fetch("https://discord.com/api/users/@me/guilds", { headers }).then((r) => r.json())]);
  await setSession({ user: { id: user.id, username: user.username, avatar: user.avatar }, guilds: guilds.filter((g: { permissions: string; owner: boolean }) => (Number(g.permissions) & 32) === 32 || g.owner).map((g: { id: string; name: string; owner: boolean; permissions: string }) => ({ id: g.id, name: g.name, owner: g.owner, permissions: g.permissions })) });
  return NextResponse.redirect(new URL("/dashboard", request.url));
}
