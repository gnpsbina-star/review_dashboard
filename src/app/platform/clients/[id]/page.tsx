import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmButton } from "@/components/dashboard/ConfirmButton";
import { Flash } from "@/components/dashboard/Flash";
import { extendTrial, renewYear, setSuspended, updateClient, viewClientDashboard } from "../../actions";
import { requirePlatformOwner } from "@/lib/access";
import { db } from "@/lib/db";
import { exactTime, shortDate, titleCase } from "@/lib/format";
import { subscriptionInfo } from "@/lib/subscription";

export default async function ClientPage(props: PageProps<"/platform/clients/[id]">) {
  await requirePlatformOwner();
  const { id } = await props.params;
  const sp = await props.searchParams;
  const o = await db.organization.findUnique({
    where: { id },
    include: { subscription: true, memberships: { include: { user: true } }, _count: { select: { branches: { where: { archivedAt: null } }, businesses: { where: { archivedAt: null } }, reviews: true } } },
  });
  if (!o) notFound();
  const logs = await db.auditLog.findMany({ where: { organizationId: o.id }, orderBy: { createdAt: "desc" }, take: 40 });
  const s = subscriptionInfo(o.subscription);
  const state = o.status === "SUSPENDED" ? "SUSPENDED" : s.state === "PURGE_DUE" ? "LOCKED" : s.state;

  return (
    <>
      <div className="mhead">
        <div><Link className="help" href="/platform">← Client accounts</Link><h1>{o.name}</h1><div className="who">{o._count.businesses} businesses · {o._count.branches} branches · {o._count.reviews} reviews</div></div>
        <form action={viewClientDashboard}><input type="hidden" name="orgId" value={o.id} /><button className="btn-ghost" type="submit">Open their dashboard</button></form>
      </div>
      <Flash sp={sp} />
      {sp.saved === "renewed" && <div className="flash">Renewed for one year.</div>}

      <section className="panel">
        <h3>Subscription</h3>
        <div className="toolbar" style={{ gap: 14 }}>
          <span className={`statuspill st-${state}`}>{titleCase(state)}</span>
          {s.endsAt && <span>{s.state === "TRIAL" ? "Trial ends" : s.state === "ACTIVE" ? "Paid until" : "Ended"} <b>{shortDate(s.endsAt)}</b></span>}
          {s.state === "GRACE" && <span className="muted">Locks {shortDate(s.locksAt!)}</span>}
          {(s.state === "LOCKED" || s.state === "PURGE_DUE") && <span className="muted">Data deleted {shortDate(s.purgeAt!)}</span>}
        </div>
        <div className="toolbar">
          <form action={renewYear}><input type="hidden" name="orgId" value={o.id} /><button className="btn" type="submit">{s.state === "TRIAL" ? "Start 1-year plan" : "Renew 1 year"}</button></form>
          {(s.state === "TRIAL" || !o.subscription?.currentPeriodEnd) && (
            <form action={extendTrial} className="toolbar"><input type="hidden" name="orgId" value={o.id} /><input type="hidden" name="days" value="7" /><button className="btn-ghost" type="submit">Extend trial by 7 days</button></form>
          )}
          <form action={setSuspended}>
            <input type="hidden" name="orgId" value={o.id} />
            <input type="hidden" name="suspend" value={o.status === "SUSPENDED" ? "false" : "true"} />
            {o.status === "SUSPENDED" ? (
              <button className="btn-ghost" type="submit">Resume account</button>
            ) : (
              <ConfirmButton className="btn-danger" message={`Pause ${o.name}? Their dashboard locks and QR pages show only a Google button.`}>Pause account</ConfirmButton>
            )}
          </form>
        </div>
      </section>

      <section className="panel">
        <h3>Plan</h3>
        <form action={updateClient} style={{ display: "grid", gap: 12 }}>
          <input type="hidden" name="orgId" value={o.id} />
          <div className="form-grid">
            <div className="field full"><label htmlFor="o-name">Client name</label><input id="o-name" name="name" required maxLength={100} defaultValue={o.name} /></div>
            <div className="field"><label htmlFor="o-plan">Plan name</label><input id="o-plan" name="planName" required maxLength={40} defaultValue={o.subscription?.planName ?? "Starter"} /></div>
            <div className="field"><label htmlFor="o-max">Branch limit</label><input id="o-max" name="maxBranches" type="number" min={1} max={500} defaultValue={o.subscription?.maxBranches ?? 2} /></div>
          </div>
          <button className="btn-ghost" type="submit" style={{ justifySelf: "start" }}>Save plan</button>
        </form>
      </section>

      <section className="panel">
        <h3>People</h3>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {o.memberships.map((m) => <li key={m.id}>{m.user.email} · {m.role === "CLIENT_OWNER" ? "Client Owner" : "Branch Admin"}</li>)}
        </ul>
      </section>

      <section className="panel">
        <h3>Activity log</h3>
        <div className="tscroll">
          <table className="t">
            <thead><tr><th>When</th><th>Who</th><th>What</th></tr></thead>
            <tbody>
              {logs.map((l) => <tr key={l.id}><td>{exactTime(l.createdAt)}</td><td>{l.actorEmail ?? "System"}</td><td>{l.action}</td></tr>)}
            </tbody>
          </table>
        </div>
        {logs.length === 0 && <p className="muted">No activity yet.</p>}
      </section>
    </>
  );
}
