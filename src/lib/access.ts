import "server-only";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { isServiceable, subscriptionInfo, type SubInfo } from "@/lib/subscription";
import type { MemberRole, Prisma } from "@/generated/prisma/client";

export const ORG_COOKIE = "srp_org";

export interface Access {
  user: { id: string; email: string; name: string | null; isPlatformOwner: boolean };
  org: { id: string; name: string; status: "ACTIVE" | "SUSPENDED" };
  role: MemberRole;
  /** True when a platform owner is looking at a client account they are not a member of. */
  viaPlatform: boolean;
  /** null means every branch in the organization. */
  branchIds: string[] | null;
  sub: SubInfo;
  plan: { name: string; maxBranches: number };
  memberships: { orgId: string; orgName: string }[];
}

export const requireUser = cache(async () => {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
});

/**
 * Resolves which client account the request acts on and what the user may see.
 * The active account comes from a cookie but is always re-checked against the
 * user's memberships, so a tampered cookie cannot grant access.
 */
export const getAccess = cache(async (): Promise<Access | null> => {
  const user = await requireUser();
  const memberships = await db.membership.findMany({
    where: { userId: user.id },
    include: { organization: true, branches: { select: { branchId: true } } },
    orderBy: { createdAt: "asc" },
  });
  const wanted = (await cookies()).get(ORG_COOKIE)?.value;

  let membership = memberships.find((m) => m.organizationId === wanted) ?? null;
  let orgId: string | null = membership?.organizationId ?? null;
  let viaPlatform = false;
  if (!membership && wanted && user.isPlatformOwner) {
    const exists = await db.organization.findUnique({ where: { id: wanted }, select: { id: true } });
    if (exists) {
      orgId = exists.id;
      viaPlatform = true;
    }
  }
  if (!orgId && memberships[0]) {
    membership = memberships[0];
    orgId = membership.organizationId;
  }
  if (!orgId) return null;

  const org = await db.organization.findUnique({ where: { id: orgId }, include: { subscription: true } });
  if (!org) return null;

  let branchIds: string[] | null = null;
  const role: MemberRole = viaPlatform ? "CLIENT_OWNER" : membership!.role;
  if (role === "BRANCH_ADMIN") {
    const assigned = membership!.branches.map((b) => b.branchId);
    const live = await db.branch.findMany({
      where: { id: { in: assigned }, organizationId: org.id, archivedAt: null },
      select: { id: true },
    });
    branchIds = live.map((b) => b.id);
  }

  return {
    user: { id: user.id, email: user.email, name: user.name, isPlatformOwner: user.isPlatformOwner },
    org: { id: org.id, name: org.name, status: org.status },
    role,
    viaPlatform,
    branchIds,
    sub: subscriptionInfo(org.subscription),
    plan: { name: org.subscription?.planName ?? "Starter", maxBranches: org.subscription?.maxBranches ?? 0 },
    memberships: memberships.map((m) => ({ orgId: m.organizationId, orgName: m.organization.name })),
  };
});

export function isLocked(a: Access): boolean {
  return a.org.status === "SUSPENDED" || !isServiceable(a.sub.state);
}

/**
 * Guard for every dashboard page and server action.
 * Locked accounts only reach the renewal screen (platform owners can still look in).
 */
export async function requireAccess(opts: { ownerOnly?: boolean; allowLocked?: boolean } = {}): Promise<Access> {
  const access = await getAccess();
  if (!access) {
    const user = await requireUser();
    redirect(user.isPlatformOwner ? "/platform" : "/login?error=no-access");
  }
  if (!opts.allowLocked && isLocked(access) && !access.viaPlatform) redirect("/dashboard/locked");
  if (opts.ownerOnly && access.role !== "CLIENT_OWNER") notFound();
  return access;
}

export async function requirePlatformOwner() {
  const user = await requireUser();
  if (!user.isPlatformOwner) notFound();
  return user;
}

/** Where-clause for reviews the user may see. Use for every review query. */
export function reviewScope(a: Access): Prisma.ReviewWhereInput {
  return {
    organizationId: a.org.id,
    archivedAt: null,
    ...(a.branchIds ? { branchId: { in: a.branchIds } } : {}),
  };
}

/** Where-clause for branches the user may see. */
export function branchScope(a: Access): Prisma.BranchWhereInput {
  return {
    organizationId: a.org.id,
    archivedAt: null,
    ...(a.branchIds ? { id: { in: a.branchIds } } : {}),
  };
}

export function actorName(a: Access): string {
  return a.user.name ?? a.user.email;
}
