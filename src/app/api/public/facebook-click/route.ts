import { NextResponse } from "next/server";
import { z } from "zod";
import { keyedHash } from "@/lib/crypto";
import { loadQrContext } from "@/lib/data/customer";
import { db } from "@/lib/db";
import { DEVICE_COOKIE, deviceCookieOptions, deviceHashes } from "@/lib/device";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp, isSameOrigin } from "@/lib/request";

const Body = z.object({
  code: z.string().max(16),
  rating: z.number().int().min(4).max(5),
  text: z.string().trim().max(1000).optional(),
  language: z.enum(["en", "hi", "hinglish"]).optional(),
  edited: z.boolean().optional(),
  deviceToken: z.string().max(64).optional(),
});

/**
 * Logs that a happy customer went to the business's Facebook page. If they
 * already went to Google in the last 30 minutes, the same visit is marked as
 * shared on Facebook too (one customer, one rating). We can't see whether they posted.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const b = parsed.data;

  const ctx = await loadQrContext(b.code);
  if (!ctx || !ctx.serviceable || !ctx.branch.facebookReviewUrl) return NextResponse.json({ ok: true });

  const ip = await clientIp();
  const ipHash = ip ? keyedHash(`ip:${ip}`) : null;
  if (ipHash && !(await rateLimit(`facebook-ip:${ipHash}`, 300, 3_600_000))) return NextResponse.json({ ok: true });

  const device = await deviceHashes(b.deviceToken);
  const since = new Date(Date.now() - 30 * 60_000);
  const recent = await db.review.findFirst({
    where: { source: { in: ["GOOGLE_REDIRECT", "FACEBOOK_REDIRECT"] }, branchId: ctx.branch.id, deviceHash: { in: device.hashes }, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
  });
  if (recent?.source === "GOOGLE_REDIRECT") {
    if (!recent.facebookSharedAt) await db.review.update({ where: { id: recent.id }, data: { facebookSharedAt: new Date() } });
  } else if (!recent) {
    await db.review.create({
      data: {
        organizationId: ctx.org.id,
        branchId: ctx.branch.id,
        qrCodeId: ctx.qr.id,
        rating: b.rating,
        source: "FACEBOOK_REDIRECT",
        comment: b.text || null,
        language: b.language ?? null,
        editedSuggestion: b.edited ?? null,
        tableLabel: ctx.qr.tableLabel,
        staffId: ctx.staffName ? ctx.qr.staffId : null,
        staffName: ctx.staffName,
        ipHash,
        deviceHash: device.primary,
      },
    });
  }
  const res = NextResponse.json({ ok: true });
  if (device.newCookie) res.cookies.set(DEVICE_COOKIE, device.newCookie, deviceCookieOptions());
  return res;
}
