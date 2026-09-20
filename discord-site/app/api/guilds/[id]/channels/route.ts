import { NextResponse } from "next/server";
import { botFetch } from "../../../../../lib/bot-api";
export async function GET(_: Request, { params }: { params: { id: string } }) {
  const data = await (await botFetch(`/guilds/${params.id}`)).json();
  return NextResponse.json(data.channels ?? [], { status: 200 });
}
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const response = await botFetch(`/guilds/${params.id}/channels`, {
    method: "POST",
    body: await request.text(),
  });
  return NextResponse.json(await response.json(), { status: response.status });
}
