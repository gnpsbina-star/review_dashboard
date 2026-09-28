import "server-only";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/email";

/** People who should hear about a complaint at this branch. */
export async function branchAlertRecipients(organizationId: string, branchId: string): Promise<string[]> {
  const members = await db.membership.findMany({
    where: {
      organizationId,
      user: { disabledAt: null },
      OR: [
        { role: "BRANCH_ADMIN", branches: { some: { branchId } } },
        { role: "CLIENT_OWNER", receiveAllAlerts: true },
      ],
    },
    select: { user: { select: { email: true } } },
  });
  if (members.length > 0) return members.map((m) => m.user.email);
  // Nobody assigned yet: fall back to the account owners so no complaint goes unseen.
  const owners = await db.membership.findMany({
    where: { organizationId, role: "CLIENT_OWNER", user: { disabledAt: null } },
    select: { user: { select: { email: true } } },
  });
  return owners.map((m) => m.user.email);
}

export async function ownerEmails(organizationId: string): Promise<string[]> {
  const owners = await db.membership.findMany({
    where: { organizationId, role: "CLIENT_OWNER", user: { disabledAt: null } },
    select: { user: { select: { email: true } } },
  });
  return owners.map((m) => m.user.email);
}

function describe(r: { rating: number; tableLabel: string | null; staffName: string | null }, businessName: string, branchName: string) {
  return [`${businessName} · ${branchName}`, `${r.rating} out of 5 stars`, r.tableLabel ? `Table ${r.tableLabel}` : null, r.staffName ? `Staff: ${r.staffName}` : null]
    .filter(Boolean)
    .join(" · ");
}

/** Emails the branch team about a new private complaint. Customer contact details stay in the dashboard. */
export async function sendComplaintAlert(reviewId: string) {
  const review = await db.review.findUnique({ where: { id: reviewId }, include: { branch: { include: { business: true } }, _count: { select: { photos: true } } } });
  if (!review || review.alertSentAt) return;
  const to = await branchAlertRecipients(review.organizationId, review.branchId);
  const excerpt = (review.comment ?? "").slice(0, 280);
  await sendEmail({
    kind: "complaint_alert",
    organizationId: review.organizationId,
    to,
    subject: `New ${review.rating}★ complaint at ${review.branch.business.name}, ${review.branch.name}`,
    lines: [
      describe(review, review.branch.business.name, review.branch.name),
      review.issues.length ? `About: ${review.issues.join(", ")}` : "",
      `“${excerpt}${(review.comment ?? "").length > 280 ? "…" : ""}”`,
      review._count.photos ? `The customer attached ${review._count.photos} ${review._count.photos === 1 ? "photo" : "photos"}. Open the dashboard to see them.` : "",
      review.customerPhoneEnc || review.customerEmailEnc ? "The customer left contact details and agreed to be contacted." : "The customer didn't leave contact details.",
    ].filter(Boolean),
    cta: { label: "Open in dashboard", url: `${env().APP_URL}/dashboard?review=${review.id}` },
  });
  await db.review.update({ where: { id: review.id }, data: { alertSentAt: new Date() } });
}
