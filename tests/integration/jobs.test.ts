import { beforeEach, describe, expect, it } from "vitest";
import "../support/next-mocks";
import { makeTenant, resetDb } from "../support/db";
import { GET as cron } from "@/app/api/cron/[job]/route";
import { refreshBranchSuggestions, sampleSuggestions } from "@/lib/ai/pool";
import { db } from "@/lib/db";
import { runEscalations, runRetention, runSubscriptionJobs } from "@/lib/jobs";

const DAY = 86_400_000;
beforeEach(resetDb);

describe("scheduled jobs", () => {
  it("rejects calls without the cron secret", async () => {
    const res = await cron(new Request("http://localhost/api/cron/daily", { headers: { authorization: "Bearer nope" } }), { params: Promise.resolve({ job: "daily" }) });
    expect(res.status).toBe(401);
  });

  it("escalates complaints that are still New after a day, once", async () => {
    const t = await makeTenant("Esc");
    await db.review.update({ where: { id: t.r1.id }, data: { createdAt: new Date(Date.now() - 2 * DAY) } });
    expect((await runEscalations()).escalated).toBe(1);
    expect((await db.review.findUniqueOrThrow({ where: { id: t.r1.id } })).escalatedAt).not.toBeNull();
    expect((await runEscalations()).escalated).toBe(0);
  });

  it("deletes a client's data 90 days after locking, and nothing else", async () => {
    const gone = await makeTenant("Gone", { periodEnd: new Date(Date.now() - 100 * DAY) });
    const kept = await makeTenant("Kept");
    const res = await runSubscriptionJobs();
    expect(res.purged).toBe(1);
    expect(await db.organization.findUnique({ where: { id: gone.org.id } })).toBeNull();
    expect(await db.review.count({ where: { organizationId: gone.org.id } })).toBe(0);
    expect(await db.review.count({ where: { organizationId: kept.org.id } })).toBe(2);
    expect(await db.auditLog.count({ where: { action: "organization.purge" } })).toBe(1);
  });

  it("removes customer contact details after 12 months", async () => {
    const t = await makeTenant("Old");
    await db.review.update({ where: { id: t.r1.id }, data: { createdAt: new Date(Date.now() - 400 * DAY), customerName: "Old Name" } });
    const res = await runRetention();
    expect(res.piiPurged).toBe(1);
    const r = await db.review.findUniqueOrThrow({ where: { id: t.r1.id } });
    expect(r).toMatchObject({ customerName: null, customerPhoneEnc: null, customerEmailEnc: null });
    expect(r.comment).toContain("complaint");
    expect((await db.review.findUniqueOrThrow({ where: { id: t.r2.id } })).customerPhoneEnc).not.toBeNull();
  });

  it("builds a suggestion pool of 50 per language and tier, replacing the old one", async () => {
    const t = await makeTenant("Pool");
    await db.branch.update({ where: { id: t.b1.id }, data: { languages: ["en", "hinglish"], highlights: ["masala chai", "samosa"] } });
    await refreshBranchSuggestions(t.b1.id);
    await refreshBranchSuggestions(t.b1.id);
    const counts = await db.aiSuggestion.groupBy({ by: ["language", "ratingTier"], where: { branchId: t.b1.id }, _count: true });
    expect(counts).toHaveLength(4);
    for (const c of counts) expect(c._count).toBe(50);
    const branch = await db.branch.findUniqueOrThrow({ where: { id: t.b1.id }, include: { business: true } });
    const noStaff = await sampleSuggestions(branch, 5, null);
    expect(noStaff.every((s) => !s.id.startsWith("tpl-"))).toBe(true);
    expect(noStaff.every((s) => !s.text.includes("{{staff}}"))).toBe(true);
    const withStaff = await sampleSuggestions(branch, 5, "Ravi", 100);
    expect(withStaff.some((s) => s.text.includes("Ravi"))).toBe(true);
    expect(withStaff.every((s) => !s.text.includes("{{staff}}"))).toBe(true);
  });

  it("serves fresh wording for the business type while the pool is being rewritten", async () => {
    const t = await makeTenant("Edu");
    await db.business.update({ where: { id: t.business.id }, data: { type: "COACHING", name: "Bright Minds" } });
    await refreshBranchSuggestions(t.b1.id);
    // Settings change after the pool was written: the old (cafe) pool is stale.
    await db.branch.update({ where: { id: t.b1.id }, data: { aiSettingsUpdatedAt: new Date(Date.now() + 1000), highlights: ["Experienced faculty"] } });
    const branch = await db.branch.findUniqueOrThrow({ where: { id: t.b1.id }, include: { business: true } });
    const shown = await sampleSuggestions(branch, 5, null, 100);
    expect(shown.length).toBeGreaterThan(10);
    expect(shown.every((s) => s.id.startsWith("tpl-"))).toBe(true);
    expect(shown.some((s) => s.text.includes("experienced faculty"))).toBe(true);
    expect(shown.some((s) => /parent|our child|our son|my daughter/i.test(s.text))).toBe(true);
    expect(shown.some((s) => /my studies|study|learnt|my doubts/i.test(s.text))).toBe(true);
  });
});
