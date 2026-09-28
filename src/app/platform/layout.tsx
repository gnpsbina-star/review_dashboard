import type { Metadata } from "next";
import { NavLinks } from "@/components/dashboard/NavLinks";
import { Mark } from "@/components/ui";
import { requirePlatformOwner } from "@/lib/access";

export const metadata: Metadata = { title: "Platform" };

export default async function PlatformLayout({ children }: LayoutProps<"/platform">) {
  const me = await requirePlatformOwner();
  return (
    <div className="shell">
      <aside className="side">
        <Mark />
        <NavLinks
          items={[
            { href: "/platform", label: "Client accounts", icon: "clients" },
            { href: "/platform/settings", label: "AI & settings", icon: "settings" },
          ]}
        />
        <div className="side-foot">
          <span>{me.name ?? me.email} · Platform owner</span>
          <form method="post" action="/api/auth/logout"><button className="linkbtn" type="submit">Sign out</button></form>
        </div>
      </aside>
      <div className="main">{children}</div>
    </div>
  );
}
