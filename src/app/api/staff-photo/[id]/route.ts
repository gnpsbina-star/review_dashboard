import { NextResponse } from "next/server";
import { getAccess } from "@/lib/access";
import { db } from "@/lib/db";
import { getObject, type Backend } from "@/lib/storage";

/** Staff photos are private to the account's Client Owners (they print the ID cards). */
export async function GET(_req: Request, ctx: RouteContext<"/api/staff-photo/[id]">) {
  const { id } = await ctx.params;
  const notFound = () => new NextResponse("Not found", { status: 404 });
  if (!/^[a-z0-9]{10,40}$/.test(id)) return notFound();
  const a = await getAccess().catch(() => null);
  if (!a || a.role !== "CLIENT_OWNER") return notFound();
  const s = await db.staff.findFirst({ where: { id, organizationId: a.org.id }, select: { photoKey: true, photoStorage: true } });
  if (!s?.photoKey || !s.photoStorage) return notFound();
  const data = await getObject(s.photoStorage as Backend, s.photoKey);
  if (!data) return notFound();
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });
}
