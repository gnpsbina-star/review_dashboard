import { after, NextResponse } from "next/server";
import { z } from "zod";
import { sendComplaintAlert } from "@/lib/alerts";
import { encryptField, keyedHash } from "@/lib/crypto";
import { ISSUE_KEYS, normalizeIndianMobile } from "@/lib/customer-i18n";
import { loadQrContext } from "@/lib/data/customer";
import { cleanPhotos, MAX_TOTAL_BYTES, savePhotos, type CleanPhoto } from "@/lib/photos";
import { db } from "@/lib/db";
import { DEVICE_COOKIE, deviceCookieOptions, deviceHashes } from "@/lib/device";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp, isSameOrigin } from "@/lib/request";
import { verifyTurnstile } from "@/lib/turnstile";

const Body = z.object({
  code: z.string().max(16),
  rating: z.number().int().min(1).max(3),
  comment: z.string().trim().min(10).max(2000),
  issues: z.array(z.enum(ISSUE_KEYS)).max(5).default([]),
  name: z.string().trim().max(80).optional().default(""),
  phone: z.string().trim().max(20).optional().default(""),
  turnstileToken: z.string().max(2048).optional(),
  deviceToken: z.string().max(64).optional(),
});

function error(code: string, status: number) {
  return NextResponse.json({ error: code }, { status });
}

/** Reads JSON, or multipart form data with a "data" JSON field plus up to 3 "photos". */
async function readBody(req: Request): Promise<{ data: unknown; files: File[] } | null> {
  const type = req.headers.get("content-type") ?? "";
  if (type.startsWith("multipart/form-data")) {
    const length = Number(req.headers.get("content-length") ?? 0);
    if (length > MAX_TOTAL_BYTES + 64 * 1024) return null;
    const form = await req.formData().catch(() => null);
    if (!form) return null;
    let data: unknown = null;
    try {
      data = JSON.parse(String(form.get("data") ?? ""));
    } catch {
      return null;
    }
    return { data, files: form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0) };
  }
  return { data: await req.json().catch(() => null), files: [] };
}

/** Private 1–3★ feedback, optionally with photos. Saved for the branch team; never sent to Google. */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return error("forbidden", 403);
  const body = await readBody(req);
  if (!body) return error("photo-size", 413);
  const parsed = Body.safeParse(body.data);
  if (!parsed.success) return error("invalid", 400);
  const b = parsed.data;

  const phone = b.phone ? normalizeIndianMobile(b.phone) : null;
  if (b.phone && !phone) return error("phone", 400);

  const ctx = await loadQrContext(b.code);
  if (!ctx) return error("not_found", 404);
  if (!ctx.serviceable) return error("unavailable", 403);

  const ip = await clientIp();
  const ipHash = ip ? keyedHash(`ip:${ip}`) : null;
  if (ipHash && !(await rateLimit(`complaint-ip:${ipHash}`, 50, 3_600_000))) return error("limit", 429);
  if (!(await verifyTurnstile(b.turnstileToken, ip))) return error("captcha", 400);

  let photos: CleanPhoto[] = [];
  if (body.files.length) {
    const cleaned = await cleanPhotos(body.files);
    if (!cleaned.ok) return error(cleaned.error, 400);
    photos = cleaned.photos;
  }

  const device = await deviceHashes(b.deviceToken);
  // One complaint per phone per business within the business's limit (2 hours by default).
  const deviceKeys = device.hashes.map((h) => `complaint-dev:${ctx.business.id}:${h}`);
  const since = new Date(Date.now() - ctx.business.deviceLimitHours * 3_600_000);
  const recent = await db.rateLimitHit.count({ where: { key: { in: deviceKeys }, createdAt: { gte: since } } });
  if (recent > 0) return error("limit", 429);

  const review = await db.review.create({
    data: {
      organizationId: ctx.org.id,
      branchId: ctx.branch.id,
      qrCodeId: ctx.qr.id,
      rating: b.rating,
      source: "INTERCEPTED",
      status: "NEW",
      comment: b.comment,
      issues: b.issues,
      customerName: b.name || null,
      customerPhoneEnc: phone ? encryptField(phone) : null,
      contactConsent: !!phone,
      tableLabel: ctx.qr.tableLabel,
      staffId: ctx.staffName ? ctx.qr.staffId : null,
      staffName: ctx.staffName,
      ipHash,
      deviceHash: device.primary,
    },
    select: { id: true },
  });
  await db.rateLimitHit.createMany({ data: deviceKeys.map((key) => ({ key })) });
  if (photos.length) {
    // The written complaint matters most: if storing photos fails, keep the complaint and log it.
    await savePhotos(ctx.org.id, review.id, photos).catch((e) => console.error("[photos] save failed", e instanceof Error ? e.message : e));
  }

  after(() => sendComplaintAlert(review.id).catch((e) => console.error("[alert] failed", e instanceof Error ? e.message : e)));

  const res = NextResponse.json({ ok: true });
  if (device.newCookie) res.cookies.set(DEVICE_COOKIE, device.newCookie, deviceCookieOptions());
  return res;
}
