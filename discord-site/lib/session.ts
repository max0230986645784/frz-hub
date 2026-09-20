import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32)
    throw new Error("SESSION_SECRET doit contenir au moins 32 caractères.");
  return new TextEncoder().encode(value);
}
export type Session = {
  user: { id: string; username: string; avatar?: string };
  guilds: { id: string; name: string; owner?: boolean; permissions?: string }[];
};
export async function setSession(session: Session) {
  const token = await new SignJWT(session as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());
  cookies().set("mr_robot_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 604800,
    path: "/",
  });
}
export async function getSession(): Promise<Session | null> {
  const token = cookies().get("mr_robot_session")?.value;
  if (!token) return null;
  try {
    return (await jwtVerify(token, secret())).payload as unknown as Session;
  } catch {
    return null;
  }
}
export function clearSession() {
  cookies().set("mr_robot_session", "", { expires: new Date(0), path: "/" });
}
