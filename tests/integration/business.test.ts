import { beforeEach, describe, expect, it } from "vitest";
import { cookieJar, RedirectError } from "../support/next-mocks";
import { makeTenant, resetDb } from "../support/db";
import { signInAs } from "../support/session";
import { createBusiness, updateBusiness } from "@/app/dashboard/businesses/actions";
import { poolIsStale } from "@/lib/ai/pool";
import { branchStands } from "@/lib/data/qr-list";
import { db } from "@/lib/db";

let T: Awaited<ReturnType<typeof makeTenant>>;

function form(values: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  return f;
}
async function redirectOf(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    if (e instanceof RedirectError) return e.url;
    throw e;
  }
  return null;
}
const base = { name: "Bright Minds", brandColor: "#5B2A86", brandTone: "Professional and caring", deviceLimitHours: "2" };

beforeEach(async () => {
  await resetDb();
  cookieJar.clear();
  T = await makeTenant("Biz");
});

describe("business type", () => {
  it("older businesses get a type guessed from their category", async () => {
    const data = await branchStands(T.org.id, T.b1.id, "all");
    expect(data!.stands[0]).toMatchObject({ type: "RESTAURANT", headline: { en: "Enjoyed your visit? Rate us!" } });
  });

  it("saves the type, fills in the description and marks suggestion pools for rewriting", async () => {
    await signInAs(T.owner.id);
    await db.branch.updateMany({ where: { businessId: T.business.id }, data: { suggestionsRefreshedAt: new Date(Date.now() + 60_000) } });
    const url = await redirectOf(updateBusiness(form({ ...base, businessId: T.business.id, type: "COACHING", category: "", qrHeadline: "Loved learning here? Rate us!", qrHeadlineHi: "" })));
    expect(url).toBe(`/dashboard/businesses/${T.business.id}?saved=1`);
    const b = await db.business.findUniqueOrThrow({ where: { id: T.business.id } });
    expect(b).toMatchObject({ type: "COACHING", category: "Coaching institute", qrHeadline: "Loved learning here? Rate us!", qrHeadlineHi: null });
    const branch = await db.branch.findUniqueOrThrow({ where: { id: T.b1.id } });
    expect(branch.aiSettingsUpdatedAt.getTime()).toBeGreaterThan(Date.now() - 5_000);

    const card = (await branchStands(T.org.id, T.b1.id, "all"))!.stands[0];
    expect(card.headline).toEqual({ en: "Loved learning here? Rate us!", hi: "हमें अपना अनुभव बताएं" });
    expect(card.type).toBe("COACHING");
    expect(poolIsStale({ aiSettingsUpdatedAt: new Date(), suggestionsRefreshedAt: new Date(Date.now() - 1000) })).toBe(true);
  });

  it("rejects an unknown type", async () => {
    await signInAs(T.owner.id);
    expect(await redirectOf(createBusiness(form({ ...base, type: "CASINO", category: "" })))).toBe("/dashboard/businesses?error=business");
    expect(await redirectOf(createBusiness(form({ ...base, type: "SCHOOL", category: "CBSE school" })))).toMatch(/^\/dashboard\/businesses\/\w+\?saved=created$/);
    expect(await db.business.count({ where: { organizationId: T.org.id, type: "SCHOOL", category: "CBSE school" } })).toBe(1);
  });
});
