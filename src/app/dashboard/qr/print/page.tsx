import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/dashboard/PrintButton";
import { QrCard } from "@/components/dashboard/QrCard";
import { requireAccess } from "@/lib/access";
import { branchStands, type QrFilter } from "@/lib/data/qr-list";
import { CARD_SIZES, PAPER, type CardSize } from "@/lib/qr-card";

export const metadata: Metadata = { title: "Print QR cards" };

const PER_PAGE: Record<CardSize, number> = { a6: 4, a5: 2, a4: 1 };

export default async function PrintSheet(props: PageProps<"/dashboard/qr/print">) {
  const a = await requireAccess({ ownerOnly: true });
  const sp = await props.searchParams;
  if (typeof sp.branch !== "string") notFound();
  const kind = (typeof sp.kind === "string" && ["BRANCH", "TABLE", "STAFF"].includes(sp.kind) ? sp.kind : "all") as QrFilter;
  const size = (typeof sp.size === "string" && (CARD_SIZES as string[]).includes(sp.size) ? sp.size : "a6") as CardSize;
  const data = await branchStands(a.org.id, sp.branch, kind);
  if (!data) notFound();
  const per = PER_PAGE[size];
  const pages = Array.from({ length: Math.ceil(data.stands.length / per) }, (_, i) => data.stands.slice(i * per, i * per + per));

  return (
    <>
      <style>{size === "a5" ? "@page { size: A4 landscape; margin: 0; }" : "@page { size: A4; margin: 0; }"}</style>
      <div className="mhead no-print">
        <div>
          <h1>Print {PAPER[size].label} cards</h1>
          <div className="who">{data.branch.business.name} · {data.branch.name} · {data.stands.length} cards on {pages.length} A4 {pages.length === 1 ? "page" : "pages"}</div>
        </div>
        <div className="toolbar"><Link className="btn-ghost" href={`/dashboard/qr?branch=${data.branch.id}&kind=${kind}&size=${size}`}>Back</Link><PrintButton /></div>
      </div>
      <div className="notice no-print">
        <span>In the print dialog choose <b>Actual size (100%)</b> and <b>no margins</b>{size === "a5" ? ", with landscape paper" : ""}. Cut along the dashed lines. For the best colour, use the PDF download at a print shop.</span>
      </div>
      <div className="qr-pages">
        {pages.map((cards, i) => (
          <div key={i} className={`qr-sheet ${size} ${i > 0 ? "pb" : ""}`}>
            {cards.map((s) => <QrCard key={s.id} data={s} className="qr-card" />)}
          </div>
        ))}
      </div>
    </>
  );
}
