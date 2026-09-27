import { NextResponse } from "next/server";
import { getAccess, reviewScope } from "@/lib/access";
import { db } from "@/lib/db";
import { getObject, type Backend } from "@/lib/storage";

/** Customer photos are private: only people who can see the complaint can load them. */
export async function GET(_req: Request, ctx: RouteContext<"/api/photos/[id]">) {
  const { id } = await ctx.params;
  const notFound = () => new NextResponse("Not found", { status: 404 });
  if (!/^[a-z0-9]{10,40}$/.test(id)) return notFound();
  const a = await getAccess().catch(() => null);
  if (!a) return notFound();
  const photo = await db.reviewPhoto.findFirst({ where: { id, organizationId: a.org.id, review: { ...reviewScope(a), archivedAt: undefined } } });
  if (!photo) return notFound();
  const data = await getObject(photo.storage as Backend, photo.storageKey);
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
