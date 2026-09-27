import sharp from "sharp";
import { beforeEach, describe, expect, it } from "vitest";
import { cookieJar, requestHeaders } from "../support/next-mocks";
import { makeTenant, resetDb } from "../support/db";
import { signInAs } from "../support/session";
import { POST as feedback } from "@/app/api/public/feedback/route";
import { GET as getPhoto } from "@/app/api/photos/[id]/route";
import { archiveReview, deleteReview } from "@/app/dashboard/actions";
import { db } from "@/lib/db";
import { runRetention, runSubscriptionJobs } from "@/lib/jobs";
import { newShortCode } from "@/lib/shortcode";

let T: Awaited<ReturnType<typeof makeTenant>>;
let device = 0;

async function jpegWithGps(w = 2400, h = 1800) {
  return sharp({ create: { width: w, height: h, channels: 3, background: "#cc3300" } })
    .jpeg()
    .withExif({ IFD0: { Copyright: "Customer phone" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "12/1 58/1 0/1", GPSLongitudeRef: "E", GPSLongitude: "77/1 38/1 0/1" } })
    .toBuffer();
}

function send(code: string, files: { name: string; type: string; data: Buffer }[]) {
  const form = new FormData();
  form.set("data", JSON.stringify({ code, rating: 2, comment: "The table was dirty, see the photo.", deviceToken: `photo-device-${++device}-xxxxxxxx` }));
  for (const f of files) form.append("photos", new File([new Uint8Array(f.data)], f.name, { type: f.type }));
  return feedback(new Request("http://localhost:3000/api/public/feedback", { method: "POST", headers: { origin: "http://localhost:3000" }, body: form }));
}

const photoReq = (id: string) => getPhoto(new Request(`http://localhost:3000/api/photos/${id}`), { params: Promise.resolve({ id }) });

beforeEach(async () => {
  await resetDb();
  cookieJar.clear();
  requestHeaders.set("x-forwarded-for", "198.51.100.9");
  T = await makeTenant("Photo");
});

describe("complaint photos", () => {
  it("stores up to 3 photos, shrunk to 1600px WebP with location data removed", async () => {
    const res = await send(T.qr1.code, [
      { name: "a.jpg", type: "image/jpeg", data: await jpegWithGps() },
      { name: "b.jpg", type: "image/jpeg", data: await jpegWithGps(800, 600) },
    ]);
    expect(res.status).toBe(200);
    const photos = await db.reviewPhoto.findMany({ orderBy: { width: "desc" } });
    expect(photos).toHaveLength(2);
    expect(photos[0]).toMatchObject({ width: 1600, height: 1200, storage: "db" });
    const blob = await db.reviewPhotoBlob.findUniqueOrThrow({ where: { storageKey: photos[0].storageKey } });
    const meta = await sharp(Buffer.from(blob.data)).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.exif).toBeUndefined();
    expect(photos[0].storageKey).not.toContain("Photo");
  });

  it("refuses more than 3 photos", async () => {
    const img = { name: "p.jpg", type: "image/jpeg", data: await jpegWithGps(200, 200) };
    const res = await send(T.qr1.code, [img, img, img, img]);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "photo-count" });
    expect(await db.review.count({ where: { comment: { contains: "dirty" } } })).toBe(0);
  });

  it("refuses files that aren't real photos, whatever their name says", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>');
    const res = await send(T.qr1.code, [{ name: "cute.jpg", type: "image/jpeg", data: svg }]);
    expect(await res.json()).toEqual({ error: "photo-type" });
    const fake = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.from("not really a jpeg")]);
    expect(await (await send(T.qr1.code, [{ name: "x.jpg", type: "image/jpeg", data: fake }])).json()).toEqual({ error: "photo-type" });
  });

  it("refuses oversized uploads", async () => {
    const big = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(4.2 * 1024 * 1024)]);
    const res = await send(T.qr1.code, [{ name: "big.jpg", type: "image/jpeg", data: big }]);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "photo-size" });
  });

  it("shows photos only to people who can see the complaint", async () => {
    const qr2 = await db.qrCode.create({ data: { code: newShortCode(), organizationId: T.org.id, branchId: T.b2.id, kind: "BRANCH", key: "branch" } });
    await send(qr2.code, [{ name: "a.jpg", type: "image/jpeg", data: await jpegWithGps(400, 300) }]);
    const photo = await db.reviewPhoto.findFirstOrThrow();

    cookieJar.clear();
    expect((await photoReq(photo.id)).status).toBe(404); // signed out

    await signInAs(T.owner.id);
    const ok = await photoReq(photo.id);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toBe("image/webp");
    expect(ok.headers.get("cache-control")).toContain("private");

    await signInAs(T.admin.id); // assigned to branch One only; the photo is from branch Two
    expect((await photoReq(photo.id)).status).toBe(404);

    const other = await makeTenant("Other");
    await signInAs(other.owner.id);
    expect((await photoReq(photo.id)).status).toBe(404);
  });

  it("deletes photo files when a complaint is permanently deleted", async () => {
    await send(T.qr1.code, [{ name: "a.jpg", type: "image/jpeg", data: await jpegWithGps(400, 300) }]);
    const review = await db.review.findFirstOrThrow({ where: { comment: { contains: "dirty" } } });
    await signInAs(T.owner.id);
    const f = new FormData();
    f.set("reviewId", review.id);
    await archiveReview(f).catch(() => undefined);
    await deleteReview(f).catch(() => undefined);
    expect(await db.reviewPhoto.count()).toBe(0);
    expect(await db.reviewPhotoBlob.count()).toBe(0);
  });

  it("deletes photos after 12 months and when an account is purged", async () => {
    await send(T.qr1.code, [{ name: "a.jpg", type: "image/jpeg", data: await jpegWithGps(400, 300) }]);
    const review = await db.review.findFirstOrThrow({ where: { comment: { contains: "dirty" } } });
    await db.review.update({ where: { id: review.id }, data: { createdAt: new Date(Date.now() - 400 * 86_400_000) } });
    expect((await runRetention()).photosDeleted).toBe(1);
    expect(await db.reviewPhotoBlob.count()).toBe(0);

    const gone = await makeTenant("Gone", { periodEnd: new Date(Date.now() - 100 * 86_400_000) });
    const qr = await db.qrCode.findFirstOrThrow({ where: { organizationId: gone.org.id } });
    await db.subscription.update({ where: { organizationId: gone.org.id }, data: { currentPeriodEnd: new Date(Date.now() + 86_400_000) } });
    await send(qr.code, [{ name: "a.jpg", type: "image/jpeg", data: await jpegWithGps(400, 300) }]);
    await db.subscription.update({ where: { organizationId: gone.org.id }, data: { currentPeriodEnd: new Date(Date.now() - 100 * 86_400_000) } });
    expect(await db.reviewPhotoBlob.count()).toBe(1);
    await runSubscriptionJobs();
    expect(await db.reviewPhotoBlob.count()).toBe(0);
  });
});
