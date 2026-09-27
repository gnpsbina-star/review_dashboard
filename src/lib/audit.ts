import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export interface AuditEntry {
  organizationId?: string | null;
  actorUserId?: string | null;
  actorEmail?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  meta?: Prisma.InputJsonValue;
}

/** Records who did what. Never store customer personal data in `meta`. */
export async function audit(entry: AuditEntry): Promise<void> {
  await db.auditLog.create({ data: entry });
}
