import "server-only";
import { headers } from "next/headers";
import { env } from "@/lib/env";

/** Client IP as reported by the hosting proxy (Vercel / Cloudflare). Used only in hashed form. */
export async function clientIp(): Promise<string | null> {
  const h = await headers();
  const ip = h.get("cf-connecting-ip") ?? h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0];
  return ip?.trim() || null;
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
