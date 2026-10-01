/**
 * Seeds the platform owner and, when SEED_DEMO=true, a demo client account with
 * sample data. Run: npm run db:seed   (never enable SEED_DEMO in production)
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type SuggestionLang } from "../src/generated/prisma/client";
import { encryptField, keyedHash } from "../src/lib/crypto";
import { templateSuggestions } from "../src/lib/ai/templates";
import { guessType, TYPE_LABELS } from "../src/lib/business-type";
import { newShortCode } from "../src/lib/shortcode";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const DAY = 86_400_000;
const now = Date.now();
const ago = (minutes: number) => new Date(now - minutes * 60_000);

async function ensureUser(email: string, name: string, isPlatformOwner = false) {
  return db.user.upsert({ where: { email }, create: { email, name, isPlatformOwner }, update: {} });
}

async function qr(orgId: string, branchId: string, kind: "BRANCH" | "TABLE" | "STAFF", key: string, extra: { tableLabel?: string; staffId?: string } = {}) {
  return db.qrCode.create({ data: { code: newShortCode(), organizationId: orgId, branchId, kind, key, ...extra } });
}

async function main() {
  for (const email of (process.env.PLATFORM_OWNER_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)) {
    await ensureUser(email, "Platform Owner", true);
    console.log(`Platform owner: ${email}`);
  }
  if (process.env.SEED_DEMO !== "true") return;
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed demo data in production");
  if (await db.organization.findFirst({ where: { name: "Kesar Hospitality" } })) {
    console.log("Demo data already present.");
    return;
  }

  // ---- Demo client: Kesar Hospitality ----
  const org = await db.organization.create({
    data: {
      name: "Kesar Hospitality",
      subscription: { create: { planName: "Growth", maxBranches: 5, currentPeriodEnd: new Date(now + 166 * DAY) } },
    },
  });
  const owner = await ensureUser("owner@demo.test", "Vikram Rao");
  const manager = await ensureUser("meena@demo.test", "Meena Iyer");
  await db.membership.create({ data: { userId: owner.id, organizationId: org.id, role: "CLIENT_OWNER", receiveAllAlerts: true } });
  const mgrMembership = await db.membership.create({ data: { userId: manager.id, organizationId: org.id, role: "BRANCH_ADMIN" } });

  const kc = await db.business.create({
    data: { organizationId: org.id, name: "Kesar & Clove", type: "RESTAURANT", category: "Family restaurant", address: "100 Feet Road, Indiranagar, Bengaluru", brandColor: "#A84F06", brandTone: "Warm and friendly" },
  });
  const cb = await db.business.create({
    data: { organizationId: org.id, name: "Clove Bakehouse", type: "RESTAURANT", category: "Bakery and café", address: "27th Main, HSR Layout, Bengaluru", brandColor: "#1D5FA8", brandTone: "Casual and cheerful" },
  });
  const bm = await db.business.create({
    data: { organizationId: org.id, name: "Bright Minds Coaching", type: "COACHING", category: "NEET and JEE coaching", address: "9th Block, Jayanagar, Bengaluru", brandColor: "#5B2A86", brandTone: "Professional and caring", qrHeadline: null },
  });
  const langs: SuggestionLang[] = ["en", "hi", "hinglish"];
  const mk = (businessId: string, name: string, slug: string, cityArea: string, highlights: string[]) =>
    db.branch.create({
      data: { organizationId: org.id, businessId, name, slug, cityArea, languages: langs, highlights, googleReviewUrl: "https://search.google.com/local/writereview?placeid=DEMO_PLACE_ID", googlePlaceId: "DEMO_PLACE_ID", facebookReviewUrl: "https://www.facebook.com/demo.page/reviews" },
    });
  const ind = await mk(kc.id, "Indiranagar", "kesar-clove-indiranagar", "Indiranagar, Bengaluru", ["filter coffee", "paneer tikka", "quick service"]);
  const kor = await mk(kc.id, "Koramangala", "kesar-clove-koramangala", "Koramangala, Bengaluru", ["biryani", "filter coffee", "family seating"]);
  const hsr = await mk(cb.id, "HSR Layout", "clove-bakehouse-hsr", "HSR Layout, Bengaluru", ["croissants", "cold coffee", "cosy seating"]);
  const jay = await mk(bm.id, "Jayanagar", "bright-minds-jayanagar", "Jayanagar, Bengaluru", ["Experienced faculty", "Weekly tests", "Doubt-clearing sessions"]);
  await db.branchAssignment.create({ data: { membershipId: mgrMembership.id, branchId: ind.id } });

  const staff = async (branchId: string, names: string[]) =>
    Promise.all(names.map((name) => db.staff.create({ data: { organizationId: org.id, branchId, name } })));
  const [ravi, sana] = await staff(ind.id, ["Ravi", "Sana"]);
  const [meena, arjun] = await staff(kor.id, ["Meena", "Arjun"]);
  const [farhan] = await staff(hsr.id, ["Farhan"]);
  const [sharma, iyer] = await staff(jay.id, ["Mrs. Sharma", "Mr. Iyer"]);
  const roles: [typeof ravi, string, string, string][] = [
    [ravi, "KC-0001", "Senior Waiter", "B+"],
    [sana, "KC-0002", "Waiter", "O+"],
    [meena, "KC-0003", "Floor Manager", "A+"],
    [arjun, "KC-0004", "Waiter", "AB+"],
    [farhan, "CB-0001", "Barista", "O-"],
    [sharma, "BMC-0001", "Physics", "A+"],
    [iyer, "BMC-0002", "Chemistry", "B+"],
  ];
  for (const [s, code, designation, bloodGroup] of roles) {
    await db.staff.update({ where: { id: s.id }, data: { employeeCode: code, designation, bloodGroup, validUntil: new Date(now + 365 * DAY) } });
  }

  const codes: Record<string, string> = {};
  for (const b of [ind, kor, hsr, jay]) codes[b.id] = (await qr(org.id, b.id, "BRANCH", "branch")).id;
  for (let t = 1; t <= 12; t++) await qr(org.id, ind.id, "TABLE", `table:${t}`, { tableLabel: String(t) });
  for (const s of [ravi, sana, meena, arjun, farhan, sharma, iyer]) await qr(org.id, s.branchId, "STAFF", `staff:${s.id}`, { staffId: s.id });

  // Suggestion pools (templates; the AI provider replaces them on the weekly refresh).
  for (const b of [ind, kor, hsr, jay]) {
    const business = [kc, cb, bm].find((x) => x.id === b.businessId)!;
    const profile = { businessName: business.name, branchName: b.name, cityArea: b.cityArea, type: business.type!, category: business.category, highlights: b.highlights, tone: business.brandTone };
    for (const language of langs) {
      for (const tier of [4, 5] as const) {
        const texts = templateSuggestions(profile, language, tier, 50);
        await db.aiSuggestion.createMany({
          data: texts.map((text) => ({ organizationId: org.id, branchId: b.id, language, ratingTier: tier, text, mentionsStaff: text.includes("{{staff}}"), batchId: "seed" })),
        });
      }
    }
    await db.branch.update({ where: { id: b.id }, data: { suggestionsRefreshedAt: new Date() } });
  }

  // Sample reviews.
  type R = { b: typeof ind; r: number; m: number; complaint?: { text: string; issues: string[]; status: "NEW" | "CONTACTED" | "RESOLVED"; name?: string; phone?: string; email?: string }; staff?: { id: string; name: string }; table?: string; text?: string };
  const samples: R[] = [
    { b: ind, r: 2, m: 10, table: "12", staff: ravi, complaint: { text: "Waited 40 minutes for our main course and nobody told us why. The food was good once it came, but the wait spoiled the evening.", issues: ["Waiting time", "Service"], status: "NEW", name: "Ananya Sharma", phone: "9876543210" } },
    { b: kor, r: 5, m: 25, table: "3", staff: meena, text: "Paneer tikka ekdum mast tha aur filter coffee toh must-try hai! Meena ki service bhi bahut friendly thi." },
    { b: hsr, r: 1, m: 62, staff: farhan, complaint: { text: "The croissants were stale and I was charged twice at the counter. I only got the refund after asking two times.", issues: ["Food", "Billing"], status: "NEW", name: "Rohit Mehra", phone: "9123456780", email: "rohit.m@example.com" } },
    { b: ind, r: 4, m: 130, table: "7", staff: ravi, text: "Good food and friendly staff. The paneer tikka was the highlight. It got a little busy, but Ravi kept us updated." },
    { b: kor, r: 3, m: 300, table: "9", staff: arjun, complaint: { text: "The AC near our table wasn't working and it was very warm. Food was fine.", issues: ["Cleanliness"], status: "CONTACTED", phone: "9988776655" } },
    { b: hsr, r: 5, m: 1180, text: "यहाँ के क्रोइसां और कॉफ़ी दोनों बहुत अच्छे हैं। स्टाफ़ बहुत विनम्र है।" },
    { b: kor, r: 3, m: 1560, table: "14", complaint: { text: "The music was too loud to have a conversation. Please keep it lower in the evenings.", issues: ["Service"], status: "NEW" } },
    { b: ind, r: 2, m: 1720, table: "4", staff: ravi, complaint: { text: "The biryani was far too salty today. Usually it's great here.", issues: ["Food"], status: "RESOLVED", name: "Priya Nair", phone: "9000011122", email: "priya.n@example.com" } },
    { b: ind, r: 5, m: 1900, table: "2", staff: sana, text: "The filter coffee alone is worth the visit. Friendly team, spotless tables and the paneer tikka was perfectly smoky." },
  ];
  // Older history for analytics.
  for (let i = 0; i < 70; i++) {
    const b = [ind, kor, hsr][i % 3];
    const r = i % 11 === 0 ? 3 : i % 4 === 0 ? 4 : 5;
    samples.push({ b, r, m: 2 * 1440 + i * 800, text: r >= 4 ? "Lovely experience, will come again." : undefined, complaint: r <= 3 ? { text: "Service was slower than usual.", issues: ["Waiting time"], status: "RESOLVED" } : undefined });
  }
  for (const s of samples) {
    const review = await db.review.create({
      data: {
        organizationId: org.id,
        branchId: s.b.id,
        qrCodeId: codes[s.b.id],
        rating: s.r,
        source: s.complaint ? "INTERCEPTED" : "GOOGLE_REDIRECT",
        status: s.complaint?.status ?? null,
        comment: s.complaint?.text ?? s.text ?? null,
        issues: s.complaint?.issues ?? [],
        customerName: s.complaint?.name ?? null,
        customerPhoneEnc: s.complaint?.phone ? encryptField(s.complaint.phone) : null,
        customerEmailEnc: s.complaint?.email ? encryptField(s.complaint.email) : null,
        contactConsent: !!(s.complaint?.phone || s.complaint?.email),
        tableLabel: s.table ?? null,
        staffId: s.staff?.id ?? null,
        staffName: s.staff?.name ?? null,
        editedSuggestion: s.complaint ? null : s.m % 2 === 0,
        language: s.complaint ? null : "en",
        deviceHash: keyedHash(`seed-${s.m}`),
        createdAt: ago(s.m),
        alertSentAt: s.complaint ? ago(s.m) : null,
        escalatedAt: s.complaint?.status === "NEW" && s.m > 1440 ? ago(s.m - 1440) : null,
        contactedAt: s.complaint && s.complaint.status !== "NEW" ? ago(s.m - 40) : null,
        resolvedAt: s.complaint?.status === "RESOLVED" ? ago(s.m - (s.m % 3 === 0 ? 1800 : 300)) : null,
      },
    });
    if (s.complaint?.status === "CONTACTED") {
      await db.resolutionNote.create({ data: { organizationId: org.id, reviewId: review.id, authorUserId: manager.id, authorName: "Meena Iyer", text: "Called the customer. AC unit at table 9 reported to maintenance. Offered a free dessert on the next visit.", createdAt: ago(s.m - 40) } });
    }
    if (s.complaint?.status === "RESOLVED" && s.complaint.name) {
      await db.resolutionNote.create({ data: { organizationId: org.id, reviewId: review.id, authorUserId: manager.id, authorName: "Meena Iyer", text: "Spoke to the customer on WhatsApp. Apologised and shared the feedback with the kitchen.", createdAt: ago(s.m - 70) } });
      await db.resolutionNote.create({ data: { organizationId: org.id, reviewId: review.id, authorUserId: owner.id, authorName: "Vikram Rao", text: "Chef confirmed a salt measurement mistake in that batch. Customer invited back with a 20% voucher.", createdAt: ago(s.m - 320) } });
    }
  }

  // ---- Other demo clients in different subscription states ----
  const others = [
    { name: "Urban Fit Gyms", plan: "Growth", max: 5, periodEnd: new Date(now - 4 * DAY) },
    { name: "Sweet Tooth Mithai", plan: "Starter", max: 2, periodEnd: new Date(now - 60 * DAY) },
    { name: "Dr. Mehta Dental Care", plan: "Starter", max: 2, trialEnd: new Date(now + 9 * DAY) },
  ];
  for (const o of others) {
    const other = await db.organization.create({
      data: { name: o.name, subscription: { create: { planName: o.plan, maxBranches: o.max, currentPeriodEnd: o.periodEnd ?? null, trialEndsAt: o.trialEnd ?? null } } },
    });
    const biz = await db.business.create({ data: { organizationId: other.id, name: o.name, type: guessType(o.name), category: TYPE_LABELS[guessType(o.name)], brandColor: "#7A2E1F" } });
    const br = await db.branch.create({
      data: { organizationId: other.id, businessId: biz.id, name: "Main", slug: `${o.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-main`, cityArea: "Bengaluru", googleReviewUrl: "https://search.google.com/local/writereview?placeid=DEMO_PLACE_ID" },
    });
    const q = await qr(other.id, br.id, "BRANCH", "branch");
    console.log(`${o.name}: /r/${q.code}`);
  }

  const indQr = await db.qrCode.findFirstOrThrow({ where: { branchId: ind.id, key: "table:12" } });
  console.log(`Demo ready. Customer page: /r/${indQr.code}`);
  console.log("Sign in (dev login): owner@demo.test (Client Owner), meena@demo.test (Branch Admin)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
