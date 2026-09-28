import "server-only";
import { db } from "@/lib/db";

/**
 * Sliding-window limiter stored in Postgres (works on serverless without Redis).
 * Returns true when the action is allowed and records the hit.
 */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const since = new Date(Date.now() - windowMs);
  const count = await db.rateLimitHit.count({ where: { key, createdAt: { gte: since } } });
  if (count >= limit) return false;
  await db.rateLimitHit.create({ data: { key } });
  return true;
}

export async function pruneRateLimits(olderThanMs = 2 * 86_400_000) {
  await db.rateLimitHit.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - olderThanMs) } } });
}
