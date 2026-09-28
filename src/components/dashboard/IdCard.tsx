import { initials } from "@/components/ui";
import type { IdCardData } from "@/lib/data/id-cards";

/* eslint-disable @next/next/no-img-element -- private, access-checked images; next/image adds nothing for print */

function Logo({ c }: { c: IdCardData }) {
  return <div className="idc-logo" aria-hidden>{c.business.logoUrl ? <img src={c.business.logoUrl} alt="" /> : initials(c.business.name)}</div>;
}

/** Front: brand header, photo, name, designation and key details. 54 × 85.6 mm (CR80, portrait). */
export function IdCardFront({ c }: { c: IdCardData }) {
  return (
    <div className="idc" style={{ ["--idc-brand" as string]: c.business.color }}>
      <div className="idc-head">
        <Logo c={c} />
        <div>
          <div className="idc-biz">{c.business.name}</div>
          <div className="idc-branch">{c.branchName}</div>
        </div>
      </div>
      <div className="idc-photo">{c.photoUrl ? <img src={c.photoUrl} alt={`Photo of ${c.name}`} /> : <span>{initials(c.name)}</span>}</div>
      <div className="idc-name">{c.name}</div>
      {c.designation && <div className="idc-role">{c.designation}</div>}
      <dl className="idc-facts">
        <div><dt>Employee ID</dt><dd>{c.employeeCode ?? "–"}</dd></div>
        {c.bloodGroup && <div><dt>Blood</dt><dd>{c.bloodGroup}</dd></div>}
        {c.validUntil && <div><dt>Valid till</dt><dd>{c.validUntil}</dd></div>}
      </dl>
      <div className="idc-foot" />
    </div>
  );
}

/** Back: the staff member's review QR code, return address and emergency contact. */
export function IdCardBack({ c }: { c: IdCardData }) {
  const q = 2;
  return (
    <div className="idc idc-back" style={{ ["--idc-brand" as string]: c.business.color }}>
      <div className="idc-band" />
      {c.qr ? (
        <svg className="idc-qr" viewBox={`${-q} ${-q} ${c.qr.path.size + 2 * q} ${c.qr.path.size + 2 * q}`} role="img" aria-label={`Review QR code for ${c.name}`} shapeRendering="crispEdges">
          <rect x={-q} y={-q} width={c.qr.path.size + 2 * q} height={c.qr.path.size + 2 * q} fill="#fff" />
          <path d={c.qr.path.d} fill="#000" />
        </svg>
      ) : (
        <div className="idc-qr idc-noqr">No QR code</div>
      )}
      <div className="idc-scan">Scan to rate my service</div>
      <div className="idc-small">{c.name}{c.employeeCode ? ` · ${c.employeeCode}` : ""}</div>
      <div className="idc-rule" />
      <div className="idc-return">
        <div className="idc-label">If found, please return to</div>
        <div className="idc-strong">{c.business.name}, {c.branchName}</div>
        <div>{c.business.address ?? c.cityArea}</div>
      </div>
      {c.emergency && (
        <div className="idc-return">
          <div className="idc-label">Emergency contact</div>
          <div className="idc-strong">+91 {c.emergency.slice(0, 5)} {c.emergency.slice(5)}</div>
        </div>
      )}
      <div className="idc-foot" />
    </div>
  );
}
