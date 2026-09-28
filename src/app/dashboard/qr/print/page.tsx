import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/dashboard/PrintButton";
import { QrStand } from "@/components/dashboard/QrStand";
import { requireAccess } from "@/lib/access";
import { branchStands, type QrFilter } from "@/lib/data/qr-list";

export const metadata: Metadata = { title: "Print QR codes" };

export default async function PrintSheet(props: PageProps<"/dashboard/qr/print">) {
  const a = await requireAccess({ ownerOnly: true });
  const sp = await props.searchParams;
  if (typeof sp.branch !== "string") notFound();
  const kind = (typeof sp.kind === "string" && ["BRANCH", "TABLE", "STAFF"].includes(sp.kind) ? sp.kind : "all") as QrFilter;
  const data = await branchStands(a.org.id, sp.branch, kind);
  if (!data) notFound();
  return (
    <>
      <div className="mhead no-print">
        <div><h1>Print sheet</h1><div className="who">{data.branch.business.name} · {data.branch.name} · {data.stands.length} codes</div></div>
        <div className="toolbar"><Link className="btn-ghost" href={`/dashboard/qr?branch=${data.branch.id}`}>Back</Link><PrintButton /></div>
      </div>
      <div className="qr-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        {data.stands.map((s) => <QrStand key={s.id} {...s} />)}
      </div>
    </>
  );
}
