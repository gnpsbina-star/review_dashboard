import "server-only";
import { z } from "zod";

const isProd = process.env.NODE_ENV === "production";

const schema = z
  .object({
    DATABASE_URL: z.string().min(1),
    APP_URL: z.string().url(),
    // Public base for printed QR codes, e.g. https://go.synergytech.workers.dev
    QR_BASE_URL: z.string().url().optional(),
    // 32 random bytes, base64. Encrypts customer phone numbers and emails.
    FIELD_ENCRYPTION_KEY: z.string().min(40),
    // Secret for hashing IP addresses and device ids.
    HASH_SECRET: z.string().min(32),
    CRON_SECRET: z.string().min(24),
    PLATFORM_OWNER_EMAILS: z.string().default(""),

    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    DEV_LOGIN_ENABLED: z.string().optional(),

    TURNSTILE_SITE_KEY: z.string().optional(),
    TURNSTILE_SECRET_KEY: z.string().optional(),

    // Cloudflare R2 for customer photos. Without these, photos are stored in the database.
    R2_ACCOUNT_ID: z.string().optional(),
    R2_ACCESS_KEY_ID: z.string().optional(),
    R2_SECRET_ACCESS_KEY: z.string().optional(),
    R2_BUCKET: z.string().optional(),

    // Email: Gmail / Google Workspace SMTP (app password) or Resend. SMTP wins when both are set.
    SMTP_HOST: z.string().default("smtp.gmail.com"),
    SMTP_PORT: z.coerce.number().int().positive().default(465),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().default("Smart Review <alerts@example.com>"),

    AI_PROVIDER: z.enum(["GEMINI", "ANTHROPIC", "OPENAI", "MOCK"]).default("GEMINI"),
    GEMINI_API_KEY: z.string().optional(),
    GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
    ANTHROPIC_API_KEY: z.string().optional(),
    ANTHROPIC_MODEL: z.string().default("claude-haiku-4-5"),
    OPENAI_API_KEY: z.string().optional(),
    OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  })
  .superRefine((v, ctx) => {
    if (!isProd) return;
    const required: (keyof typeof v)[] = [
      "GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET",
      "TURNSTILE_SITE_KEY",
      "TURNSTILE_SECRET_KEY",
    ];
    for (const key of required) {
      if (!v[key]) ctx.addIssue({ code: "custom", path: [key], message: `${key} is required in production` });
    }
    if (!v.RESEND_API_KEY && !(v.SMTP_USER && v.SMTP_PASSWORD)) {
      ctx.addIssue({ code: "custom", path: ["SMTP_PASSWORD"], message: "Email needs SMTP_USER and SMTP_PASSWORD (or RESEND_API_KEY) in production" });
    }
    if (!v.APP_URL.startsWith("https://")) {
      ctx.addIssue({ code: "custom", path: ["APP_URL"], message: "APP_URL must use https in production" });
    }
  });

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

/** Validated environment. Read lazily so `next build` works without secrets. */
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment configuration: ${problems}`);
  }
  cached = parsed.data;
  return cached;
}

/** Dev-only email sign-in. Never available in production builds. */
export function devLoginEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.DEV_LOGIN_ENABLED === "true";
}

export function platformOwnerEmails(): string[] {
  return env()
    .PLATFORM_OWNER_EMAILS.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Contact on the privacy policy and terms. Read on its own so those pages prerender without the app's secrets. */
export function supportEmail(): string | undefined {
  const parsed = z.string().trim().email().safeParse(process.env.SUPPORT_EMAIL);
  return parsed.success ? parsed.data : undefined;
}

export function qrUrl(code: string): string {
  const e = env();
  return e.QR_BASE_URL ? `${e.QR_BASE_URL.replace(/\/$/, "")}/${code}` : `${e.APP_URL.replace(/\/$/, "")}/r/${code}`;
}
