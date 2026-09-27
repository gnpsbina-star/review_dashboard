"use server";

import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actorName, ORG_COOKIE, requireAccess, requireUser, reviewScope, type Access } from "@/lib/access";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";

const Id = z.string().regex(/^[a-z0-9]{10,40}$/);

/** Loads a complaint the current user is allowed to act on, or 404s. */
async function scopedReview(a: Access, id: string) {
  const parsed = Id.safeParse(id);
  if (!parsed.success) notFound();
  const review = await db.review.findFirst({ where: { id: parsed.data, ...reviewScope(a) } });
  if (!review) notFound();
  return review;
}

export async function switchOrg(form: FormData) {
  const user = await requireUser();
  const orgId = Id.safeParse(form.get("orgId"));
  if (!orgId.success) notFound();
  const member = await db.membership.findUnique({ where: { userId_organizationId: { userId: user.id, organizationId: orgId.data } } });
  if (!member && !user.isPlatformOwner) notFound();
  (await cookies()).set(ORG_COOKIE, orgId.data, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 90 });
  redirect("/dashboard");
}

const Status = z.enum(["NEW", "CONTACTED", "RESOLVED"]);

export async function setReviewStatus(form: FormData) {
  const a = await requireAccess();
  const review = await scopedReview(a, String(form.get("reviewId")));
  const status = Status.parse(form.get("status"));
  if (review.source !== "INTERCEPTED" || review.status === status) return;
  const now = new Date();
  await db.review.update({
    where: { id: review.id },
    data: {
      status,
      contactedAt: status !== "NEW" ? (review.contactedAt ?? now) : review.contactedAt,
      resolvedAt: status === "RESOLVED" ? now : null,
    },
  });
  await db.resolutionNote.create({
    data: { organizationId: a.org.id, reviewId: review.id, authorUserId: a.user.id, authorName: actorName(a), text: `Changed status to ${status.charAt(0) + status.slice(1).toLowerCase()}.` },
  });
  await audit({ organizationId: a.org.id, actorUserId: a.user.id, actorEmail: a.user.email, action: "review.status", entity: "Review", entityId: review.id, meta: { from: review.status, to: status } });
  revalidatePath("/dashboard", "layout");
}

const NoteText = z.string().trim().min(1).max(2000);

export async function addNote(form: FormData) {
  const a = await requireAccess();
  const review = await scopedReview(a, String(form.get("reviewId")));
  const text = NoteText.safeParse(form.get("text"));
  if (!text.success) return;
  await db.resolutionNote.create({ data: { organizationId: a.org.id, reviewId: review.id, authorUserId: a.user.id, authorName: actorName(a), text: text.data } });
  revalidatePath("/dashboard");
}

const Channel = z.enum(["whatsapp", "call", "email", "followup"]);
const CHANNEL_NOTE: Record<z.infer<typeof Channel>, string> = {
  whatsapp: "Opened WhatsApp to message the customer.",
  call: "Called the customer.",
  email: "Opened an email to the customer.",
  followup: "Sent the thank-you follow-up with the Google review link.",
};

/** Records that someone reached out, and moves a New complaint to Contacted. */
export async function logContact(reviewId: string, channel: string) {
  const a = await requireAccess();
  const review = await scopedReview(a, reviewId);
  const ch = Channel.parse(channel);
  if (review.source !== "INTERCEPTED") return;
  await db.resolutionNote.create({ data: { organizationId: a.org.id, reviewId: review.id, authorUserId: a.user.id, authorName: actorName(a), text: CHANNEL_NOTE[ch] } });
  if (review.status === "NEW") {
    await db.review.update({ where: { id: review.id }, data: { status: "CONTACTED", contactedAt: new Date() } });
  }
  await audit({ organizationId: a.org.id, actorUserId: a.user.id, actorEmail: a.user.email, action: `review.contact.${ch}`, entity: "Review", entityId: review.id });
  revalidatePath("/dashboard", "layout");
}

export async function archiveReview(form: FormData) {
  const a = await requireAccess({ ownerOnly: true });
  const review = await scopedReview(a, String(form.get("reviewId")));
  await db.review.update({ where: { id: review.id }, data: { archivedAt: new Date() } });
  await audit({ organizationId: a.org.id, actorUserId: a.user.id, actorEmail: a.user.email, action: "review.archive", entity: "Review", entityId: review.id });
  revalidatePath("/dashboard", "layout");
  redirect(`/dashboard?archived=${review.id}`);
}

export async function restoreReview(form: FormData) {
  const a = await requireAccess({ ownerOnly: true });
  const id = Id.safeParse(form.get("reviewId"));
  if (!id.success) notFound();
  const review = await db.review.findFirst({ where: { id: id.data, organizationId: a.org.id, archivedAt: { not: null } } });
  if (!review) notFound();
  await db.review.update({ where: { id: review.id }, data: { archivedAt: null } });
  await audit({ organizationId: a.org.id, actorUserId: a.user.id, actorEmail: a.user.email, action: "review.restore", entity: "Review", entityId: review.id });
  revalidatePath("/dashboard", "layout");
  redirect(`/dashboard?review=${review.id}`);
}

/** Permanent delete: Client Owner only, and only for a review already archived. */
export async function deleteReview(form: FormData) {
  const a = await requireAccess({ ownerOnly: true });
  const id = Id.safeParse(form.get("reviewId"));
  if (!id.success) notFound();
  const review = await db.review.findFirst({ where: { id: id.data, organizationId: a.org.id, archivedAt: { not: null } } });
  if (!review) notFound();
  await db.review.delete({ where: { id: review.id } });
  await audit({ organizationId: a.org.id, actorUserId: a.user.id, actorEmail: a.user.email, action: "review.delete", entity: "Review", entityId: review.id });
  revalidatePath("/dashboard", "layout");
  redirect("/dashboard?deleted=1");
}
