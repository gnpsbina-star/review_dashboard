import "server-only";
import { refreshBranchSuggestions, REFRESH_EVERY_DAYS } from "@/lib/ai/pool";
import { ownerEmails } from "@/lib/alerts";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { shortDate } from "@/lib/format";
import { deletePhotos } from "@/lib/photos";
import { pruneRateLimits } from "@/lib/rate-limit";
import { deleteOrgStaffPhotos } from "@/lib/staff";
import { addDays, dueReminder, isServiceable, subscriptionInfo } from "@/lib/subscription";

const DAY = 86_400_000;

/** Complaints still New after a day: tell the account owners once. */
export async function runEscalations(now = new Date()) {
  const overdue = await db.review.findMany({
    where: { source: "INTERCEPTED", status: "NEW", escalatedAt: null, archivedAt: null, createdAt: { lt: new Date(now.getTime() - DAY) } },
    include: { branch: { include: { business: true } }, organization: { include: { subscription: true } } },
    take: 500,
  });
  const byOrg = new Map<string, typeof overdue>();
  for (const r of overdue) {
    if (r.organization.status !== "ACTIVE" || !isServiceable(subscriptionInfo(r.organization.subscription, now).state)) continue;
    byOrg.set(r.organizationId, [...(byOrg.get(r.organizationId) ?? []), r]);
  }
  for (const [orgId, list] of byOrg) {
    const to = await ownerEmails(orgId);
    await sendEmail({
      kind: "escalation",
      organizationId: orgId,
      to,
      subject: `${list.length} ${list.length === 1 ? "complaint has" : "complaints have"} waited over a day`,
      lines: [
        "These private complaints are still marked New after 24 hours:",
        ...list.slice(0, 20).map((r) => `• ${r.rating}★ at ${r.branch.business.name}, ${r.branch.name}${r.tableLabel ? `, Table ${r.tableLabel}` : ""}: “${(r.comment ?? "").slice(0, 120)}”`),
        "A quick call or WhatsApp message usually turns an unhappy customer around.",
      ],
      cta: { label: "Open complaints", url: `${env().APP_URL}/dashboard?type=private&status=NEW` },
    });
    await db.review.updateMany({ where: { id: { in: list.map((r) => r.id) } }, data: { escalatedAt: now } });
  }
  return { escalated: [...byOrg.values()].reduce((n, l) => n + l.length, 0) };
}

