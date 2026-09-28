import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendMail = vi.fn();
const createTransport = vi.fn<(opts: unknown) => { sendMail: typeof sendMail }>(() => ({ sendMail }));
vi.mock("nodemailer", () => ({ createTransport }));

const { resetDb } = await import("../support/db");
const { db } = await import("@/lib/db");

/** env() is cached per module instance, so each case loads email.ts afresh with its own settings. */
async function loadEmail(vars: Record<string, string>) {
  for (const [k, v] of Object.entries(vars)) vi.stubEnv(k, v);
  vi.resetModules();
  return import("@/lib/email");
}

const message = { kind: "test", to: ["Manager@Example.com ", "manager@example.com"], subject: "New complaint", lines: ["<b>2★</b> at Indiranagar"], cta: { label: "Open", url: "https://app.test/dashboard" } };

beforeEach(async () => {
  await resetDb();
  sendMail.mockReset();
  createTransport.mockClear();
});
afterEach(() => vi.unstubAllEnvs());

describe("email via Gmail / Google Workspace SMTP", () => {
  it("sends through SMTP with the app password, escaped HTML and de-duplicated recipients", async () => {
    sendMail.mockResolvedValue({ accepted: ["manager@example.com"], rejected: [] });
    const { sendEmail } = await loadEmail({ SMTP_USER: "donotreply@mygnps.com", SMTP_PASSWORD: "abcd efgh ijkl mnop", EMAIL_FROM: "Smart Review Alerts <donotreply@mygnps.com>" });

    expect(await sendEmail(message)).toBe(true);
    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({ host: "smtp.gmail.com", port: 465, secure: true, requireTLS: true, auth: { user: "donotreply@mygnps.com", pass: "abcdefghijklmnop" } }));
    const mail = sendMail.mock.calls[0][0];
    expect(mail).toMatchObject({ from: "Smart Review Alerts <donotreply@mygnps.com>", to: ["manager@example.com"], subject: "New complaint" });
    expect(mail.html).toContain("&lt;b&gt;2★&lt;/b&gt;");
    expect(mail.html).not.toContain("<b>");
    expect(mail.text).toContain("Open: https://app.test/dashboard");
    expect(await db.emailLog.findFirst({ where: { kind: "test" } })).toMatchObject({ ok: true });
  });

  it("logs a failure without throwing when Gmail refuses the login", async () => {
    sendMail.mockRejectedValue(new Error("Invalid login: 535-5.7.8 Username and Password not accepted"));
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { sendEmail } = await loadEmail({ SMTP_USER: "donotreply@mygnps.com", SMTP_PASSWORD: "wrong" });

    expect(await sendEmail(message)).toBe(false);
    expect(await db.emailLog.findFirst({ where: { kind: "test" } })).toMatchObject({ ok: false });
    expect(errors.mock.calls.flat().join(" ")).not.toContain("wrong");
    errors.mockRestore();
  });

  it("prefers SMTP over Resend when both are configured", async () => {
    sendMail.mockResolvedValue({ accepted: ["manager@example.com"], rejected: [] });
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { sendEmail } = await loadEmail({ SMTP_USER: "donotreply@mygnps.com", SMTP_PASSWORD: "abcdefghijklmnop", RESEND_API_KEY: "re_test" });

    expect(await sendEmail(message)).toBe(true);
    expect(sendMail).toHaveBeenCalledOnce();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("only prints the email when no sender is configured", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const { sendEmail } = await loadEmail({});

    expect(await sendEmail(message)).toBe(true);
    expect(createTransport).not.toHaveBeenCalled();
    info.mockRestore();
  });
});

describe("production email settings", () => {
  const prod = {
    NODE_ENV: "production",
    APP_URL: "https://synergy-reviews.vercel.app",
    GOOGLE_CLIENT_ID: "id",
    GOOGLE_CLIENT_SECRET: "secret",
    TURNSTILE_SITE_KEY: "site",
    TURNSTILE_SECRET_KEY: "turnstile",
  };

  it("accepts Gmail SMTP without a Resend key", async () => {
    const { env } = await loadEmail({ ...prod, SMTP_USER: "donotreply@mygnps.com", SMTP_PASSWORD: "abcdefghijklmnop" }).then(() => import("@/lib/env"));
    expect(env().SMTP_USER).toBe("donotreply@mygnps.com");
  });

  it("refuses to start with no way to send email", async () => {
    const { env } = await loadEmail(prod).then(() => import("@/lib/env"));
    expect(() => env()).toThrow(/SMTP_USER and SMTP_PASSWORD/);
  });
});
