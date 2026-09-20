import { NextResponse } from "next/server";
import { botJson } from "../../../../lib/bot-api";
import { requireGuildAccess } from "../../../../lib/auth";
export async function GET(_: Request, { params }: { params: { id: string } }) {
  const access = await requireGuildAccess(_, params.id);
  if ("response" in access) return access.response;
  const result = await botJson(`/guilds/${params.id}`);
  return NextResponse.json(result ?? { error: "Le bot est hors ligne" }, {
    status: result ? 200 : 503,
  });
}
