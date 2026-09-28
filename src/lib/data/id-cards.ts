import "server-only";
import type { Access } from "@/lib/access";
import { readableBrandColor } from "@/lib/contrast";
import { decryptField } from "@/lib/crypto";
import { db } from "@/lib/db";
import { qrUrl } from "@/lib/env";
import { shortDate } from "@/lib/format";
import { qrPath } from "@/lib/qr";

export const MAX_CARDS = 90;

/** Everything printed on the ID cards of the given staff, limited to the caller's account. */
export async function loadIdCards(a: Access, ids: string[]) {
  const staff = await db.staff.findMany({
    where: { id: { in: ids.slice(0, MAX_CARDS) }, organizationId: a.org.id, active: true, branch: { archivedAt: null } },
    include: { branch: { include: { business: true } }, qrCodes: { where: { kind: "STAFF" }, take: 1 } },
    orderBy: [{ branch: { name: "asc" } }, { name: "asc" }],
  });
  return staff.map((s) => {
    const b = s.branch.business;
    const qr = s.qrCodes[0];
    const url = qr ? qrUrl(qr.code) : null;
    return {
      id: s.id,
      name: s.name,
      designation: s.designation,
      employeeCode: s.employeeCode,
      bloodGroup: s.bloodGroup,
      validUntil: s.validUntil ? shortDate(s.validUntil) : null,
      emergency: decryptField(s.emergencyContactEnc),
      photoUrl: s.photoKey ? `/api/staff-photo/${s.id}?v=${s.photoVersion}` : null,
      branchName: s.branch.name,
      cityArea: s.branch.cityArea,
      business: { id: b.id, name: b.name, address: b.address, logoUrl: b.logoVersion > 0 ? `/api/logo/${b.id}?v=${b.logoVersion}` : null, color: readableBrandColor(b.brandColor).color },
      qr: url ? { url, path: qrPath(url) } : null,
    };
  });
}

export type IdCardData = Awaited<ReturnType<typeof loadIdCards>>[number];
