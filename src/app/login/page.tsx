import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { IconGoogle } from "@/components/icons";
import { Mark } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth/session";
import { devLoginEnabled } from "@/lib/env";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  "not-invited": "This Google account hasn't been invited. Ask your account owner to add your email, then try again.",
  unverified: "Your Google email isn't verified. Verify it with Google, then try again.",
  expired: "The sign-in took too long or was interrupted. Please try again.",
  "google-error": "Google couldn't complete the sign-in. Please try again.",
  "google-not-configured": "Google sign-in isn't set up on this server yet.",
  "too-many-attempts": "Too many sign-in attempts. Wait 15 minutes and try again.",
  "no-access": "Your account isn't linked to any client account yet. Ask your account owner to add you.",
};

export default async function LoginPage(props: PageProps<"/login">) {
  const user = await getCurrentUser();
  const sp = await props.searchParams;
  const error = typeof sp.error === "string" ? ERRORS[sp.error] : undefined;
  if (user && !error) redirect("/dashboard");
  const dev = devLoginEnabled();

  return (
    <main className="center">
      <div className="card">
        <Mark />
        <div>
          <h1 style={{ fontSize: 22 }}>Sign in to your dashboard</h1>
          <p className="muted" style={{ marginTop: 6 }}>Use the Google account your team invited.</p>
        </div>
        {error && <div className="flash error" role="alert">{error}</div>}
        {sp["signed-out"] && !error && <div className="flash">You’re signed out.</div>}
        <a className="gbtn" href="/api/auth/google">
          <IconGoogle /> Continue with Google
        </a>
        {dev && (
          <form method="post" action="/api/auth/dev" className="panel" style={{ background: "var(--warn-soft)", borderColor: "transparent" }}>
            <div className="field">
              <label htmlFor="dev-email">Developer sign-in (local only)</label>
              <input id="dev-email" name="email" type="email" required placeholder="owner@synergy.test" autoComplete="email" />
            </div>
            <button className="btn-ghost" type="submit">Sign in without Google</button>
            <p className="help">Shown only when DEV_LOGIN_ENABLED=true outside production.</p>
          </form>
        )}
        <p className="help">Only invited emails can sign in. We never see your Google password.</p>
        <p className="help legal-links">
          <a href="/privacy">Privacy policy</a>
          <a href="/terms">Terms of service</a>
        </p>
      </div>
    </main>
  );
}
