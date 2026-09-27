import { db } from "@/lib/db";
import { encryptField } from "@/lib/crypto";
import { newShortCode } from "@/lib/shortcode";

/** Empties every table between tests. Only ever runs against the *_test database. */
export async function resetDb() {
  if (!/test/.test(process.env.DATABASE_URL ?? "")) throw new Error("Not a test database");
  const tables = await db.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
}

const DAY = 86_400_000;

/** A client account with one business, two branches, an owner and a branch admin (assigned to branch 1 only). */
export async function makeTenant(name: string, opts: { periodEnd?: Date | null; trialEnd?: Date | null } = {}) {
  const org = await db.organization.create({
    data: {
      name,
      subscription: { create: { planName: "Growth", maxBranches: 5, currentPeriodEnd: opts.periodEnd === undefined ? new Date(Date.now() + 200 * DAY) : opts.periodEnd, trialEndsAt: opts.trialEnd ?? null } },
    },
  });
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const owner = await db.user.create({ data: { email: `owner@${slug}.test`, name: `${name} Owner` } });
  const admin = await db.user.create({ data: { email: `admin@${slug}.test`, name: `${name} Admin` } });
  await db.membership.create({ data: { userId: owner.id, organizationId: org.id, role: "CLIENT_OWNER", receiveAllAlerts: true } });
  const adminM = await db.membership.create({ data: { userId: admin.id, organizationId: org.id, role: "BRANCH_ADMIN" } });
  const business = await db.business.create({ data: { organizationId: org.id, name: `${name} Cafe`, category: "Cafe" } });
  const mk = (n: string) =>
    db.branch.create({ data: { organizationId: org.id, businessId: business.id, name: n, slug: `${slug}-${n.toLowerCase()}`, cityArea: "Bengaluru", googleReviewUrl: "https://search.google.com/local/writereview?placeid=X", languages: ["en"] } });
  const b1 = await mk("One");
  const b2 = await mk("Two");
  await db.branchAssignment.create({ data: { membershipId: adminM.id, branchId: b1.id } });
  const qr1 = await db.qrCode.create({ data: { code: newShortCode(), organizationId: org.id, branchId: b1.id, kind: "BRANCH", key: "branch" } });
  const complaint = (branchId: string, text: string) =>
    db.review.create({ data: { organizationId: org.id, branchId, rating: 2, source: "INTERCEPTED", status: "NEW", comment: text, customerPhoneEnc: encryptField("9876543210"), contactConsent: true } });
  const r1 = await complaint(b1.id, `${name} complaint at branch one`);
  const r2 = await complaint(b2.id, `${name} complaint at branch two`);
  return { org, owner, admin, business, b1, b2, qr1, r1, r2 };
}
