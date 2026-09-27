import { generateCodeVerifier, generateState } from "arctic";
import { NextResponse } from "next/server";
import { googleClient, OAUTH_STATE_COOKIE, OAUTH_VERIFIER_COOKIE, oauthCookieOptions } from "@/lib/auth/google";
import { env } from "@/lib/env";

export async function GET() {
  const google = googleClient();
  if (!google) return NextResponse.redirect(new URL("/login?error=google-not-configured", env().APP_URL));
  const state = generateState();
  const verifier = generateCodeVerifier();
  const url = google.createAuthorizationURL(state, verifier, ["openid", "profile", "email"]);
  url.searchParams.set("prompt", "select_account");
  const res = NextResponse.redirect(url);
  res.cookies.set(OAUTH_STATE_COOKIE, state, oauthCookieOptions());
  res.cookies.set(OAUTH_VERIFIER_COOKIE, verifier, oauthCookieOptions());
  return res;
}
