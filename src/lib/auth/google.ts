import "server-only";
import { Google } from "arctic";
import { env } from "@/lib/env";

export function googleClient(): Google | null {
  const e = env();
  if (!e.GOOGLE_CLIENT_ID || !e.GOOGLE_CLIENT_SECRET) return null;
  return new Google(e.GOOGLE_CLIENT_ID, e.GOOGLE_CLIENT_SECRET, `${e.APP_URL.replace(/\/$/, "")}/api/auth/google/callback`);
}

export const OAUTH_STATE_COOKIE = "srp_oauth_state";
export const OAUTH_VERIFIER_COOKIE = "srp_oauth_verifier";

export function oauthCookieOptions() {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: 600 };
}
