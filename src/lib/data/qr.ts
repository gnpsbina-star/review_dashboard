import "server-only";
import { db } from "@/lib/db";
import { newShortCode } from "@/lib/shortcode";
import type { QrKind } from "@/generated/prisma/client";

/** Creates a permanent code for a branch/table/staff member if it doesn't exist yet. Returns true if created. */
export async function createQrCode(
  branch: { id: string; organizationId: string },
  kind: QrKind,
  key: string,
  extra: { tableLabel?: string; staffId?: string } = {},
): Promise<boolean> {
  const existing = await db.qrCode.findUnique({ where: { branchId_key: { branchId: branch.id, key } } });
  if (existing) return false;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await db.qrCode.create({ data: { code: newShortCode(), organizationId: branch.organizationId, branchId: branch.id, kind, key, ...extra } });
      return true;
    } catch (e) {
      if (!(e instanceof Error && "code" in e && (e as { code: string }).code === "P2002")) throw e;
      // Either someone created the same code at the same moment, or the random short code collided.
      if (await db.qrCode.findUnique({ where: { branchId_key: { branchId: branch.id, key } } })) return false;
    }
  }
  throw new Error("Could not generate a unique QR code");
}
