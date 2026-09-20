import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
export function GET() {
  const state = randomBytes(32).toString("hex");
  cookies().set("mr_robot_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  const params = new URLSearchParams({
    client_id: process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID ?? "",
    response_type: "code",
    redirect_uri: process.env.DISCORD_REDIRECT_URI ?? "",
    scope: "identify guilds",
    state,
  });
  return NextResponse.redirect(`https://discord.com/oauth2/authorize?${params}`);
}
