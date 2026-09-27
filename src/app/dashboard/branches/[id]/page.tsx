import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BranchFields } from "@/components/dashboard/BranchFields";
import { ConfirmButton } from "@/components/dashboard/ConfirmButton";
import { Flash } from "@/components/dashboard/Flash";
import { addStaff, archiveBranch, regenerateSuggestions, setStaffActive, updateBranch } from "../../businesses/actions";
import { requireAccess } from "@/lib/access";
import { LANG_LABELS } from "@/lib/customer-i18n";
import { db } from "@/lib/db";
import { qrUrl } from "@/lib/env";
import { relativeTime } from "@/lib/format";

export const metadata: Metadata = { title: "Branch settings" };

export default async function BranchPage(props: PageProps<"/dashboard/branches/[id]">) {
  const a = await requireAccess({ ownerOnly: true });
  const { id } = await props.params;
  const sp = await props.searchParams;
  const br = await db.branch.findFirst({
    where: { id, organizationId: a.org.id, archivedAt: null },
    include: { business: true, staff: { orderBy: [{ active: "desc" }, { name: "asc" }] }, qrCodes: { where: { key: "branch" } } },
  });
  if (!br) notFound();
  const [counts, sample] = await Promise.all([
    db.aiSuggestion.groupBy({ by: ["language", "ratingTier"], where: { branchId: br.id }, _count: true }),
    db.aiSuggestion.findMany({ where: { branchId: br.id, ratingTier: 5 }, take: 4, orderBy: { id: "asc" } }),
  ]);
  const total = counts.reduce((n, c) => n + c._count, 0);
  const branchQr = br.qrCodes[0];

  return (
    <>
      <div className="mhead">
        <div><Link href={`/dashboard/businesses/${br.businessId}`} className="help">← {br.business.name}</Link><h1>{br.name}</h1><div className="who">Web address: /{br.slug} · fixed so printed QR codes keep working</div></div>
        {branchQr && <a className="btn-ghost btn-sm" href={qrUrl(branchQr.code)} target="_blank" rel="noopener noreferrer">Open customer page</a>}
      </div>
      <Flash sp={sp} />

      <section className="panel">
        <h3>Branch details and AI settings</h3>
        <form action={updateBranch} style={{ display: "grid", gap: 14 }}>
          <input type="hidden" name="branchId" value={br.id} />
          <BranchFields br={br} />
          <button className="btn" type="submit" style={{ justifySelf: "start" }}>Save changes</button>
        </form>
      </section>

      <section className="panel">
        <h3>Review suggestions</h3>
        <p className="cap">
          {total} suggestions ready{br.suggestionsRefreshedAt ? `, written ${relativeTime(br.suggestionsRefreshedAt)}` : ""}. They refresh every week and whenever you change the settings above.
        </p>
        {sample.length > 0 && (
          <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
            {sample.map((s) => <li key={s.id}><span className="lbadge">{LANG_LABELS[s.language]}</span> {s.text.replaceAll("{{staff}}", "[staff name]")}</li>)}
          </ul>
        )}
        <form action={regenerateSuggestions}>
          <input type="hidden" name="branchId" value={br.id} />
          <button className="btn-ghost" type="submit">Write new suggestions now</button>
        </form>
      </section>

      <section className="panel">
        <h3>Staff</h3>
        <p className="cap">Each staff member gets their own QR code, so ratings show who served the customer.</p>
        {br.staff.length > 0 && (
          <div className="tscroll">
            <table className="t">
              <thead><tr><th>Name</th><th>Employee ID</th><th>ID card photo</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {br.staff.map((s) => (
                  <tr key={s.id}>
                    <td><Link href={`/dashboard/staff/${s.id}`}><b>{s.name}</b></Link>{s.designation ? <span className="help"> · {s.designation}</span> : null}</td>
                    <td>{s.employeeCode ?? "–"}</td>
                    <td>{s.photoKey ? "Added" : <Link href={`/dashboard/staff/${s.id}`}>Add photo</Link>}</td>
                    <td>{s.active ? "Active" : "Inactive"}</td>
                    <td className="r">
                      <form action={setStaffActive}>
                        <input type="hidden" name="staffId" value={s.id} />
                        <input type="hidden" name="active" value={s.active ? "false" : "true"} />
                        <button className="linkbtn" type="submit">{s.active ? "Deactivate" : "Reactivate"}</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <form action={addStaff} className="toolbar">
          <input type="hidden" name="branchId" value={br.id} />
          <label className="sr-only" htmlFor="staff-name">Staff name</label>
          <input id="staff-name" name="name" className="input" required maxLength={40} placeholder="Staff name" style={{ maxWidth: 260 }} />
          <button className="btn-ghost" type="submit">Add staff</button>
        </form>
      </section>

      <section className="panel">
        <h3>Archive this branch</h3>
        <p className="muted">Its QR codes will show an “isn’t active” page. Reviews stay in your records.</p>
        <form action={archiveBranch}>
          <input type="hidden" name="branchId" value={br.id} />
          <ConfirmButton className="btn-danger" message={`Archive ${br.name}? Its printed QR codes will stop working.`}>Archive branch</ConfirmButton>
        </form>
      </section>
    </>
  );
}
