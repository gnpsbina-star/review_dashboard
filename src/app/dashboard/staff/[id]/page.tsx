import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Flash } from "@/components/dashboard/Flash";
import { initials } from "@/components/ui";
import { removeStaffPhoto, updateStaff } from "../actions";
import { prepareIdCards } from "../../id-cards/actions";
import { StaffPhotoEditor } from "@/components/dashboard/StaffPhotoEditor";
import { readableBrandColor } from "@/lib/contrast";
import { setStaffActive } from "../../businesses/actions";
import { requireAccess } from "@/lib/access";
import { decryptField } from "@/lib/crypto";
import { db } from "@/lib/db";
import { BLOOD_GROUPS } from "@/lib/staff";

export const metadata: Metadata = { title: "Staff details" };

function isoDate(d: Date | null) {
  return d ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d) : "";
}

export default async function StaffPage(props: PageProps<"/dashboard/staff/[id]">) {
  const a = await requireAccess({ ownerOnly: true });
  const { id } = await props.params;
  const sp = await props.searchParams;
  const s = await db.staff.findFirst({ where: { id, organizationId: a.org.id }, include: { branch: { include: { business: true } } } });
  if (!s) notFound();
  const emergency = decryptField(s.emergencyContactEnc);

  return (
    <>
      <div className="mhead">
        <div>
          <Link href={`/dashboard/branches/${s.branchId}`} className="help">← {s.branch.business.name} · {s.branch.name}</Link>
          <h1>{s.name}</h1>
          <div className="who">{s.employeeCode ?? "No employee ID yet"} · {s.active ? "Active" : "Inactive"}</div>
        </div>
        {s.active && (
          <form action={prepareIdCards} className="toolbar">
            <input type="hidden" name="staffIds" value={s.id} />
            <input type="hidden" name="layout" value="single" />
            <button className="btn" type="submit">Print ID card</button>
          </form>
        )}
      </div>
      <Flash sp={sp} />

      <section className="panel">
        <h3>Photo for the ID card</h3>
        <div className="toolbar" style={{ gap: 18, alignItems: "flex-start" }}>
          <div className="staff-photo">
            {s.photoKey ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/staff-photo/${s.id}?v=${s.photoVersion}`} alt={`Photo of ${s.name}`} width={120} height={150} />
            ) : (
              <span aria-hidden>{initials(s.name)}</span>
            )}
          </div>
          <div style={{ display: "grid", gap: 10, flex: 1, minWidth: 240 }}>
            <StaffPhotoEditor staffId={s.id} staffName={s.name} brandColor={readableBrandColor(s.branch.business.brandColor).color} hasPhoto={!!s.photoKey} />
            <p className="help">A clear, front-facing photo works best. JPG, PNG or WebP up to 4 MB. Auto-enhance runs on this device: the photo isn’t sent anywhere until you save it. Only Client Owners can see saved photos.</p>
            {s.photoKey && (
              <form action={removeStaffPhoto}><input type="hidden" name="staffId" value={s.id} /><button className="linkbtn" type="submit">Remove photo</button></form>
            )}
          </div>
        </div>
      </section>

      <section className="panel">
        <h3>ID card details</h3>
        <form action={updateStaff} style={{ display: "grid", gap: 14 }}>
          <input type="hidden" name="staffId" value={s.id} />
          <div className="form-grid">
            <div className="field"><label htmlFor="s-name">Full name</label><input id="s-name" name="name" required maxLength={40} defaultValue={s.name} /></div>
            <div className="field"><label htmlFor="s-des">Designation <span className="opt">(optional)</span></label><input id="s-des" name="designation" maxLength={40} placeholder="Senior Waiter" defaultValue={s.designation ?? ""} /></div>
            <div className="field"><label htmlFor="s-code">Employee ID</label><input id="s-code" name="employeeCode" maxLength={20} defaultValue={s.employeeCode ?? ""} placeholder="Created automatically" /></div>
            <div className="field"><label htmlFor="s-blood">Blood group <span className="opt">(optional)</span></label>
              <select id="s-blood" name="bloodGroup" defaultValue={s.bloodGroup ?? ""}>
                <option value="">Not shown</option>
                {BLOOD_GROUPS.map((g) => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div className="field"><label htmlFor="s-em">Emergency contact <span className="opt">(optional)</span></label><input id="s-em" name="emergencyContact" inputMode="tel" maxLength={20} placeholder="98765 43210" defaultValue={emergency ?? ""} /><span className="help">Stored encrypted.</span></div>
            <div className="field"><label htmlFor="s-valid">Valid until <span className="opt">(optional)</span></label><input id="s-valid" name="validUntil" type="date" defaultValue={isoDate(s.validUntil)} /></div>
          </div>
          <button className="btn" type="submit" style={{ justifySelf: "start" }}>Save details</button>
        </form>
      </section>

      <section className="panel">
        <h3>{s.active ? "Deactivate" : "Reactivate"}</h3>
        <p className="muted">{s.active ? "Inactive staff are hidden from new ratings and ID card printing. Their past ratings stay." : "Reactivating brings back their QR code and ID card."}</p>
        <form action={setStaffActive}>
          <input type="hidden" name="staffId" value={s.id} />
          <input type="hidden" name="active" value={s.active ? "false" : "true"} />
          <button className={s.active ? "btn-danger" : "btn-ghost"} type="submit">{s.active ? "Deactivate" : "Reactivate"}</button>
        </form>
      </section>
    </>
  );
}
