import { beforeEach, describe, expect, it } from "vitest";
import { cookieJar, requestHeaders } from "../support/next-mocks";
import { makeTenant, resetDb } from "../support/db";
import { signInAs } from "../support/session";
import { POST as facebookClick } from "@/app/api/public/facebook-click/route";
import { POST as googleClick } from "@/app/api/public/google-click/route";
import { updateBranch } from "@/app/dashboard/businesses/actions";
import { db } from "@/lib/db";

let T: Awaited<ReturnType<typeof makeTenant>>;
const FB = "https://www.facebook.com/alpha.cafe/reviews";

function post(handler: (r: Request) => Promise<Response>, body: Record<string, unknown>) {
  return handler(new Request("http://localhost:3000/api/x", { method: "POST", headers: { "content-type": "application/json", origin: "http://localhost:3000" }, body: JSON.stringify({ deviceToken: "fb-device-aaaaaaaaaaaa", ...body }) }));
}

beforeEach(async () => {
  await resetDb();
  cookieJar.clear();
  requestHeaders.set("x-forwarded-for", "192.0.2.44");
  T = await makeTenant("Alpha");
  await db.branch.update({ where: { id: T.b1.id }, data: { facebookReviewUrl: FB } });
});

describe("Facebook sharing", () => {
  it("Google then Facebook is one visit, marked as shared on both", async () => {
    await post(googleClick, { code: T.qr1.code, rating: 5, text: "Lovely coffee and very friendly staff here!" });
    await post(facebookClick, { code: T.qr1.code, rating: 5, text: "Lovely coffee and very friendly staff here!" });
    const rows = await db.review.findMany({ where: { source: { not: "INTERCEPTED" } } });
    expect(rows).toHaveLength(1);
    expect(rows[0].source).toBe("GOOGLE_REDIRECT");
    expect(rows[0].facebookSharedAt).not.toBeNull();
  });

  it("Facebook only is logged as a Facebook visit; Google afterwards merges into it", async () => {
    await post(facebookClick, { code: T.qr1.code, rating: 4 });
    let rows = await db.review.findMany({ where: { source: { not: "INTERCEPTED" } } });
    expect(rows).toHaveLength(1);
    expect(rows[0].source).toBe("FACEBOOK_REDIRECT");
    await post(googleClick, { code: T.qr1.code, rating: 4 });
    rows = await db.review.findMany({ where: { source: { not: "INTERCEPTED" } } });
    expect(rows).toHaveLength(1);
    expect(rows[0].source).toBe("GOOGLE_REDIRECT");
    expect(rows[0].facebookSharedAt).not.toBeNull();
  });

  it("does nothing for branches without a Facebook link, and refuses low ratings", async () => {
    await db.branch.update({ where: { id: T.b1.id }, data: { facebookReviewUrl: null } });
    await post(facebookClick, { code: T.qr1.code, rating: 5 });
    expect(await db.review.count({ where: { source: "FACEBOOK_REDIRECT" } })).toBe(0);
    expect((await post(facebookClick, { code: T.qr1.code, rating: 2 })).status).toBe(400);
  });

  it("branch settings accept only real Facebook links", async () => {
    await signInAs(T.owner.id);
    const form = (fb: string) => {
      const f = new FormData();
      Object.entries({ branchId: T.b1.id, name: "One", cityArea: "Bengaluru", googleReviewUrl: "https://search.google.com/local/writereview?placeid=X", highlights: "coffee", facebookReviewUrl: fb }).forEach(([k, v]) => f.set(k, v));
      f.append("languages", "en");
      return f;
    };
    const url = async (fb: string) => (await updateBranch(form(fb)).catch((e) => e)).url as string;
    expect(await url("https://evil.example/facebook.com")).toContain("error=branch");
    expect(await url("http://www.facebook.com/page")).toContain("error=branch"); // https only
    expect(await url("https://www.facebook.com/alpha.cafe/reviews")).toContain("saved=");
    expect((await db.branch.findUniqueOrThrow({ where: { id: T.b1.id } })).facebookReviewUrl).toBe("https://www.facebook.com/alpha.cafe/reviews");
    expect(await url("")).toContain("saved=");
    expect((await db.branch.findUniqueOrThrow({ where: { id: T.b1.id } })).facebookReviewUrl).toBeNull();
  });

  it("the floating review helper is on by default and can be switched off", async () => {
    expect((await db.branch.findUniqueOrThrow({ where: { id: T.b1.id } })).floatingHelper).toBe(true);
    await signInAs(T.owner.id);
    const f = new FormData();
    Object.entries({ branchId: T.b1.id, name: "One", cityArea: "Bengaluru", googleReviewUrl: "https://g.page/r/abc/review", highlights: "coffee" }).forEach(([k, v]) => f.set(k, v));
    f.append("languages", "en");
    expect(((await updateBranch(f).catch((e) => e)) as { url: string }).url).toContain("saved=");
    expect((await db.branch.findUniqueOrThrow({ where: { id: T.b1.id } })).floatingHelper).toBe(false);
    f.set("floatingHelper", "on");
    await updateBranch(f).catch(() => undefined);
    expect((await db.branch.findUniqueOrThrow({ where: { id: T.b1.id } })).floatingHelper).toBe(true);
  });
});
