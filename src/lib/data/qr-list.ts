import "server-only";
import { db } from "@/lib/db";
import { qrUrl } from "@/lib/env";
import { qrPath } from "@/lib/qr";
import { readableBrandColor } from "@/lib/contrast";

export type QrFilter = "all" | "BRANCH" | "TABLE" | "STAFF";

/** QR codes of one branch in the caller's organization, ready to render as stands. */
export async function branchStands(organizationId: string, branchId: string, kind: QrFilter) {
  const branch = await db.branch.findFirst({ where: { id: branchId, organizationId, archivedAt: null }, include: { business: true } });
  if (!branch) return null;
  const codes = await db.qrCode.findMany({
    where: { branchId: branch.id, organizationId, ...(kind !== "all" ? { kind } : {}) },
    include: { staff: true },
    orderBy: { createdAt: "asc" },
  });
  const order = { BRANCH: 0, TABLE: 1, STAFF: 2 } as const;
  codes.sort((x, y) => order[x.kind] - order[y.kind] || (Number(x.tableLabel) || 0) - (Number(y.tableLabel) || 0));
  const color = readableBrandColor(branch.business.brandColor).color;
  const logoUrl = branch.business.logoVersion > 0 ? `/api/logo/${branch.business.id}?v=${branch.business.logoVersion}` : null;
  return {
    branch,
    stands: codes.map((c) => {
      const url = qrUrl(c.code);
      return {
        id: c.id,
        code: c.code,
        kind: c.kind,
        url,
        path: qrPath(url),
        label: c.kind === "TABLE" ? `Table ${c.tableLabel}` : c.kind === "STAFF" ? (c.staff?.name ?? "Staff") : branch.name,
        businessName: branch.business.name,
        branchName: branch.name,
        color,
        logoUrl,
      };
    }),
  };
}
