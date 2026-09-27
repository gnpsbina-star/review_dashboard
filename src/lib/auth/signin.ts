import "server-only";
import { db } from "@/lib/db";
import { platformOwnerEmails } from "@/lib/env";
import { audit } from "@/lib/audit";

/**
 * Whitelist check. A person may sign in only if they are a platform owner
 * (from PLATFORM_OWNER_EMAILS or the database) or were invited to a client account.
 * Returns the user id, or null when the email is not allowed.
 */
export async function resolveAllowedUser(rawEmail: string, name: string | null): Promise<string | null> {
  const email = rawEmail.trim().toLowerCase();
  const isOwnerByEnv = platformOwnerEmails().includes(email);
  const existing = await db.user.findUnique({
    where: { email },
    include: { memberships: { select: { id: true } } },
  });

  if (existing) {
    if (existing.disabledAt) return null;
    const allowed = existing.isPlatformOwner || isOwnerByEnv || existing.memberships.length > 0;
    if (!allowed) return null;
    await db.user.update({
      where: { id: existing.id },
      data: { name: existing.name ?? name, ...(isOwnerByEnv && !existing.isPlatformOwner ? { isPlatformOwner: true } : {}) },
    });
    return existing.id;
  }

  if (!isOwnerByEnv) return null;
  const user = await db.user.create({ data: { email, name, isPlatformOwner: true } });
  await audit({ actorUserId: user.id, actorEmail: email, action: "platform_owner.bootstrap", entity: "User", entityId: user.id });
  return user.id;
}
