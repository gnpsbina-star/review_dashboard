# Smart Review Platform

A multi-tenant SaaS by **Synergy Technologies** that helps businesses collect more positive Google reviews and fix complaints privately.

- **4–5★ customers** pick an AI-written suggestion (English, Hindi or Hinglish), edit it, and post it on Google with one tap, then optionally share the same review on the business’s Facebook page (customers post it themselves; Facebook and Google don’t allow apps to post reviews for them).
- **1–3★ customers** send feedback privately to the branch manager first, with up to 3 photos if they like. A smaller “Review us on Google” link stays visible to everyone.
- **Clients** manage several businesses and branches, reply on WhatsApp, track resolution, see analytics, print permanent QR codes, and print employee ID cards (standard CR80 size) with each person’s review QR code on the back.
- **You (platform owner)** create client accounts and renew yearly plans. Accounts lock automatically when a plan ends.

Documents: [final specification](docs/SPEC.md) · [approved design preview](docs/design-preview.html) · [original draft](docs/ORIGINAL_SPEC.md)

---

## Tech stack (free tiers first)

| Part | Choice |
|---|---|
| App | Next.js 16 (App Router, TypeScript), React 19, Tailwind 4 plus the design system in `src/app/globals.css` |
| Database | PostgreSQL (Neon free tier) with Prisma 7 |
| Sign-in | Google OAuth (via `arctic`) with database sessions, invite-only |
| Email | Resend |
| AI | Gemini (default), Claude or ChatGPT, switchable; offline templates as fallback |
| Captcha | Cloudflare Turnstile |
| Customer photos | Cloudflare R2 (private; database fallback in development) |
| QR address | Cloudflare Worker (`worker/`) |
| Scheduled jobs | GitHub Actions calling `/api/cron/*` |
| Hosting | Vercel (Hobby while piloting, Pro or Cloudflare once paid) |

## Project layout

```
prisma/schema.prisma      data model (every tenant table has organizationId)
prisma/seed.ts            platform owner + optional demo data
src/proxy.ts              per-request CSP nonce
src/lib/access.ts         who may see what (the tenant isolation core)
src/lib/ai/               suggestion prompts, providers, validation, pool
src/lib/jobs.ts           escalations, reminders, locking, deletion, retention
src/app/r/[code]/         the customer page behind every QR code
src/app/dashboard/        client dashboard (reviews, analytics, QR studio, settings, team)
src/app/platform/         platform owner area (clients, subscriptions, AI provider)
src/app/api/              sign-in, public feedback, QR downloads, logos, cron
worker/                   Cloudflare Worker for permanent QR links
tests/                    unit + integration tests (real Postgres)
```

## Run it locally

Requirements: Node 22+, PostgreSQL 16.

```bash
npm install
cp .env.example .env            # fill DATABASE_URL, keys (see comments in the file)
npx prisma migrate deploy
SEED_DEMO=true npm run db:seed  # demo client with sample reviews
npm run dev                     # http://localhost:3000
```

With `DEV_LOGIN_ENABLED="true"` (never in production) the login page offers a developer sign-in:

| Email | Role |
|---|---|
| `owner@synergy.test` (or your `PLATFORM_OWNER_EMAILS`) | Platform owner |
| `owner@demo.test` | Client Owner of the demo account |
| `meena@demo.test` | Branch Admin (Indiranagar only) |

The seed prints a customer page link such as `/r/GM6QWS`.

### Checks

```bash
npm run lint
npm run typecheck
npm test        # needs a Postgres database named srp_test (user srp / password srp), or set TEST_DATABASE_URL
npm run build
```

The tests include cross-client isolation checks: one client’s owner or admin trying to read or change another client’s reviews, businesses and branches.

## Deploying (step by step)

You create these free accounts yourself. **Put keys only in the hosting settings, never in code or chat.**

1. **Neon** (database): create a project and copy the connection string into `DATABASE_URL`.
2. **Google Cloud Console** (sign-in): create an OAuth client of type “Web application”.
   - Authorised redirect URI: `https://<your-app>/api/auth/google/callback`
   - Copy the client ID and secret into `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
3. **Resend** (email): verify a sending domain, then set `RESEND_API_KEY` and `EMAIL_FROM`.
4. **Cloudflare Turnstile** (captcha): add a site and set `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`.
5. **Google AI Studio** (Gemini): create an API key and set `GEMINI_API_KEY`.
   - **Cloudflare R2** (customer photos): create a private bucket (no public access) and an API token with Object Read & Write for that bucket. Set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` and `R2_BUCKET`.
6. **Secrets**: generate `FIELD_ENCRYPTION_KEY` with `openssl rand -base64 32`, and `HASH_SECRET` and `CRON_SECRET` with `openssl rand -base64 48`. Keep a safe offline copy of `FIELD_ENCRYPTION_KEY`: without it, stored phone numbers can’t be read.
7. **Vercel**: import this GitHub repo, add all variables from `.env.example`, and set `APP_URL`. The build runs `prisma generate`. Run `npx prisma migrate deploy` against the production database once, and after each schema change.
8. **Cloudflare Worker** (permanent QR address): in `worker/wrangler.toml` set `APP_URL` to the app’s address, then run `cd worker && npx wrangler deploy`. Put the worker URL (e.g. `https://go.synergytech.workers.dev`) in `QR_BASE_URL` **before printing any QR codes**.
9. **GitHub Actions** (scheduled jobs): add repository secrets `APP_URL` and `CRON_SECRET`. `.github/workflows/cron.yml` runs hourly (escalations), daily (subscriptions and data retention) and every 6 hours (AI suggestion refresh). GitHub runs schedules from the default branch only.
10. Seed your platform owner: set `PLATFORM_OWNER_EMAILS` to your Google email. The first Google sign-in with that email creates the platform owner.

When you buy your own domain later, point it at Vercel, update `APP_URL` (in Vercel and in `wrangler.toml`), and redeploy the worker. Printed QR codes keep working.

## Security summary

- The server scopes every query to the signed-in client account, and branch admins to their assigned branches (`src/lib/access.ts`). Integration tests cover cross-client attempts.
- Google sign-in only, invite-only whitelist, sessions stored hashed in the database, `__Host-` secure cookies, and immediate revocation.
- Customer phone numbers and emails are encrypted (AES-256-GCM). IPs and device ids are stored only as keyed hashes. Contact details and photos are deleted after 12 months.
- Staff photo Auto-enhance (face-centred crop, lighting and colour fix, plain background) runs entirely in the browser with Google’s on-device MediaPipe models served from our own domain; photos aren’t sent to any AI service. WebAssembly is allowed only on staff pages.
- Customer photos: checked by file bytes, re-encoded (removing GPS and other metadata), stored privately, and shown only to people who can see that complaint.
- Nonce-based Content Security Policy, HSTS, frame blocking and other security headers. No raw HTML rendering.
- Server-side validation of every input with Zod. Logos must be PNG, JPG or WebP (checked from the file bytes) and are re-encoded; SVG uploads are refused.
- Turnstile captcha and database-backed rate limits on public endpoints.
- Audit log of admin actions, including when the platform owner opens a client’s dashboard.
- AI prompts contain business settings only, never customer data, and AI output is filtered before storage.
- Dependabot updates and `npm audit` in CI.

Before the first large client, commission an independent penetration test.
