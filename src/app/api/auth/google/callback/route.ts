import { decodeIdToken } from "arctic";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { googleClient, OAUTH_STATE_COOKIE, OAUTH_VERIFIER_COOKIE } from "@/lib/auth/google";
import { createSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { resolveAllowedUser } from "@/lib/auth/signin";
import { safeEqual } from "@/lib/crypto";
import { env } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { keyedHash } from "@/lib/crypto";

function fail(reason: string) {
  const res = NextResponse.redirect(new URL(`/login?error=${reason}`, env().APP_URL));
  res.cookies.delete(OAUTH_STATE_COOKIE);
  res.cookies.delete(OAUTH_VERIFIER_COOKIE);
  return res;
}

export async function GET(req: NextRequest) {
  const google = googleClient();
  if (!google) return fail("google-not-configured");

  const ip = await clientIp();
  if (!(await rateLimit(`login:${keyedHash(ip ?? "unknown")}`, 30, 15 * 60_000))) return fail("too-many-attempts");

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const store = await cookies();
  const savedState = store.get(OAUTH_STATE_COOKIE)?.value;
  const verifier = store.get(OAUTH_VERIFIER_COOKIE)?.value;
  if (!code || !state || !savedState || !verifier || !safeEqual(state, savedState)) return fail("expired");

  let claims: { email?: string; email_verified?: boolean; name?: string };
  try {
    const tokens = await google.validateAuthorizationCode(code, verifier);
    claims = decodeIdToken(tokens.idToken()) as typeof claims;
  } catch {
    return fail("google-error");
  }
  if (!claims.email || claims.email_verified !== true) return fail("unverified");

  const userId = await resolveAllowedUser(claims.email, claims.name ?? null);
  if (!userId) return fail("not-invited");

  const { token, expiresAt } = await createSession(userId);
  const res = NextResponse.redirect(new URL("/dashboard", env().APP_URL));
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
  res.cookies.delete(OAUTH_STATE_COOKIE);
  res.cookies.delete(OAUTH_VERIFIER_COOKIE);
  return res;
}
