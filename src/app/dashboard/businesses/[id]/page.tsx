import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BranchFields } from "@/components/dashboard/BranchFields";
import { BusinessFields } from "@/components/dashboard/BusinessFields";
import { ConfirmButton } from "@/components/dashboard/ConfirmButton";
import { Flash } from "@/components/dashboard/Flash";
import { BusinessLogo } from "@/components/ui";
import { archiveBusiness, createBranch, removeLogo, updateBusiness, uploadLogo } from "../actions";
import { requireAccess } from "@/lib/access";
import { businessTypeOf } from "@/lib/business-type";
import { readableBrandColor } from "@/lib/contrast";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Business settings" };

export default async function BusinessPage(props: PageProps<"/dashboard/businesses/[id]">) {
  const a = await requireAccess({ ownerOnly: true });
  const { id } = await props.params;
  const sp = await props.searchParams;
  const b = await db.business.findFirst({ where: { id, organizationId: a.org.id, archivedAt: null }, include: { branches: { where: { archivedAt: null }, orderBy: { name: "asc" } } } });
  if (!b) notFound();
  const used = await db.branch.count({ where: { organizationId: a.org.id, archivedAt: null } });
  const brand = readableBrandColor(b.brandColor);

  return (
    <>
      <div className="mhead">
        <div><Link href="/dashboard/businesses" className="help">← Businesses &amp; branches</Link><h1>{b.name}</h1></div>
      </div>
      <Flash sp={sp} />
      <section className="panel">
        <h3>Business details</h3>
        <form action={updateBusiness} style={{ display: "grid", gap: 14 }}>
          <input type="hidden" name="businessId" value={b.id} />
          <BusinessFields b={b} />
          {brand.adjusted && <p className="help">Customers will see this colour slightly darker ({brand.color}) so white text stays readable.</p>}
          <button className="btn" type="submit" style={{ justifySelf: "start" }}>Save changes</button>
        </form>
      </section>

      <section className="panel">
        <h3>Logo</h3>
        <div className="toolbar" style={{ gap: 16 }}>
          <BusinessLogo businessId={b.id} name={b.name} logoVersion={b.logoVersion} color={brand.color} size={64} />
          <form action={uploadLogo} className="toolbar">
            <input type="hidden" name="businessId" value={b.id} />
            <label className="sr-only" htmlFor="logo">Logo image</label>
            <input id="logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp" required />
            <button className="btn-ghost" type="submit">Upload</button>
          </form>
          {b.logoVersion > 0 && (
            <form action={removeLogo}><input type="hidden" name="businessId" value={b.id} /><button className="linkbtn" type="submit">Remove logo</button></form>
          )}
        </div>
        <p className="help">PNG, JPG or WebP up to 2 MB. It’s cropped to a square.</p>
      </section>

      <section className="panel" id="add-branch">
        <h3>Branches</h3>
        {b.branches.length > 0 && (
          <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4 }}>
            {b.branches.map((br) => <li key={br.id}><Link href={`/dashboard/branches/${br.id}`}>{br.name}</Link> <span className="muted">· {br.cityArea}</span></li>)}
          </ul>
        )}
        {used >= a.plan.maxBranches ? (
          <div className="notice warn">You’re using all {a.plan.maxBranches} branches on your plan. Contact Synergy Technologies to add more.</div>
        ) : (
          <details>
            <summary style={{ cursor: "pointer", fontWeight: 700 }}>+ Add a branch</summary>
            <form action={createBranch} style={{ display: "grid", gap: 14, marginTop: 12 }}>
              <input type="hidden" name="businessId" value={b.id} />
              <BranchFields type={businessTypeOf(b)} />
              <button className="btn" type="submit" style={{ justifySelf: "start" }}>Create branch</button>
            </form>
          </details>
        )}
      </section>

      <section className="panel">
        <h3>Archive this business</h3>
        <p className="muted">Hides the business and all its branches. Their QR codes stop working. Reviews stay in your records.</p>
        <form action={archiveBusiness}>
          <input type="hidden" name="businessId" value={b.id} />
          <ConfirmButton className="btn-danger" message={`Archive ${b.name} and all its branches? Their QR codes will stop working.`}>Archive business</ConfirmButton>
        </form>
      </section>
    </>
  );
}
