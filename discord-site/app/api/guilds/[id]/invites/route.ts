import { NextResponse } from "next/server";
import { botFetch } from "../../../../../lib/bot-api";
import { requireGuildAccess } from "../../../../../lib/auth";
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const access = await requireGuildAccess(request, params.id);
  if ("response" in access) return access.response;
  const response = await botFetch(`/guilds/${params.id}/invites`);
  return NextResponse.json(await response.json(), { status: response.status });
}
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const access = await requireGuildAccess(request, params.id);
  if ("response" in access) return access.response;
  const response = await botFetch(`/guilds/${params.id}/invites`, {
    method: "POST",
    body: await request.text(),
  });
  return NextResponse.json(await response.json(), { status: response.status });
}
