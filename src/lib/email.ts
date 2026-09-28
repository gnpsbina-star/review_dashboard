import "server-only";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

export interface EmailMessage {
  to: string[];
  subject: string;
  /** Plain paragraphs; escaped before being placed in HTML. */
  lines: string[];
  cta?: { label: string; url: string };
  kind: string;
  organizationId?: string | null;
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function render(m: EmailMessage): string {
  const body = m.lines.map((l) => `<p style="margin:0 0 12px;line-height:1.5">${escapeHtml(l)}</p>`).join("");
  const cta = m.cta
    ? `<p style="margin:20px 0"><a href="${escapeHtml(m.cta.url)}" style="background:#0E6B63;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:600">${escapeHtml(m.cta.label)}</a></p>`
    : "";
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#13201D;max-width:560px">${body}${cta}<p style="color:#5B6B67;font-size:12px;margin-top:24px">Smart Review Platform by Synergy Technologies</p></div>`;
}

/** Sends through Resend. Without an API key (local development) the email is printed instead. */
export async function sendEmail(m: EmailMessage): Promise<boolean> {
  const to = [...new Set(m.to.map((t) => t.trim().toLowerCase()).filter(Boolean))];
  if (to.length === 0) return false;
  const e = env();
  let ok = false;
  if (!e.RESEND_API_KEY) {
    console.info(`[email:${m.kind}] to=${to.join(",")} subject="${m.subject}"`);
    ok = true;
  } else {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${e.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: e.EMAIL_FROM,
          to,
          subject: m.subject,
          html: render(m),
          text: [...m.lines, m.cta ? `${m.cta.label}: ${m.cta.url}` : ""].join("\n\n"),
        }),
        signal: AbortSignal.timeout(8000),
      });
      ok = res.ok;
      if (!ok) console.error(`[email:${m.kind}] Resend returned ${res.status}`);
    } catch (err) {
      console.error(`[email:${m.kind}] send failed`, err instanceof Error ? err.message : err);
    }
  }
  await db.emailLog.create({ data: { kind: m.kind, ok, organizationId: m.organizationId ?? null } });
  return ok;
}
