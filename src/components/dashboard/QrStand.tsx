import { initials } from "@/components/ui";

/** Printable stand card. Always black-on-white so it scans in any light. */
export function QrStand(p: { path: { d: string; size: number }; url: string; label: string; businessName: string; branchName: string; color: string; logoUrl: string | null }) {
  const q = 4;
  const s = p.path.size + 2 * q;
  return (
    <div className="stand">
      <div className="stand-top" style={{ background: p.color }}>
        <div className="logo" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {p.logoUrl ? <img src={p.logoUrl} alt="" /> : initials(p.businessName)}
        </div>
        <b style={{ fontSize: 13.5, lineHeight: 1.2 }}>
          {p.businessName}
          <br />
          <span style={{ fontWeight: 500, opacity: 0.85 }}>{p.branchName}</span>
        </b>
      </div>
      <div className="stand-body">
        <svg viewBox={`${-q} ${-q} ${s} ${s}`} role="img" aria-label={`QR code for ${p.url}`} shapeRendering="crispEdges">
          <rect x={-q} y={-q} width={s} height={s} fill="#fff" />
          <path d={p.path.d} fill="#111" />
        </svg>
        <div className="stand-cta">Scan to rate your visit</div>
        <div className="stand-label">{p.label}</div>
        <div className="stand-url">{p.url.replace(/^https?:\/\//, "")}</div>
      </div>
    </div>
  );
}
