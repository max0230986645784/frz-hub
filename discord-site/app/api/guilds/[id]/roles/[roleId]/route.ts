import { NextResponse } from "next/server";
import { botFetch } from "../../../../../../lib/bot-api";
import { requireGuildAccess } from "../../../../../../lib/auth";
export async function DELETE(
  request: Request,
  { params }: { params: { id: string; roleId: string } },
) {
  const access = await requireGuildAccess(request, params.id);
  if ("response" in access) return access.response;
  const response = await botFetch(`/guilds/${params.id}/roles/${params.roleId}`, {
    method: "DELETE",
  });
  return NextResponse.json(await response.json(), { status: response.status });
}
