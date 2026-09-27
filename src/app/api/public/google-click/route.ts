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

/** Logs that a happy customer went to Google. We can't see whether they posted. */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const b = parsed.data;

  const ctx = await loadQrContext(b.code);
  if (!ctx || !ctx.serviceable) return NextResponse.json({ ok: true });

  const ip = await clientIp();
  const ipHash = ip ? keyedHash(`ip:${ip}`) : null;
  if (ipHash && !(await rateLimit(`google-ip:${ipHash}`, 300, 3_600_000))) return NextResponse.json({ ok: true });

  const device = await deviceHashes(b.deviceToken);
  // One logged visit per phone per branch every 30 minutes, so repeat taps don't inflate numbers.
  const dup = await db.review.findFirst({
    where: { source: "GOOGLE_REDIRECT", branchId: ctx.branch.id, deviceHash: { in: device.hashes }, createdAt: { gte: new Date(Date.now() - 30 * 60_000) } },
    select: { id: true },
  });
  if (!dup) {
    await db.review.create({
      data: {
        organizationId: ctx.org.id,
        branchId: ctx.branch.id,
        qrCodeId: ctx.qr.id,
        rating: b.rating,
        source: "GOOGLE_REDIRECT",
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