/** Renewal reminders, lock notices, deletion warnings and the 90-day purge. */
export async function runSubscriptionJobs(now = new Date()) {
  const orgs = await db.organization.findMany({ include: { subscription: true } });
  let reminders = 0, notices = 0, purged = 0;
  for (const org of orgs) {
    const sub = org.subscription;
    if (!sub) continue;
    const info = subscriptionInfo(sub, now);
    const url = `${env().APP_URL}/dashboard`;

    const due = dueReminder(sub, sub.remindersSent, now);
    if (due) {
      await sendEmail({
        kind: "renewal_reminder",
        organizationId: org.id,
        to: await ownerEmails(org.id),
        subject: `${info.state === "TRIAL" ? "Your free trial" : "Your yearly plan"} ends in ${due.days} ${due.days === 1 ? "day" : "days"}`,
        lines: [
          `${org.name}: your ${info.state === "TRIAL" ? "free trial" : "Smart Review yearly plan"} ends on ${shortDate(info.endsAt!)}.`,
          info.state === "TRIAL" ? "Contact Synergy Technologies to start your yearly plan and keep collecting reviews." : "Contact Synergy Technologies to renew. After the end date you have 7 days before the account locks.",
        ],
        cta: { label: "Open dashboard", url },
      });
      await db.subscription.update({ where: { id: sub.id }, data: { remindersSent: { push: due.key } } });
      reminders++;
    }

    const endKey = info.endsAt ? info.endsAt.toISOString().slice(0, 10) : "none";
    if (info.state === "LOCKED" && !sub.remindersSent.includes(`${endKey}:locked`)) {
      await sendEmail({
        kind: "locked_notice",
        organizationId: org.id,
        to: await ownerEmails(org.id),
        subject: `${org.name} is locked until you renew`,
        lines: [
          "Your plan has ended, so the dashboard is locked. Your QR codes now show customers a simple “Review us on Google” button.",
          `Your data is kept until ${shortDate(info.purgeAt!)}. Renew before then and everything comes back exactly as it was.`,
        ],
        cta: { label: "Open dashboard", url },
      });
      await db.subscription.update({ where: { id: sub.id }, data: { remindersSent: { push: `${endKey}:locked` } } });
      notices++;
    }

    if (info.state === "LOCKED" && info.purgeAt && info.purgeAt.getTime() - now.getTime() <= 7 * DAY && !sub.purgeWarningSentAt) {
      await sendEmail({
        kind: "purge_warning",
        organizationId: org.id,
        to: await ownerEmails(org.id),
        subject: `Your ${org.name} data will be deleted on ${shortDate(info.purgeAt)}`,
        lines: ["Your plan ended and the account has been locked for almost 90 days.", `Unless you renew, all reviews, QR codes and settings will be permanently deleted on ${shortDate(info.purgeAt)}.`],
        cta: { label: "Open dashboard", url },
      });
      await db.subscription.update({ where: { id: sub.id }, data: { purgeWarningSentAt: now } });
      notices++;
    }

    if (info.state === "PURGE_DUE") {
      await audit({ organizationId: org.id, action: "organization.purge", entity: "Organization", entityId: org.id, meta: { name: org.name, lockedAt: info.locksAt?.toISOString() ?? null } });
      await deletePhotos({ organizationId: org.id }); // stored files first; rows cascade below
      await deleteOrgStaffPhotos(org.id);
      await db.organization.delete({ where: { id: org.id } }); // cascades to all tenant data
      purged++;
    }
  }
  return { reminders, notices, purged };
}

/** DPDP retention: customer names and contact details go after 12 months. Also clears expired technical data. */
export async function runRetention(now = new Date()) {
  const cutoff = addDays(now, -365);
  const oldWithPhotos = await db.review.findMany({ where: { createdAt: { lt: cutoff }, photos: { some: {} } }, select: { id: true }, take: 1000 });
  const photosDeleted = oldWithPhotos.length ? await deletePhotos({ reviewIds: oldWithPhotos.map((r) => r.id) }) : 0;
  const pii = await db.review.updateMany({
    where: { createdAt: { lt: cutoff }, piiPurgedAt: null },
    data: { customerName: null, customerPhoneEnc: null, customerEmailEnc: null, ipHash: null, deviceHash: null, piiPurgedAt: now },
  });
  const sessions = await db.session.deleteMany({ where: { expiresAt: { lt: now } } });
  await pruneRateLimits();
  await db.emailLog.deleteMany({ where: { createdAt: { lt: addDays(now, -90) } } });
  return { piiPurged: pii.count, photosDeleted, sessionsDeleted: sessions.count };
}

/** Weekly suggestion refresh, a few branches per run to stay inside free AI limits. */
export async function runSuggestionRefresh(limit = 10, now = new Date()) {
  const stale = new Date(now.getTime() - REFRESH_EVERY_DAYS * DAY);
  const candidates = await db.branch.findMany({
    where: { archivedAt: null, organization: { status: "ACTIVE" } },
    include: { organization: { include: { subscription: true } } },
    orderBy: { suggestionsRefreshedAt: { sort: "asc", nulls: "first" } },
    take: 200,
  });
  const due = candidates
    .filter((b) => isServiceable(subscriptionInfo(b.organization.subscription, now).state))
    .filter((b) => !b.suggestionsRefreshedAt || b.suggestionsRefreshedAt < stale || b.aiSettingsUpdatedAt > b.suggestionsRefreshedAt)
    .slice(0, limit);
  const results = [];
  for (const b of due) {
    try {
      results.push(await refreshBranchSuggestions(b.id));
    } catch (e) {
      console.error(`[ai] refresh failed for ${b.id}`, e instanceof Error ? e.message : e);
    }
  }
  return { refreshed: results.length };
}
