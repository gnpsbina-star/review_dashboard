import "server-only";
import { createTransport, type Transporter } from "nodemailer";
import { db } from "@/lib/db";
import { env, type Env } from "@/lib/env";

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

function plainText(m: EmailMessage): string {
  return [...m.lines, m.cta ? `${m.cta.label}: ${m.cta.url}` : ""].join("\n\n");
}

let smtp: { key: string; transport: Transporter } | null = null;

/** One reusable SMTP connection setup per server instance. */
function smtpTransport(e: Env): Transporter {
  const key = `${e.SMTP_HOST}:${e.SMTP_PORT}:${e.SMTP_USER}`;
  if (smtp?.key === key) return smtp.transport;
  const transport = createTransport({
    host: e.SMTP_HOST || "smtp.gmail.com",
    port: e.SMTP_PORT,
    secure: e.SMTP_PORT === 465, // 465 = TLS from the start; 587 upgrades with STARTTLS
    requireTLS: true,
    auth: { user: e.SMTP_USER, pass: e.SMTP_PASSWORD!.replace(/\s+/g, "") }, // Google shows app passwords in groups of four
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 15000,
  });
  smtp = { key, transport };
  return transport;
}

async function deliver(e: Env, m: EmailMessage, to: string[]): Promise<boolean> {
  if (e.SMTP_USER && e.SMTP_PASSWORD) {
    const info = await smtpTransport(e).sendMail({ from: e.EMAIL_FROM, to, subject: m.subject, html: render(m), text: plainText(m) });
    const rejected = info.rejected?.length ?? 0;
    if (rejected) console.error(`[email:${m.kind}] SMTP rejected ${rejected} recipient(s)`);
    return (info.accepted?.length ?? 0) > 0;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${e.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: e.EMAIL_FROM, to, subject: m.subject, html: render(m), text: plainText(m) }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) console.error(`[email:${m.kind}] Resend returned ${res.status}`);
  return res.ok;
}

/**
 * Sends through Gmail / Google Workspace SMTP when SMTP_USER and SMTP_PASSWORD are set, otherwise Resend.
 * With neither (local development) the email is printed instead.
 */
export async function sendEmail(m: EmailMessage): Promise<boolean> {
  const to = [...new Set(m.to.map((t) => t.trim().toLowerCase()).filter(Boolean))];
  if (to.length === 0) return false;
  const e = env();
  let ok = false;
  if (!(e.SMTP_USER && e.SMTP_PASSWORD) && !e.RESEND_API_KEY) {
    console.info(`[email:${m.kind}] to=${to.join(",")} subject="${m.subject}"`);
    ok = true;
  } else {
    try {
      ok = await deliver(e, m, to);
    } catch (err) {
      console.error(`[email:${m.kind}] send failed`, err instanceof Error ? err.message : err);
    }
  }
  await db.emailLog.create({ data: { kind: m.kind, ok, organizationId: m.organizationId ?? null } });
  return ok;
}
