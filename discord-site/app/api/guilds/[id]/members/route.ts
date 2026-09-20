import { NextResponse } from "next/server";
import { botJson } from "../../../../../lib/bot-api";
import { requireGuildAccess } from "../../../../../lib/auth";
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const access = await requireGuildAccess(request, params.id);
  if ("response" in access) return access.response;
  const query = new URL(request.url).search;
  const data = await botJson(`/guilds/${params.id}/members${query}`);
  return NextResponse.json(data ?? { error: "Le bot est hors ligne" }, {
    status: data ? 200 : 503,
  });
}
