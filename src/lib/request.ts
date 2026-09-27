import "server-only";
import { headers } from "next/headers";
import { env } from "@/lib/env";

/**
 * Client IP as set by the hosting platform (Vercel overwrites these headers, so
 * clients can't spoof them). Used only in hashed form, for rate limits.
 */
export async function clientIp(): Promise<string | null> {
  const h = await headers();
  const ip = h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0];
  return ip?.trim().slice(0, 64) || null;
}

/** CSRF defence for plain route handlers: the request must come from our own site. */
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(env().APP_URL).origin;
  } catch {
    return false;
  }
}
