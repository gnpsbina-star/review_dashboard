"use server";

import { after } from "next/server";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAccess, type Access } from "@/lib/access";
import { audit } from "@/lib/audit";
import { invalidateUserSessions } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";

const Id = z.string().regex(/^[a-z0-9]{10,40}$/);
const Member = z.object({
  role: z.enum(["CLIENT_OWNER", "BRANCH_ADMIN"]),
  branchIds: z.array(Id).max(200),
  receiveAllAlerts: z.boolean(),
});

async function validBranches(a: Access, ids: string[]) {
  const rows = await db.branch.findMany({ where: { id: { in: ids }, organizationId: a.org.id, archivedAt: null }, select: { id: true } });
  return rows.map((r) => r.id);
}

function parseMember(form: FormData) {
  return Member.safeParse({
    role: form.get("role"),
    branchIds: form.getAll("branchIds").map(String),
    receiveAllAlerts: form.get("receiveAllAlerts") === "on",
  });
}

export async function inviteMember(form: FormData) {
  const a = await requireAccess({ ownerOnly: true });
  const email = z.string().trim().toLowerCase().email().max(200).safeParse(form.get("email"));
  const m = parseMember(form);
  if (!email.success || !m.success) redirect("/dashboard/team?error=invite");
  const branchIds = await validBranches(a, m.data.branchIds);
  if (m.data.role === "BRANCH_ADMIN" && branchIds.length === 0) redirect("/dashboard/team?error=invite");

  const user = await db.user.upsert({ where: { email: email.data }, create: { email: email.data }, update: {} });
  if (user.disabledAt) redirect("/dashboard/team?error=invite");
  const existing = await db.membership.findUnique({ where: { userId_organizationId: { userId: user.id, organizationId: a.org.id } } });
  if (existing) redirect(`/dashboard/team?error=invite`);
  const membership = await db.membership.create({
    data: {
      userId: user.id,
      organizationId: a.org.id,
      role: m.data.role,
      receiveAllAlerts: m.data.role === "CLIENT_OWNER" && m.data.receiveAllAlerts,
      branches: m.data.role === "BRANCH_ADMIN" ? { create: branchIds.map((branchId) => ({ branchId })) } : undefined,
    },
  });
  await audit({ organizationId: a.org.id, actorUserId: a.user.id, actorEmail: a.user.email, action: "team.invite", entity: "Membership", entityId: membership.id, meta: { email: email.data, role: m.data.role } });
  after(() =>
    sendEmail({
      kind: "team_invite",
      organizationId: a.org.id,
      to: [email.data],
      subject: `You’ve been added to ${a.org.name} on Smart Review Platform`,
      lines: [
        `${a.user.name ?? a.user.email} added you to ${a.org.name} as ${m.data.role === "CLIENT_OWNER" ? "a Client Owner" : "a Branch Admin"}.`,
        `Sign in with this Google account (${email.data}) to see reviews and reply to customers.`,
      ],
      cta: { label: "Sign in", url: `${env().APP_URL}/login` },
    }).catch(() => undefined),
  );
  revalidatePath("/dashboard/team");
  redirect("/dashboard/team?saved=invited");
}

async function scopedMembership(a: Access, id: unknown) {
  const parsed = Id.safeParse(id);
  if (!parsed.success) notFound();
  const m = await db.membership.findFirst({ where: { id: parsed.data, organizationId: a.org.id } });
  if (!m) notFound();
  return m;
}

async function ownerCount(orgId: string) {
  return db.membership.count({ where: { organizationId: orgId, role: "CLIENT_OWNER" } });
}

export async function updateMember(form: FormData) {
  const a = await requireAccess({ ownerOnly: true });
  const target = await scopedMembership(a, form.get("membershipId"));
  const m = parseMember(form);
  if (!m.success) redirect("/dashboard/team?error=invite");
  if (target.role === "CLIENT_OWNER" && m.data.role !== "CLIENT_OWNER" && (await ownerCount(a.org.id)) <= 1) redirect("/dashboard/team?error=last-owner");
  const branchIds = await validBranches(a, m.data.branchIds);
  if (m.data.role === "BRANCH_ADMIN" && branchIds.length === 0) redirect("/dashboard/team?error=invite");
  await db.$transaction([
    db.branchAssignment.deleteMany({ where: { membershipId: target.id } }),
    db.membership.update({
      where: { id: target.id },
      data: {
        role: m.data.role,
        receiveAllAlerts: m.data.role === "CLIENT_OWNER" && m.data.receiveAllAlerts,
        branches: m.data.role === "BRANCH_ADMIN" ? { create: branchIds.map((branchId) => ({ branchId })) } : undefined,
      },
    }),
  ]);
  await audit({ organizationId: a.org.id, actorUserId: a.user.id, actorEmail: a.user.email, action: "team.update", entity: "Membership", entityId: target.id, meta: { role: m.data.role } });
  revalidatePath("/dashboard/team");
  redirect("/dashboard/team?saved=1");
}

export async function removeMember(form: FormData) {
  const a = await requireAccess({ ownerOnly: true });
  const target = await scopedMembership(a, form.get("membershipId"));
  if (target.role === "CLIENT_OWNER" && (await ownerCount(a.org.id)) <= 1) redirect("/dashboard/team?error=last-owner");
  await db.membership.delete({ where: { id: target.id } });
  const remaining = await db.membership.count({ where: { userId: target.userId } });
  const user = await db.user.findUnique({ where: { id: target.userId } });
  // Access is re-checked on every request, so removal takes effect at once. With no accounts left, also end their sessions.
  if (remaining === 0 && !user?.isPlatformOwner) await invalidateUserSessions(target.userId);
  await audit({ organizationId: a.org.id, actorUserId: a.user.id, actorEmail: a.user.email, action: "team.remove", entity: "Membership", entityId: target.id, meta: { email: user?.email ?? null } });
  revalidatePath("/dashboard/team");
  redirect(target.userId === a.user.id ? "/login" : "/dashboard/team?saved=removed");
}
