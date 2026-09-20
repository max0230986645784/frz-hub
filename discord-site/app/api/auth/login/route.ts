import { NextResponse } from "next/server";
export function GET() { const params = new URLSearchParams({ client_id: process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID ?? "", response_type: "code", redirect_uri: process.env.DISCORD_REDIRECT_URI ?? "", scope: "identify guilds" }); return NextResponse.redirect(`https://discord.com/oauth2/authorize?${params}`); }
