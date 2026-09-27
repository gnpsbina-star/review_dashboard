import "server-only";
import { cookies } from "next/headers";
import { keyedHash, randomToken } from "@/lib/crypto";

export const DEVICE_COOKIE = "srp_device";

/**
 * Identifies a customer's phone for anti-spam limits: an httpOnly cookie plus a
 * token the page keeps in localStorage. Either one matching counts as the same device.
 * Only keyed hashes are stored.
 */
export async function deviceHashes(clientToken: string | undefined): Promise<{ hashes: string[]; primary: string; newCookie: string | null }> {
  const store = await cookies();
  let cookie = store.get(DEVICE_COOKIE)?.value ?? null;
  let newCookie: string | null = null;
  if (!cookie || cookie.length > 64) {
    cookie = randomToken(18);
    newCookie = cookie;
  }
  const hashes = [keyedHash(`c:${cookie}`)];
  if (clientToken && /^[A-Za-z0-9-]{16,64}$/.test(clientToken)) hashes.push(keyedHash(`t:${clientToken}`));
  return { hashes, primary: hashes[hashes.length - 1], newCookie };
}

export function deviceCookieOptions() {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 365 };
}
