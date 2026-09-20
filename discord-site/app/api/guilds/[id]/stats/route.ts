import { NextResponse } from "next/server";
import { requireGuildAccess } from "../../../../../lib/auth";
import { botJson } from "../../../../../lib/bot-api";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const access = await requireGuildAccess(request, params.id);
  if ("response" in access) return access.response;
  const result = await botJson(`/guilds/${params.id}/stats`);
  return NextResponse.json(result ?? { error: "Le bot est hors ligne" }, {
    status: result ? 200 : 503,
  });
}
