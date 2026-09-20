import { NextResponse } from "next/server";
import { botFetch } from "../../../../../../lib/bot-api";
export async function DELETE(_: Request, { params }: { params: { id: string; roleId: string } }) {
  const response = await botFetch(`/guilds/${params.id}/roles/${params.roleId}`, {
    method: "DELETE",
  });
  return NextResponse.json(await response.json(), { status: response.status });
}
