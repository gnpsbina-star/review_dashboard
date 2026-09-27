import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "@/lib/db";
import { randomToken, sha256 } from "@/lib/crypto";

const SESSION_DAYS = 30;
const REFRESH_WHEN_DAYS_LEFT = 15;
const DAY = 86_400_000;

export const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-srp_session" : "srp_session";

export function sessionCookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires,
  };
}

/** Creates a session and returns the raw token for the cookie. Only its hash is stored. */
export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * DAY);
  await db.session.create({ data: { id: sha256(token), userId, expiresAt } });
  await db.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
  return { token, expiresAt };
}

export async function validateSessionToken(token: string) {
  const id = sha256(token);
  const session = await db.session.findUnique({ where: { id }, include: { user: true } });
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now() || session.user.disabledAt) {
    await db.session.deleteMany({ where: { id } });
    return null;
  }
  if (session.expiresAt.getTime() - Date.now() < REFRESH_WHEN_DAYS_LEFT * DAY) {
    session.expiresAt = new Date(Date.now() + SESSION_DAYS * DAY);
    await db.session.update({ where: { id }, data: { expiresAt: session.expiresAt } });
  }
  return session;
}

/** The signed-in user for this request, or null. Cached per request. */
export const getCurrentUser = cache(async () => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const session = await validateSessionToken(token);
  return session?.user ?? null;
});

export async function invalidateSessionToken(token: string) {
  await db.session.deleteMany({ where: { id: sha256(token) } });
}

/** Signs a user out everywhere, e.g. when they are removed from a team. */
export async function invalidateUserSessions(userId: string) {
  await db.session.deleteMany({ where: { userId } });
}
