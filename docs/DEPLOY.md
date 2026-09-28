# Going Live — Step-by-Step Checklist

Follow the steps in order. Each one says **where to click**, **what to copy**, and **where to paste it**.

> **Never paste keys or passwords into chat, email or code.** Keys go only into the Vercel, Cloudflare and GitHub settings pages named below.

Keep a private note (for example a password manager) with the values marked 🔑 as you collect them.

---

## Step 0 — Put the code on the main branch

The new code lives on the branch `claude/tender-cori-utt1pn`. Vercel publishes the **main** branch, and GitHub only runs scheduled jobs from main.

1. Open the pull request for this branch on GitHub.
2. Review it, then click **Merge**.

## Step 1 — Database (Neon, free)

1. Sign up at **neon.tech** with your Google account.
2. Create a project:
   - Name: `smart-review`.
   - Postgres version 16 or newer.
   - Region: **Asia Pacific (Singapore)**, the closest to India.
3. On the project dashboard, open **Connect**:
   - 🔑 **Pooled** connection string (the host contains `-pooler`) → this is `DATABASE_URL`.
   - 🔑 **Direct** connection string (turn "Connection pooling" off) → this is `DIRECT_URL`.

## Step 2 — Hosting (Vercel, free Hobby plan)

1. Sign up at **vercel.com** with your GitHub account.
2. Choose **Add New → Project**, then import `review_dashboard`.
3. Pick a project name, e.g. `review-dashboard`. Your address becomes **`https://synergy-technologies-review-dashboard.vercel.app`**. This is `APP_URL`.
4. **Don’t deploy yet.** First collect the keys from steps 3 to 7, then add them all at once in step 8.

## Step 3 — Secret keys

You need three random secrets:
- 🔑 `FIELD_ENCRYPTION_KEY` (32 bytes, base64)
- 🔑 `HASH_SECRET`
- 🔑 `CRON_SECRET`

Create them with the key generator page Claude provides; it runs only in your browser. Or, on a computer with a terminal:
```
openssl rand -base64 32   # FIELD_ENCRYPTION_KEY
openssl rand -base64 48   # HASH_SECRET
openssl rand -base64 48   # CRON_SECRET
```
**Keep an offline copy of `FIELD_ENCRYPTION_KEY`.** If it's lost, stored customer phone numbers can't be read.

## Step 4 — “Sign in with Google” (Google Cloud, free)

