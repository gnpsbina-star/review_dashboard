import { BusinessLogo } from "@/components/ui";
import { T } from "@/lib/customer-i18n";

/** Shown when the client's subscription is locked: no AI, no form, no data collected. */
export function LockedReviewPage(p: { businessId: string; businessName: string; logoVersion: number; branchName: string; cityArea: string; googleUrl: string; facebookUrl: string | null; brand: string }) {
  const t = T.en;
  return (
    <main className="cx" style={{ ["--brand-ui" as string]: p.brand }}>
      <div className="cx-wrap">
        <div className="cx-scroll" style={{ alignItems: "center", textAlign: "center", justifyContent: "center" }}>
          <BusinessLogo businessId={p.businessId} name={p.businessName} logoVersion={p.logoVersion} color={p.brand} size={56} />
          <h1 className="q q-sm">{t.lockedH(p.businessName)}</h1>
          <p className="q-sub">{t.lockedS}</p>
          <a className="btn-brand" style={{ width: "100%" }} href={p.googleUrl} target="_blank" rel="noopener noreferrer">{t.lockedBtn}</a>
          {p.facebookUrl && <a className="btn-quiet" style={{ width: "100%" }} href={p.facebookUrl} target="_blank" rel="noopener noreferrer">{t.lockedFb}</a>}
        </div>
        <div className="cx-foot">{t.poweredBy} <b>Synergy Technologies</b> · <a href="/privacy" target="_blank" rel="noopener">{t.privacy}</a></div>
      </div>
    </main>
  );
}
