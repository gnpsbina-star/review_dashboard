import type { Metadata } from "next";
import Link from "next/link";
import { prepareIdCards } from "./actions";
import { requireAccess } from "@/lib/access";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "ID cards" };

export default async function IdCardsPage(props: PageProps<"/dashboard/id-cards">) {
  const a = await requireAccess({ ownerOnly: true });
  const sp = await props.searchParams;
  const branches = await db.branch.findMany({
    where: { organizationId: a.org.id, archivedAt: null },
    include: { business: { select: { name: true } } },
    orderBy: [{ business: { name: "asc" } }, { name: "asc" }],
  });
  const branchId = typeof sp.branch === "string" && branches.some((b) => b.id === sp.branch) ? sp.branch : branches[0]?.id;
  const staff = branchId
    ? await db.staff.findMany({ where: { organizationId: a.org.id, branchId, active: true }, orderBy: { name: "asc" } })
    : [];
  const missing = staff.filter((s) => !s.photoKey || !s.designation).length;

  return (
    <>
      <div className="mhead"><div><h1>Employee ID cards</h1><div className="who">Standard ID size with the staff member’s own review QR code on the back</div></div></div>
      {sp.error === "pick" && <div className="flash error" role="alert">Choose at least one staff member.</div>}
      {branches.length === 0 ? (
        <div className="placeholder"><b>Add a branch and staff first.</b><Link className="btn" href="/dashboard/businesses">Businesses &amp; branches</Link></div>
      ) : (
        <>
          <form action="/dashboard/id-cards" className="toolbar">
            <label className="sr-only" htmlFor="idc-branch">Branch</label>
            <select id="idc-branch" name="branch" className="select" defaultValue={branchId}>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.business.name} · {b.name}</option>)}
            </select>
            <button className="btn-ghost btn-sm" type="submit">Show</button>
          </form>
          {staff.length === 0 ? (
            <div className="placeholder"><b>No active staff in this branch.</b><Link href={`/dashboard/branches/${branchId}`}>Add staff</Link></div>
          ) : (
            <form action={prepareIdCards} className="panel">
              <input type="hidden" name="branch" value={branchId} />
              {missing > 0 && <div className="notice warn"><span>{missing} of {staff.length} cards are missing a photo or designation. They still print, but look better complete.</span></div>}
              <div className="tscroll">
                <table className="t">
                  <thead><tr><th>Print</th><th>Name</th><th>Designation</th><th>Employee ID</th><th>Photo</th></tr></thead>
                  <tbody>
                    {staff.map((s) => (
                      <tr key={s.id}>
                        <td><input type="checkbox" name="staffIds" value={s.id} defaultChecked aria-label={`Print ${s.name}`} style={{ width: 18, height: 18, accentColor: "var(--accent)" }} /></td>
                        <td><Link href={`/dashboard/staff/${s.id}`}><b>{s.name}</b></Link></td>
                        <td>{s.designation ?? <span className="muted">Not set</span>}</td>
                        <td>{s.employeeCode ?? "–"}</td>
                        <td>{s.photoKey ? "✓ Added" : <Link href={`/dashboard/staff/${s.id}`}>Add photo</Link>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <fieldset className="toolbar" style={{ border: 0, padding: 0, margin: 0, gap: 18 }}>
                <legend className="sub-h" style={{ marginBottom: 8 }}>Print on</legend>
                <label className="check"><input type="radio" name="layout" value="a4" defaultChecked /> A4 sheets (9 per sheet, for normal printers or a print shop)</label>
                <label className="check"><input type="radio" name="layout" value="single" /> Single cards (PVC ID card printer)</label>
              </fieldset>
              <button className="btn" type="submit" style={{ justifySelf: "start" }}>Preview and print</button>
            </form>
          )}
        </>
      )}
    </>
  );
}
