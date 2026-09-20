import { NextResponse } from "next/server";
import { botFetch } from "../../../../../../lib/bot-api";
export async function DELETE(_: Request, { params }: { params: { id: string; channelId: string } }) { const response = await botFetch(`/guilds/${params.id}/channels/${params.channelId}`, { method: "DELETE" }); return NextResponse.json(await response.json(), { status: response.status }); }
