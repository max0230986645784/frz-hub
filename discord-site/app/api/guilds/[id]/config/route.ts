import { NextResponse } from "next/server";
import { botFetch } from "../../../../../lib/bot-api";
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const response = await botFetch(`/guilds/${params.id}/config`, {
    method: "PUT",
    body: await request.text(),
  });
  return NextResponse.json(await response.json(), { status: response.status });
}
