import { NextResponse } from "next/server";
import { botFetch } from "../../../../../lib/bot-api";
export async function GET(_: Request, { params }: { params: { id: string } }) { const response = await botFetch(`/guilds/${params.id}/invites`); return NextResponse.json(await response.json(), { status: response.status }); }
export async function POST(request: Request, { params }: { params: { id: string } }) { const response = await botFetch(`/guilds/${params.id}/invites`, { method: "POST", body: await request.text() }); return NextResponse.json(await response.json(), { status: response.status }); }
