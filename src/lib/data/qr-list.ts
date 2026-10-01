import "server-only";
import { db } from "@/lib/db";
import { businessTypeOf } from "@/lib/business-type";
import { defaultHeadline, staffHeadline } from "@/lib/card-text";
import { qrUrl } from "@/lib/env";
import { qrPath } from "@/lib/qr";
import { readableBrandColor } from "@/lib/contrast";
import type { CardData } from "@/lib/qr-card";

export type QrFilter = "all" | "BRANCH" | "TABLE" | "STAFF";

/** QR codes of one branch in the caller's organization, ready to render as cards. */
export async function branchStands(organizationId: string, branchId: string, kind: QrFilter) {
  const branch = await db.branch.findFirst({ where: { id: branchId, organizationId, archivedAt: null }, include: { business: true } });
  if (!branch) return null;
  const codes = await db.qrCode.findMany({
    // Removed staff drop out of the studio; their printed codes keep working as branch codes.
    where: { branchId: branch.id, organizationId, ...(kind !== "all" ? { kind } : {}), OR: [{ staffId: null }, { staff: { removedAt: null } }] },
    include: { staff: true },
    orderBy: { createdAt: "asc" },
  });
  const order = { BRANCH: 0, TABLE: 1, STAFF: 2 } as const;
  codes.sort((x, y) => order[x.kind] - order[y.kind] || (Number(x.tableLabel) || 0) - (Number(y.tableLabel) || 0));
  const business = branch.business;
  const type = businessTypeOf(business);
  const color = readableBrandColor(business.brandColor).color;
  const logoUrl = business.logoVersion > 0 ? `/api/logo/${business.id}?v=${business.logoVersion}` : null;
  const fallback = defaultHeadline(type);
  const headline = { en: business.qrHeadline ?? fallback.en, hi: business.qrHeadlineHi ?? fallback.hi };
  return {
    branch,
    stands: codes.map((c): CardData => {
      const url = qrUrl(c.code);
      const staff = c.kind === "STAFF" && c.staff ? c.staff : null;
      return {
        id: c.id,
        kind: c.kind,
        code: c.code,
        url,
        qr: qrPath(url),
        type,
        businessName: business.name,
        branchName: branch.name,
        color,
        logoUrl,
        headline: staff ? staffHeadline(type, staff.name) : headline,
        label: c.kind === "TABLE" ? `Table ${c.tableLabel}` : null,
        staff: staff ? { name: staff.name, designation: staff.designation, photoUrl: staff.photoKey ? `/api/staff-photo/${staff.id}?v=${staff.photoVersion}` : null } : null,
      };
    }),
  };
}
