import type { Metadata } from "next";
import { ConfirmButton } from "@/components/dashboard/ConfirmButton";
import { Flash } from "@/components/dashboard/Flash";
import { MemberFields } from "@/components/dashboard/MemberFields";
import { inviteMember, removeMember, updateMember } from "./actions";
import { requireAccess } from "@/lib/access";
import { db } from "@/lib/db";
import { relativeTime } from "@/lib/format";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage(props: PageProps<"/dashboard/team">) {
  const a = await requireAccess({ ownerOnly: true });
  const sp = await props.searchParams;
  const [members, branchRows] = await Promise.all([
    db.membership.findMany({ where: { organizationId: a.org.id }, include: { user: true, branches: true }, orderBy: [{ role: "asc" }, { createdAt: "asc" }] }),
    db.branch.findMany({ where: { organizationId: a.org.id, archivedAt: null }, include: { business: { select: { name: true } } }, orderBy: [{ business: { name: "asc" } }, { name: "asc" }] }),
  ]);
  const branches = branchRows.map((b) => ({ id: b.id, label: `${b.business.name} · ${b.name}` }));
  const label = new Map(branches.map((b) => [b.id, b.label]));

  return (
    <>
      <div className="mhead"><div><h1>Team</h1><div className="who">Only people listed here can sign in to {a.org.name}</div></div></div>
      <Flash sp={sp} />
      <section className="panel">
        <h3>Invite someone</h3>
        <p className="cap">They sign in with Google using this exact email. No password is needed.</p>
        <form action={inviteMember} style={{ display: "grid", gap: 12 }}>
          <div className="field" style={{ maxWidth: 420 }}><label htmlFor="inv-email">Google email</label><input id="inv-email" name="email" type="email" required maxLength={200} placeholder="manager@gmail.com" /></div>
          <MemberFields idPrefix="inv" branches={branches} />
          <button className="btn" type="submit" style={{ justifySelf: "start" }}>Invite</button>
        </form>
      </section>
      <section className="panel">
        <h3>People ({members.length})</h3>
        <div style={{ display: "grid", gap: 10 }}>
          {members.map((m) => (
            <details key={m.id} className="panel" style={{ background: "var(--surface-2)", borderColor: "transparent" }}>
              <summary style={{ cursor: "pointer", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
                <b>{m.user.name ?? m.user.email}</b>
                <span className="muted">{m.user.email}</span>
                <span className="lbadge">{m.role === "CLIENT_OWNER" ? "Client Owner" : "Branch Admin"}</span>
                <span className="help">{m.role === "BRANCH_ADMIN" ? m.branches.map((b) => label.get(b.branchId)).filter(Boolean).join(", ") : "All branches"}</span>
                <span className="help">{m.user.lastLoginAt ? `Last signed in ${relativeTime(m.user.lastLoginAt)}` : "Hasn’t signed in yet"}</span>
              </summary>
              <form action={updateMember} style={{ display: "grid", gap: 12, marginTop: 10 }}>
                <input type="hidden" name="membershipId" value={m.id} />
                <MemberFields idPrefix={m.id} branches={branches} role={m.role} assigned={m.branches.map((b) => b.branchId)} alerts={m.receiveAllAlerts} />
                <div className="toolbar">
                  <button className="btn-ghost" type="submit">Save</button>
                </div>
              </form>
              <form action={removeMember} style={{ marginTop: 8 }}>
                <input type="hidden" name="membershipId" value={m.id} />
                <ConfirmButton className="btn-danger btn-sm" message={`Remove ${m.user.email}? They lose access immediately.`}>Remove from team</ConfirmButton>
              </form>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
