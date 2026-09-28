import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { invalidateSessionToken, SESSION_COOKIE } from "@/lib/auth/session";
import { ORG_COOKIE } from "@/lib/access";
import { env } from "@/lib/env";
import { isSameOrigin } from "@/lib/request";

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return new NextResponse("Forbidden", { status: 403 });
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await invalidateSessionToken(token);
  const res = NextResponse.redirect(new URL("/login?signed-out=1", env().APP_URL), 303);
  res.cookies.delete(SESSION_COOKIE);
  res.cookies.delete(ORG_COOKIE);
  return res;
}
