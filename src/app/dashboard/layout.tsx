import type { Metadata } from "next";
import { NavLinks, type NavItem } from "@/components/dashboard/NavLinks";
import { OrgSwitcher } from "@/components/dashboard/OrgSwitcher";
import { initials } from "@/components/ui";
import { isLocked, requireAccess, reviewScope } from "@/lib/access";
import { db } from "@/lib/db";
import { shortDate, titleCase } from "@/lib/format";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const a = await requireAccess({ allowLocked: true });
  const locked = isLocked(a) && !a.viaPlatform;
  const owner = a.role === "CLIENT_OWNER";
  const [newCount, branchCount, businessCount] = locked
    ? [0, 0, 0]
    : await Promise.all([
        db.review.count({ where: { ...reviewScope(a), source: "INTERCEPTED", status: "NEW" } }),
        db.branch.count({ where: { organizationId: a.org.id, archivedAt: null, ...(a.branchIds ? { id: { in: a.branchIds } } : {}) } }),
        db.business.count({ where: { organizationId: a.org.id, archivedAt: null } }),
      ]);

  const items: NavItem[] = locked
    ? []
    : [
        { href: "/dashboard", label: "Reviews", icon: "reviews", count: newCount },
        { href: "/dashboard/analytics", label: "Analytics", icon: "analytics" },
        ...(owner
          ? ([
              { href: "/dashboard/qr", label: "QR studio", icon: "qr" },
              { href: "/dashboard/businesses", label: "Businesses & branches", icon: "businesses" },
              { href: "/dashboard/team", label: "Team", icon: "team" },
            ] as NavItem[])
          : []),
      ];

  return (
    <div className="shell">
      <aside className="side no-print">
        <div className="org">
          <div className="logo" aria-hidden style={{ background: "#8A3A0B" }}>{initials(a.org.name)}</div>
          <div>
            <div className="org-name">{a.org.name}</div>
            <div className="org-sub">
              {owner ? `${businessCount} ${businessCount === 1 ? "business" : "businesses"} · ${branchCount} ${branchCount === 1 ? "branch" : "branches"}` : `${branchCount} assigned ${branchCount === 1 ? "branch" : "branches"}`}
            </div>
          </div>
        </div>
        {a.memberships.length > 1 && <OrgSwitcher current={a.org.id} options={a.memberships} />}
        <NavLinks items={items} />
        <div className="side-foot">
          {a.viaPlatform && <a className="btn-ghost btn-sm" href="/platform">← Back to platform</a>}
          {owner && a.sub.endsAt && (
            <>
              <span className={`statuspill st-${a.sub.state}`}>{titleCase(a.sub.state === "PURGE_DUE" ? "LOCKED" : a.sub.state)}</span>
              <span>
                {a.plan.name} plan · {a.sub.state === "TRIAL" ? "trial ends" : a.sub.state === "ACTIVE" ? "renews" : "ended"} {shortDate(a.sub.endsAt)}
              </span>
            </>
          )}
          <span>
            {a.user.name ?? a.user.email} · {a.viaPlatform ? "Platform owner" : owner ? "Client Owner" : "Branch Admin"}
          </span>
          <form method="post" action="/api/auth/logout">
            <button className="linkbtn" type="submit">Sign out</button>
          </form>
        </div>
      </aside>
      <div className="main">
        {!locked && a.sub.state === "GRACE" && owner && (
          <div className="banner warn" role="status">
            <span>
              Your yearly plan ended on {shortDate(a.sub.endsAt!)}. Everything keeps working until {shortDate(a.sub.locksAt!)}. Renew to avoid interruption.
            </span>
          </div>
        )}
        {!locked && a.sub.state === "TRIAL" && owner && a.sub.daysLeft !== null && a.sub.daysLeft <= 7 && (
          <div className="banner info" role="status">
            <span>Your free trial ends in {a.sub.daysLeft} {a.sub.daysLeft === 1 ? "day" : "days"}. Contact Synergy Technologies to start your yearly plan.</span>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
