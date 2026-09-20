import { NextResponse } from "next/server";
import { botJson } from "../../../../lib/bot-api";
export async function GET(_: Request, { params }: { params: { id: string } }) {
  const result = await botJson(`/guilds/${params.id}`);
  return NextResponse.json(result ?? { error: "Le bot est hors ligne" }, {
    status: result ? 200 : 503,
  });
}
