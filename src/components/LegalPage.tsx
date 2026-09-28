import Link from "next/link";
import { Mark } from "@/components/ui";

export const LEGAL_UPDATED = "28 September 2026";

/** Shared frame for the privacy policy and terms. */
export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="legal">
      <Link href="/login" aria-label="Smart Review Platform home" style={{ textDecoration: "none", color: "inherit" }}>
        <Mark />
      </Link>
      <article>
        <h1>{title}</h1>
        <p className="muted">Last updated {LEGAL_UPDATED}</p>
        {children}
      </article>
      <nav className="legal-foot" aria-label="Legal">
        <Link href="/privacy">Privacy policy</Link>
        <Link href="/terms">Terms of service</Link>
        <Link href="/login">Sign in</Link>
      </nav>
    </main>
  );
}

/** Where people send privacy requests: SUPPORT_EMAIL when set, otherwise the business they dealt with. */
export function ContactLine({ email }: { email?: string }) {
  return email ? (
    <>
      email <a href={`mailto:${email}`}>{email}</a>
    </>
  ) : (
    <>contact the business that showed you the QR code, or Synergy Technologies through that business</>
  );
}
