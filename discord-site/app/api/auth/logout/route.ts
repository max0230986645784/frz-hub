import { NextResponse } from "next/server";
import { clearSession } from "../../../../lib/session";
export async function GET(request: Request) {
  clearSession();
  return NextResponse.redirect(new URL("/", request.url));
}
