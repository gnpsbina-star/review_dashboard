import type { Metadata } from "next";
import Link from "next/link";
import { BusinessFields } from "@/components/dashboard/BusinessFields";
import { Flash } from "@/components/dashboard/Flash";
import { BusinessLogo } from "@/components/ui";
import { createBusiness } from "./actions";
import { requireAccess } from "@/lib/access";
import { readableBrandColor } from "@/lib/contrast";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Businesses & branches" };

export default async function BusinessesPage(props: PageProps<"/dashboard/businesses">) {
  const a = await requireAccess({ ownerOnly: true });
  const sp = await props.searchParams;
  const businesses = await db.business.findMany({
    where: { organizationId: a.org.id, archivedAt: null },
    include: { branches: { where: { archivedAt: null }, orderBy: { name: "asc" } } },
    orderBy: { name: "asc" },
  });
  const used = businesses.reduce((n, b) => n + b.branches.length, 0);

  return (
    <>
      <div className="mhead">
        <div><h1>Businesses &amp; branches</h1><div className="who">{used} of {a.plan.maxBranches} branches used on the {a.plan.name} plan</div></div>
      </div>
      <Flash sp={sp} />
      {businesses.length === 0 && <div className="placeholder"><b>Add your first business.</b><span className="muted">Each business has its own name, logo and colour. Branches sit under a business.</span></div>}
      <div style={{ display: "grid", gap: 12 }}>
        {businesses.map((b) => (
          <section key={b.id} className="panel">
            <div className="mhead">
              <div className="toolbar" style={{ gap: 12 }}>
                <BusinessLogo businessId={b.id} name={b.name} logoVersion={b.logoVersion} color={readableBrandColor(b.brandColor).color} size={42} />
                <div><h3 style={{ fontSize: 17 }}>{b.name}</h3><div className="who">{b.category}{b.address ? ` · ${b.address}` : ""}</div></div>
              </div>
              <Link className="btn-ghost btn-sm" href={`/dashboard/businesses/${b.id}`}>Edit business</Link>
            </div>
            {b.branches.length ? (
              <div className="tscroll">
                <table className="t">
                  <thead><tr><th>Branch</th><th>Area</th><th>Languages</th><th></th></tr></thead>
                  <tbody>
                    {b.branches.map((br) => (
                      <tr key={br.id}>
                        <td><b>{br.name}</b></td>
                        <td>{br.cityArea}</td>
                        <td>{br.languages.map((l) => ({ en: "English", hi: "Hindi", hinglish: "Hinglish" })[l]).join(", ")}</td>
                        <td className="r"><Link href={`/dashboard/branches/${br.id}`}>Settings</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted">No branches yet. <Link href={`/dashboard/businesses/${b.id}#add-branch`}>Add a branch</Link></p>
            )}
          </section>
        ))}
      </div>
      <details className="panel">
        <summary style={{ cursor: "pointer", fontWeight: 700 }}>+ Add a business</summary>
        <form action={createBusiness} style={{ display: "grid", gap: 14, marginTop: 12 }}>
          <BusinessFields />
          <button className="btn" type="submit" style={{ justifySelf: "start" }}>Create business</button>
        </form>
      </details>
    </>
  );
}
