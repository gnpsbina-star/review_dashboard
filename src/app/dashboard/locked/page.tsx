import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { IconLock } from "@/components/icons";
import { isLocked, requireAccess } from "@/lib/access";
import { shortDate } from "@/lib/format";

export const metadata: Metadata = { title: "Plan ended" };

export default async function LockedPage() {
  const a = await requireAccess({ allowLocked: true });
  if (!isLocked(a)) redirect("/dashboard");
  const suspended = a.org.status === "SUSPENDED";
  return (
    <div className="lockcard">
      <div className="lockic"><IconLock size={26} /></div>
      <h1 style={{ fontSize: 21 }}>{suspended ? "This account is paused" : a.sub.endsAt ? `Your yearly plan ended on ${shortDate(a.sub.endsAt)}` : "Your plan isn’t active yet"}</h1>
      <p className="muted" style={{ maxWidth: "46ch" }}>
        {a.sub.purgeAt && !suspended
          ? `Your reviews, QR codes and settings are kept safe until ${shortDate(a.sub.purgeAt)}. Renew to pick up exactly where you left off.`
          : "Contact Synergy Technologies to continue."}
      </p>
      <p className="muted" style={{ maxWidth: "46ch" }}>Meanwhile, your QR codes show customers a simple “Review us on Google” button.</p>
      {a.role === "CLIENT_OWNER" ? <p><b>To renew, contact Synergy Technologies.</b> Your account will unlock as soon as the renewal is recorded.</p> : <p>Ask your account owner to renew the plan.</p>}
      <form method="post" action="/api/auth/logout"><button className="btn-ghost" type="submit">Sign out</button></form>
    </div>
  );
}
