import Link from "next/link";
import { Flash } from "@/components/dashboard/Flash";
import { renewYear } from "./actions";
import { requirePlatformOwner } from "@/lib/access";
import { db } from "@/lib/db";
import { activeBackend } from "@/lib/storage";
import { shortDate, titleCase } from "@/lib/format";
import { subscriptionInfo, type SubInfo } from "@/lib/subscription";

function datesText(s: SubInfo): string {
  if (!s.endsAt) return "No plan yet";
  if (s.state === "ACTIVE") return `Renews ${shortDate(s.endsAt)}`;
  if (s.state === "TRIAL") return `Trial ends ${shortDate(s.endsAt)} · ${s.daysLeft} ${s.daysLeft === 1 ? "day" : "days"} left`;
  if (s.state === "GRACE") return `Ended ${shortDate(s.endsAt)} · locks ${shortDate(s.locksAt!)}`;
  return `Locked ${shortDate(s.locksAt!)} · data deleted ${shortDate(s.purgeAt!)}`;
}

async function loadUsage() {
  const dayStart = new Date(Date.now() - 86_400_000);
  const [size, emails, ratings, branches, orgs, photoBytes] = await Promise.all([
    db.$queryRaw<{ bytes: bigint }[]>`SELECT pg_database_size(current_database())::bigint AS bytes`,
    db.emailLog.count({ where: { createdAt: { gte: dayStart } } }),
    db.review.count({ where: { createdAt: { gte: dayStart } } }),
    db.branch.count({ where: { archivedAt: null } }),
    db.organization.findMany({ include: { subscription: true, _count: { select: { branches: { where: { archivedAt: null } } } } }, orderBy: { name: "asc" } }),
    db.reviewPhoto.aggregate({ _sum: { bytes: true } }),
  ]);
  return { mb: Number(size[0].bytes) / 1_048_576, emails, ratings, branches, orgs, photoMb: (photoBytes._sum.bytes ?? 0) / 1_048_576 };
}

function Meter({ label, value, of, pct }: { label: string; value: string; of: string; pct?: number }) {
  return (
    <div className="meter">
      <div className="meter-top"><span>{label}</span><span>{of}</span></div>
      <div className="meter-v">{value}</div>
      {pct !== undefined && <div className="track"><div className={`fill ${pct > 80 ? "warn" : ""}`} style={{ width: `${Math.min(100, Math.max(pct, 1.5))}%` }} /></div>}
    </div>
  );
}

const LIFE = [
  ["Trial", "Up to 14 days, free", "var(--accent)"],
  ["Active", "1 year, everything works", "var(--good)"],
  ["Grace", "7 days after expiry, still works", "var(--warn)"],
  ["Locked", "Renewal screen; QR page shows a Google button only", "var(--crit)"],
  ["Data deleted", "90 days after locking, warning email first", "var(--muted)"],
] as const;

export default async function PlatformHome(props: PageProps<"/platform">) {
  await requirePlatformOwner();
  const sp = await props.searchParams;
  const u = await loadUsage();

  return (
    <>
      <div className="mhead">
        <div><h1>Client accounts</h1><div className="who">Every client, their yearly plan and free-tier usage</div></div>
        <Link className="btn" href="/platform/clients/new">+ New client</Link>
      </div>
      <Flash sp={sp} />
      {sp.saved === "renewed" && <div className="flash">Renewed for one year. The account is unlocked.</div>}
      <div className="meters">
        <Meter label="Database" value={`${u.mb.toFixed(1)} MB`} of="of 512 MB free" pct={(u.mb / 512) * 100} />
        <Meter label="Emails, 24 h" value={String(u.emails)} of="of 100 free" pct={u.emails} />
        <Meter label="Customer photos" value={`${u.photoMb.toFixed(1)} MB`} of={activeBackend() === "r2" ? "of 10 GB free (R2)" : "in database"} pct={activeBackend() === "r2" ? (u.photoMb / 10240) * 100 : undefined} />
        <Meter label="Ratings, 24 h" value={String(u.ratings)} of="all clients" />
        <Meter label="Active branches" value={String(u.branches)} of={`${u.orgs.length} clients`} />
      </div>
      <section className="panel">
        <h3>How a yearly subscription moves</h3>
        <p className="cap">Renewing at any point before deletion brings everything back instantly: same QR codes, reviews and settings.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
          {LIFE.map(([t, d, c]) => (
            <div key={t} style={{ display: "grid", gap: 4 }}>
              <span style={{ height: 4, borderRadius: 2, background: c }} />
              <b>{t}</b><span className="help">{d}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="panel">
        <div className="tscroll">
          <table className="t">
            <thead><tr><th>Client</th><th>Plan</th><th className="r">Branches</th><th>Status</th><th>Dates</th><th></th></tr></thead>
            <tbody>
              {u.orgs.map((o) => {
                const s = subscriptionInfo(o.subscription);
                const state = o.status === "SUSPENDED" ? "SUSPENDED" : s.state === "PURGE_DUE" ? "LOCKED" : s.state;
                return (
                  <tr key={o.id}>
                    <td><Link href={`/platform/clients/${o.id}`}><b>{o.name}</b></Link></td>
                    <td>{o.subscription?.planName ?? "–"}</td>
                    <td className="r">{o._count.branches} of {o.subscription?.maxBranches ?? 0}</td>
                    <td><span className={`statuspill st-${state}`}>{titleCase(state)}</span></td>
                    <td>{datesText(s)}</td>
                    <td className="r">
                      <form action={renewYear}>
                        <input type="hidden" name="orgId" value={o.id} />
                        <input type="hidden" name="back" value="list" />
                        <button className={state === "ACTIVE" ? "btn-ghost btn-sm" : "btn btn-sm"} type="submit">{s.state === "TRIAL" ? "Start 1-year plan" : "Renew 1 year"}</button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {u.orgs.length === 0 && <p className="muted">No clients yet. Create the first one.</p>}
      </section>
    </>
  );
}
