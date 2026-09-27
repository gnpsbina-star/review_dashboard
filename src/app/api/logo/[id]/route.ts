import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/** Business logos are public (they appear on the customer page). Stored re-encoded as PNG. */
export async function GET(_req: Request, ctx: RouteContext<"/api/logo/[id]">) {
  const { id } = await ctx.params;
  if (!/^[a-z0-9]{10,40}$/.test(id)) return new NextResponse(null, { status: 404 });
  const logo = await db.businessLogo.findUnique({ where: { businessId: id } });
  if (!logo) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(logo.data), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}
