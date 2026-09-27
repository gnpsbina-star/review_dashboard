import { NextResponse } from "next/server";
import { createSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { resolveAllowedUser } from "@/lib/auth/signin";
import { devLoginEnabled, env } from "@/lib/env";
import { isSameOrigin } from "@/lib/request";

/** Local development only: sign in as an invited email without Google. Disabled in production builds. */
export async function POST(req: Request) {
  if (!devLoginEnabled()) return new NextResponse("Not found", { status: 404 });
  if (!isSameOrigin(req)) return new NextResponse("Forbidden", { status: 403 });
  const form = await req.formData();
  const email = String(form.get("email") ?? "").slice(0, 200);
  const userId = email ? await resolveAllowedUser(email, null) : null;
  if (!userId) return NextResponse.redirect(new URL("/login?error=not-invited", env().APP_URL), 303);
  const { token, expiresAt } = await createSession(userId);
  const res = NextResponse.redirect(new URL("/dashboard", env().APP_URL), 303);
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
  return res;
}
