import "server-only";
import { db } from "@/lib/db";
import { isShortCode } from "@/lib/shortcode";
import { isServiceable, subscriptionInfo } from "@/lib/subscription";

/** Everything the public review page needs for one QR code, or null if the code is unknown or retired. */
export async function loadQrContext(code: string) {
  if (!isShortCode(code)) return null;
  const qr = await db.qrCode.findUnique({
    where: { code },
    include: {
      staff: true,
      branch: { include: { business: true } },
      organization: { include: { subscription: true } },
    },
  });
  if (!qr || qr.branch.archivedAt || qr.branch.business.archivedAt) return null;
  const sub = subscriptionInfo(qr.organization.subscription);
  const serviceable = qr.organization.status === "ACTIVE" && isServiceable(sub.state);
  const staffName = qr.staff && qr.staff.active ? qr.staff.name : null;
  return { qr, branch: qr.branch, business: qr.branch.business, org: qr.organization, serviceable, staffName };
}

export type QrContext = NonNullable<Awaited<ReturnType<typeof loadQrContext>>>;
