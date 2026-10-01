import { beforeEach, describe, expect, it } from "vitest";
import { cookieJar, requestHeaders } from "../support/next-mocks";
import { makeTenant, resetDb } from "../support/db";
import { POST as feedback } from "@/app/api/public/feedback/route";
import { POST as googleClick } from "@/app/api/public/google-click/route";
import { decryptField } from "@/lib/crypto";
import { db } from "@/lib/db";

let T: Awaited<ReturnType<typeof makeTenant>>;

function post(handler: (r: Request) => Promise<Response>, body: unknown, origin = "http://localhost:3000") {
  return handler(new Request("http://localhost:3000/api/x", { method: "POST", headers: { "content-type": "application/json", origin }, body: JSON.stringify(body) }));
}

const complaint = (extra: Record<string, unknown> = {}) => ({ code: T.qr1.code, rating: 2, comment: "The food was cold and the wait was long.", issues: ["Food"], name: "Asha", phone: "98765 43210", deviceToken: "device-token-aaaaaaaa", ...extra });

beforeEach(async () => {
  await resetDb();
  cookieJar.clear();
  requestHeaders.set("x-forwarded-for", "203.0.113.7");
  T = await makeTenant("Public");
});

describe("private feedback API", () => {
  it("stores a complaint with the phone encrypted and the IP hashed", async () => {
    const res = await post(feedback, complaint());
    expect(res.status).toBe(200);
    const r = await db.review.findFirstOrThrow({ where: { source: "INTERCEPTED", comment: { contains: "food was cold" } } });
    expect(r.status).toBe("NEW");
    expect(r.customerPhoneEnc).not.toContain("9876543210");
    expect(decryptField(r.customerPhoneEnc)).toBe("9876543210");
    expect(r.ipHash).not.toContain("203.0.113.7");
    expect(r.contactConsent).toBe(true);
  });

  it("rejects cross-site requests", async () => {
    expect((await post(feedback, complaint(), "https://evil.example")).status).toBe(403);
  });

  it("rejects ratings above 3 and invalid phones", async () => {
    expect((await post(feedback, complaint({ rating: 4 }))).status).toBe(400);
    expect((await post(feedback, complaint({ phone: "12345" }))).status).toBe(400);
    expect((await post(feedback, complaint({ comment: "short" }))).status).toBe(400);
  });

  it("allows one complaint per phone within the business's limit", async () => {
    expect((await post(feedback, complaint())).status).toBe(200);
    expect((await post(feedback, complaint({ comment: "Second complaint from the same phone." }))).status).toBe(429);
    // Same localStorage token but a cleared cookie is still the same phone.
    cookieJar.clear();
    expect((await post(feedback, complaint({ comment: "Third try after clearing cookies." }))).status).toBe(429);
    // A different phone on the same Wi-Fi is fine.
    cookieJar.clear();
    expect((await post(feedback, complaint({ deviceToken: "another-device-bbbbbbbb" }))).status).toBe(200);
  });

  it("collects nothing when the account is locked", async () => {
    await db.subscription.update({ where: { organizationId: T.org.id }, data: { currentPeriodEnd: new Date(Date.now() - 40 * 86_400_000) } });
    expect((await post(feedback, complaint())).status).toBe(403);
    await post(googleClick, { code: T.qr1.code, rating: 5 });
    expect(await db.review.count({ where: { organizationId: T.org.id, comment: { contains: "food was cold" } } })).toBe(0);
    expect(await db.review.count({ where: { source: "GOOGLE_REDIRECT" } })).toBe(0);
  });

  it("returns 404 for unknown codes", async () => {
    expect((await post(feedback, complaint({ code: "ZZZZZZ" }))).status).toBe(404);
  });
});

describe("Google click logging", () => {
  it("logs one visit per phone per branch in 30 minutes", async () => {
    await post(googleClick, { code: T.qr1.code, rating: 5, text: "Lovely coffee and friendly staff here!", language: "en", edited: true, deviceToken: "device-token-cccccccc" });
    await post(googleClick, { code: T.qr1.code, rating: 5, deviceToken: "device-token-cccccccc" });
    const rows = await db.review.findMany({ where: { source: "GOOGLE_REDIRECT" } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ rating: 5, editedSuggestion: true, comment: "Lovely coffee and friendly staff here!" });
  });
  it("keeps the latest copied text when the customer picks a different suggestion", async () => {
    const device = { deviceToken: "device-token-dddddddd" };
    await post(googleClick, { code: T.qr1.code, rating: 5, text: "First suggestion that was copied automatically.", language: "en", edited: false, ...device });
    await post(googleClick, { code: T.qr1.code, rating: 5, text: "Second one, picked and edited by the customer.", language: "hinglish", edited: true, ...device });
    const rows = await db.review.findMany({ where: { source: "GOOGLE_REDIRECT" } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ comment: "Second one, picked and edited by the customer.", language: "hinglish", editedSuggestion: true });
  });
  it("accepts complaint topics for every kind of business", async () => {
    expect((await post(feedback, complaint({ issues: ["Teaching", "Fees"] }))).status).toBe(200);
    expect((await post(feedback, complaint({ issues: ["Nonsense"], deviceToken: "device-token-eeeeeeee" }))).status).toBe(400);
  });
  it("refuses low ratings on the Google route", async () => {
    expect((await post(googleClick, { code: T.qr1.code, rating: 2 })).status).toBe(400);
  });
});
