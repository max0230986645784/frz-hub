import { NextResponse } from "next/server";
import { botFetch } from "../../../../../../lib/bot-api";
import { requireGuildAccess } from "../../../../../../lib/auth";
export async function DELETE(
  request: Request,
  { params }: { params: { id: string; channelId: string } },
) {
  const access = await requireGuildAccess(request, params.id);
  if ("response" in access) return access.response;
  const response = await botFetch(`/guilds/${params.id}/channels/${params.channelId}`, {
    method: "DELETE",
  });
  return NextResponse.json(await response.json(), { status: response.status });
}
