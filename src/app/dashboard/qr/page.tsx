import type { Metadata } from "next";
import Link from "next/link";
import { QrCard } from "@/components/dashboard/QrCard";
import { CardDownloads, SheetDownload } from "@/components/dashboard/QrCardDownloads";
import { IconShield } from "@/components/icons";
import { createStaffCodes, createTableCodes } from "./actions";
import { requireAccess } from "@/lib/access";
import { db } from "@/lib/db";
import { branchStands, type QrFilter } from "@/lib/data/qr-list";
import { CARD_SIZES, PAPER, type CardSize } from "@/lib/qr-card";

export const metadata: Metadata = { title: "QR studio" };

export default async function QrStudio(props: PageProps<"/dashboard/qr">) {
  const a = await requireAccess({ ownerOnly: true });
  const sp = await props.searchParams;
  const branches = await db.branch.findMany({
    where: { organizationId: a.org.id, archivedAt: null },
    include: { business: { select: { name: true } }, _count: { select: { staff: { where: { active: true } } } } },
    orderBy: [{ business: { name: "asc" } }, { name: "asc" }],
  });
  if (branches.length === 0) {
    return (
      <>
        <div className="mhead"><h1>QR studio</h1></div>
        <div className="placeholder"><b>Add a branch first.</b><span className="muted">QR codes belong to a branch.</span><Link className="btn" href="/dashboard/businesses">Add a business and branch</Link></div>
      </>
    );
  }
  const branchId = typeof sp.branch === "string" && branches.some((b) => b.id === sp.branch) ? sp.branch : branches[0].id;
  const kind = (typeof sp.kind === "string" && ["BRANCH", "TABLE", "STAFF"].includes(sp.kind) ? sp.kind : "all") as QrFilter;
  const size = (typeof sp.size === "string" && (CARD_SIZES as string[]).includes(sp.size) ? sp.size : "a6") as CardSize;
  const data = (await branchStands(a.org.id, branchId, kind))!;
  const tables = data.stands.filter((s) => s.kind === "TABLE").length;
  const base = `/dashboard/qr?branch=${branchId}&size=${size}`;

  return (
    <>
      <div className="mhead">
        <div><h1>QR studio</h1><div className="who">QR codes for stands, stickers and table cards</div></div>
      </div>
      <div className="notice"><IconShield /><span><b>These codes are permanent.</b> Each one is a short code on our own address. If the Google link, business name or website address changes later, printed stands keep working. Nothing needs reprinting.</span></div>

      <div className="filters">
        <form action="/dashboard/qr" className="toolbar">
          <label className="sr-only" htmlFor="qr-branch">Branch</label>
          <input type="hidden" name="size" value={size} />
          <select id="qr-branch" name="branch" className="select" defaultValue={branchId}>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.business.name} · {b.name}</option>)}
          </select>
          <button className="btn-ghost btn-sm" type="submit">Show</button>
        </form>
        <div className="seg" role="group" aria-label="Codes for">
          {([["all", "All"], ["BRANCH", "Whole branch"], ["TABLE", "Tables"], ["STAFF", "Staff"]] as const).map(([k, l]) => (
            <Link key={k} href={`${base}&kind=${k}`} aria-current={kind === k}>{l}</Link>
          ))}
        </div>
      </div>

      <div className="grid2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <form action={createTableCodes} className="panel">
          <h3>Add table codes</h3>
          <p className="cap">{tables ? `${tables} table codes so far.` : "No table codes yet."} Existing numbers are skipped.</p>
          <input type="hidden" name="branchId" value={branchId} />
          <div className="toolbar">
            <div className="field"><label htmlFor="from">From table</label><input id="from" name="from" type="number" min={1} max={500} defaultValue={tables + 1} style={{ width: 110 }} /></div>
            <div className="field"><label htmlFor="to">To table</label><input id="to" name="to" type="number" min={1} max={500} defaultValue={tables + 10} style={{ width: 110 }} /></div>
          </div>
          <button className="btn-ghost" type="submit" style={{ justifySelf: "start" }}>Create table codes</button>
        </form>
        <form action={createStaffCodes} className="panel">
          <h3>Staff codes</h3>
          <p className="cap">Ratings from a staff code show the staff member’s name in reviews and analytics.</p>
          <input type="hidden" name="branchId" value={branchId} />
          <p className="muted">{data.branch.name} has {branches.find((b) => b.id === branchId)!._count.staff} active staff. <Link href={`/dashboard/branches/${branchId}`}>Manage staff</Link></p>
          <button className="btn-ghost" type="submit" style={{ justifySelf: "start" }}>Create codes for all staff</button>
        </form>
      </div>

      <section className="panel">
        <div className="toolbar" style={{ justifyContent: "space-between", gap: 12 }}>
          <div className="seg" role="group" aria-label="Card size">
            {CARD_SIZES.map((k) => (
              <Link key={k} href={`/dashboard/qr?branch=${branchId}&kind=${kind}&size=${k}`} aria-current={size === k}>
                {PAPER[k].label} · {PAPER[k].use}
              </Link>
            ))}
          </div>
          <div className="toolbar">
            <Link className="btn-ghost" href={`/dashboard/qr/print?branch=${branchId}&kind=${kind}&size=${size}`}>Print</Link>
            <SheetDownload cards={data.stands} size={size} />
          </div>
        </div>
        <p className="cap" style={{ margin: 0 }}>
          {size === "a6" ? "4 cards per A4 sheet, with dashed cutting lines." : size === "a5" ? "2 cards per A4 sheet (landscape), with a dashed cutting line." : "One poster per A4 page."}{" "}
          The PDF is print-ready at 300 dpi. Each card also downloads on its own as PDF, a 4000-pixel PNG for flex banners, or SVG for designers.{" "}
          <Link href={`/dashboard/businesses/${data.branch.businessId}`}>Change the headline</Link>
        </p>
      </section>

      {data.stands.length === 0 ? (
        <div className="placeholder"><b>No codes of this type yet.</b></div>
      ) : (
        <div className="qr-grid">
          {data.stands.map((s) => (
            <div key={s.id} className="qr-cell">
              <QrCard data={s} className="qr-card" />
              <CardDownloads card={s} size={size} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
