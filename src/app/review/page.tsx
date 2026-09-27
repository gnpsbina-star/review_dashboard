import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";

/** Supports the original link format /review?branch=<slug>&table=5 by forwarding to the branch QR page. */
export default async function LegacyReviewLink(props: PageProps<"/review">) {
  const sp = await props.searchParams;
  const slug = typeof sp.branch === "string" ? sp.branch.slice(0, 80) : null;
  if (!slug) notFound();
  const branch = await db.branch.findUnique({ where: { slug }, select: { id: true, archivedAt: true } });
  if (!branch || branch.archivedAt) notFound();
  const table = typeof sp.table === "string" ? sp.table.slice(0, 10) : null;
  const qr =
    (table && (await db.qrCode.findUnique({ where: { branchId_key: { branchId: branch.id, key: `table:${table}` } } }))) ||
    (await db.qrCode.findUnique({ where: { branchId_key: { branchId: branch.id, key: "branch" } } }));
  if (!qr) notFound();
  redirect(`/r/${qr.code}`);
}
