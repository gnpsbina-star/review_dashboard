import { NextResponse } from "next/server";
import { getAccess } from "@/lib/access";
import { db } from "@/lib/db";
import { qrUrl } from "@/lib/env";
import { qrPng, qrSvgString } from "@/lib/qr";

/** Download a QR code as PNG or SVG. Only for Client Owners of the code's account. */
export async function GET(req: Request, ctx: RouteContext<"/api/qr/[id]">) {
  const { id } = await ctx.params;
  const a = await getAccess();
  if (!a || a.role !== "CLIENT_OWNER" || !/^[a-z0-9]{10,40}$/.test(id)) return new NextResponse("Not found", { status: 404 });
  const qr = await db.qrCode.findFirst({ where: { id, organizationId: a.org.id }, include: { branch: true, staff: true } });
  if (!qr) return new NextResponse("Not found", { status: 404 });
  const format = new URL(req.url).searchParams.get("format") === "svg" ? "svg" : "png";
  const label = qr.kind === "TABLE" ? `table-${qr.tableLabel}` : qr.kind === "STAFF" ? `staff-${qr.staff?.name ?? "member"}` : "branch";
  const filename = `${qr.branch.slug}-${label}-${qr.code}.${format}`.toLowerCase().replace(/[^a-z0-9.-]+/g, "-");
  const url = qrUrl(qr.code);
  const body = format === "svg" ? qrSvgString(url) : new Uint8Array(await qrPng(url));
  return new NextResponse(body, {
    headers: {
      "Content-Type": format === "svg" ? "image/svg+xml" : "image/png",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
    },
  });
}
