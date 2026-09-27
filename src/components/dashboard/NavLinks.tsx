"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavIcons } from "@/components/icons";

export type NavItem = { href: string; label: string; icon: keyof typeof NavIcons; count?: number };

export function NavLinks({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav className="nav" aria-label="Dashboard">
      {items.map((it) => {
        const active = it.href === "/dashboard" ? path === "/dashboard" : path.startsWith(it.href);
        const Icon = NavIcons[it.icon];
        return (
          <Link key={it.href} href={it.href} aria-current={active ? "page" : undefined}>
            <Icon size={18} />
            <span>{it.label}</span>
            {it.count ? <span className="count num">{it.count}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