1. Go to **console.cloud.google.com** and create a project named “Smart Review”.
2. Open **APIs & Services → OAuth consent screen** (also called **Google Auth Platform**) and click **Get started**:
   - App name: "Smart Review Platform". Add your support email.
   - Audience: **External** (Internal would only allow your own domain's accounts).
3. Open **Branding** and fill in (replace the address with your `APP_URL`):
   - Application home page: `https://synergy-technologies-review-dashboard.vercel.app`
   - Privacy policy: `https://synergy-technologies-review-dashboard.vercel.app/privacy`
   - Terms of service: `https://synergy-technologies-review-dashboard.vercel.app/terms`
   - Authorised domains: `synergy-technologies-review-dashboard.vercel.app`
   - Don't upload a logo; a logo makes Google require a manual review.
   - Then open **Audience → Publish app**, so sign-in isn't limited to test users.
4. Open **Clients → Create client** (or **Credentials → Create credentials → OAuth client ID**):
   - Type: Web application.
   - Authorised JavaScript origin: `https://synergy-technologies-review-dashboard.vercel.app` (your `APP_URL`).
   - Authorised redirect URI: `https://synergy-technologies-review-dashboard.vercel.app/api/auth/google/callback`
5. 🔑 Copy the **Client ID** (`GOOGLE_CLIENT_ID`) and the **Client secret** (`GOOGLE_CLIENT_SECRET`).

## Step 5 — Email alerts (your Google Workspace mailbox, free: about 2,000 emails a day)

Alerts are sent from **donotreply@mygnps.com** through Gmail. No DNS changes are needed.

1. **Allow 2-Step Verification** (once, as the Workspace admin): open **admin.google.com → Security → Authentication → 2-Step Verification**, tick **Allow users to turn on 2-Step Verification**, then **Save**.
2. **Turn it on for the mailbox**: sign in to **myaccount.google.com** as `donotreply@mygnps.com`, then open **Security → 2-Step Verification** and follow the steps (a phone number is enough).
3. **Create an app password**: still signed in as `donotreply@mygnps.com`, open **myaccount.google.com/apppasswords**, type the name `Smart Review`, then click **Create**.
   - 🔑 The 16-letter password shown once is `SMTP_PASSWORD`. Spaces don't matter.
   - If the page says the setting isn't available, repeat step 1 and wait 10 minutes.
4. The other values:
   - `SMTP_USER` = `donotreply@mygnps.com`
   - `EMAIL_FROM` = `Smart Review Alerts <donotreply@mygnps.com>` (must be the same mailbox)

The app password only works for this one mailbox. If it ever leaks, delete it at **myaccount.google.com/apppasswords** and create a new one. Never use the mailbox's normal password.

## Step 6 — Captcha, photo storage, QR address (Cloudflare, free)

1. Sign up at **dash.cloudflare.com**.
2. **Turnstile → Add widget**:
   - Hostname: `synergy-technologies-review-dashboard.vercel.app`.
   - Mode: Managed.
   - 🔑 Copy the **Site key** (`TURNSTILE_SITE_KEY`) and the **Secret key** (`TURNSTILE_SECRET_KEY`).
3. **R2 → Create bucket** named `smart-review-photos`, with **no public access**.
   - Then **R2 → Manage API tokens → Create token**: Object Read & Write, limited to that bucket.
   - 🔑 Copy `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`.
   - `R2_BUCKET` = `smart-review-photos`.
   - This step is optional at first: without R2, photos are stored in the database.
4. **Workers & Pages → Create → Worker**:
   - Name it `go`.
   - Choose **Edit code**, paste the contents of `worker/src/index.ts`, then **Deploy**.
   - Under **Settings → Variables**, add `APP_URL` = your app address, then deploy again.
   - Your QR address appears as `https://go.<your-subdomain>.workers.dev`. This is `QR_BASE_URL`.

## Step 7 — AI suggestions (Google AI Studio, free tier)

1. Go to **aistudio.google.com** and choose **Get API key → Create API key**.
2. 🔑 This is `GEMINI_API_KEY`.

## Step 8 — Add everything to Vercel and deploy

In Vercel, open **Project → Settings → Environment Variables** and add each variable for **Production** only:

| Name | Value |
|---|---|
| `DATABASE_URL` | Neon pooled string |
| `DIRECT_URL` | Neon direct string |
| `APP_URL` | `https://synergy-technologies-review-dashboard.vercel.app` |
| `QR_BASE_URL` | `https://go.<subdomain>.workers.dev` |
| `FIELD_ENCRYPTION_KEY`, `HASH_SECRET`, `CRON_SECRET` | from step 3 |
| `PLATFORM_OWNER_EMAILS` | your own Google email |
| `SUPPORT_EMAIL` | the address shown on the privacy policy for data requests |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | from step 4 |
| `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` | from step 5 |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | from step 6 |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | from step 6 (optional) |
| `AI_PROVIDER` | `GEMINI` |
| `GEMINI_API_KEY` | from step 7 |

Leave `DEV_LOGIN_ENABLED` **unset**.

Keep every variable on **Production** only. Preview deployments (one per pull request) build without migrations, and must never get the production database or keys.

Then open **Deployments → Redeploy**. The deploy creates the database tables automatically (`vercel-build` runs the migrations).

## Step 9 — Scheduled jobs (GitHub, free)

In GitHub, open **Repository → Settings → Secrets and variables → Actions → New repository secret** and add:
- `APP_URL`: your app address.
- `CRON_SECRET`: the same value as in Vercel.

Then open **Actions → Scheduled jobs → Run workflow**, choose `daily`, and confirm it shows a green tick.

## Step 10 — First sign-in and first client

1. Open your app address and choose **Continue with Google** with the email you set in `PLATFORM_OWNER_EMAILS`. You land in **Client accounts**.
2. Click **New client** and enter the owner's Google email, then choose a trial or a paid year.
3. That owner signs in, adds a business, a branch and staff, and prints QR codes. **Print only after `QR_BASE_URL` is set.**
4. Scan a QR code with your phone and test both the 5★ flow and the 2★ flow. The complaint alert email should arrive.

## Later, when you buy a domain

1. Add the domain in Vercel.
2. Update `APP_URL` in Vercel, in the Worker's variables, and in the Google OAuth origin and redirect URI.
3. Redeploy.

Printed QR codes keep working because they point at the Worker.
