import { beforeEach, describe, expect, it } from "vitest";
import { NotFoundError, RedirectError } from "../support/next-mocks";
import { makeTenant, resetDb } from "../support/db";
import { signInAs } from "../support/session";
import { addNote, archiveReview, logContact, setReviewStatus, switchOrg } from "@/app/dashboard/actions";
import { archiveBranch, updateBusiness } from "@/app/dashboard/businesses/actions";
import { removeMember } from "@/app/dashboard/team/actions";
import { renewYear } from "@/app/platform/actions";
import { getAccess, reviewScope } from "@/lib/access";
import { db } from "@/lib/db";

function form(values: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  return f;
}

let A: Awaited<ReturnType<typeof makeTenant>>;
let B: Awaited<ReturnType<typeof makeTenant>>;

beforeEach(async () => {
  await resetDb();
  A = await makeTenant("Alpha");
  B = await makeTenant("Bravo");
});

describe("tenant isolation", () => {
  it("an owner only sees their own account's reviews", async () => {
    await signInAs(A.owner.id);
    const access = (await getAccess())!;
    const visible = await db.review.findMany({ where: reviewScope(access) });
    expect(visible.map((r) => r.id).sort()).toEqual([A.r1.id, A.r2.id].sort());
  });

  it("a branch admin only sees assigned branches", async () => {
    await signInAs(A.admin.id);
    const access = (await getAccess())!;
    expect(access.role).toBe("BRANCH_ADMIN");
    const visible = await db.review.findMany({ where: reviewScope(access) });
    expect(visible.map((r) => r.id)).toEqual([A.r1.id]);
  });

  it("a forged account cookie does not grant access to another client", async () => {
    await signInAs(A.owner.id, B.org.id);
    const access = (await getAccess())!;
    expect(access.org.id).toBe(A.org.id);
    await expect(switchOrg(form({ orgId: B.org.id }))).rejects.toBeInstanceOf(NotFoundError);
  });

  it("cannot change, note or archive another client's review", async () => {
    await signInAs(A.owner.id);
    await expect(setReviewStatus(form({ reviewId: B.r1.id, status: "RESOLVED" }))).rejects.toBeInstanceOf(NotFoundError);
    await expect(addNote(form({ reviewId: B.r1.id, text: "hi" }))).rejects.toBeInstanceOf(NotFoundError);
    await expect(archiveReview(form({ reviewId: B.r1.id }))).rejects.toBeInstanceOf(NotFoundError);
    await expect(logContact(B.r1.id, "call")).rejects.toBeInstanceOf(NotFoundError);
    const untouched = await db.review.findUniqueOrThrow({ where: { id: B.r1.id } });
    expect(untouched.status).toBe("NEW");
    expect(untouched.archivedAt).toBeNull();
    expect(await db.resolutionNote.count({ where: { reviewId: B.r1.id } })).toBe(0);
  });

  it("a branch admin cannot act on an unassigned branch in their own account", async () => {
    await signInAs(A.admin.id);
    await expect(setReviewStatus(form({ reviewId: A.r2.id, status: "RESOLVED" }))).rejects.toBeInstanceOf(NotFoundError);
    await setReviewStatus(form({ reviewId: A.r1.id, status: "CONTACTED" }));
    expect((await db.review.findUniqueOrThrow({ where: { id: A.r1.id } })).status).toBe("CONTACTED");
  });

  it("branch admins cannot use owner-only actions", async () => {
    await signInAs(A.admin.id);
    await expect(archiveReview(form({ reviewId: A.r1.id }))).rejects.toBeInstanceOf(NotFoundError);
    await expect(archiveBranch(form({ branchId: A.b1.id }))).rejects.toBeInstanceOf(NotFoundError);
    await expect(removeMember(form({ membershipId: "c".repeat(25) }))).rejects.toBeInstanceOf(NotFoundError);
  });

  it("owners cannot edit another client's business or branch", async () => {
    await signInAs(A.owner.id);
    const f = form({ businessId: B.business.id, name: "Hacked", category: "x", brandColor: "#000000", brandTone: "x", deviceLimitHours: "2" });
    await expect(updateBusiness(f)).rejects.toBeInstanceOf(NotFoundError);
    await expect(archiveBranch(form({ branchId: B.b1.id }))).rejects.toBeInstanceOf(NotFoundError);
    expect((await db.business.findUniqueOrThrow({ where: { id: B.business.id } })).name).toBe("Bravo Cafe");
  });

  it("clients cannot use platform-owner actions", async () => {
    await signInAs(A.owner.id);
    await expect(renewYear(form({ orgId: A.org.id }))).rejects.toBeInstanceOf(NotFoundError);
  });

  it("signed-out requests are sent to the login page", async () => {
    const { cookieJar } = await import("../support/next-mocks");
    cookieJar.clear();
    await expect(setReviewStatus(form({ reviewId: A.r1.id, status: "RESOLVED" }))).rejects.toBeInstanceOf(RedirectError);
  });

  it("a locked account can't act, and is sent to the renewal screen", async () => {
    await db.subscription.update({ where: { organizationId: A.org.id }, data: { currentPeriodEnd: new Date(Date.now() - 30 * 86_400_000) } });
    await signInAs(A.owner.id);
    await expect(setReviewStatus(form({ reviewId: A.r1.id, status: "RESOLVED" }))).rejects.toMatchObject({ url: "/dashboard/locked" });
  });

  it("removing a member revokes access immediately", async () => {
    await signInAs(A.owner.id);
    const m = await db.membership.findFirstOrThrow({ where: { userId: A.admin.id } });
    await expect(removeMember(form({ membershipId: m.id }))).rejects.toMatchObject({ url: "/dashboard/team?saved=removed" });
    expect(await db.session.count({ where: { userId: A.admin.id } })).toBe(0);
    await signInAs(A.admin.id).catch(() => undefined);
    // Even with a fresh session the whitelist no longer lets them into the account.
    expect(await getAccess()).toBeNull();
  });
});
