@AGENTS.md

# Smart Review Platform

Multi-tenant SaaS (Synergy Technologies). Spec: `docs/SPEC.md`. Approved UI: `docs/design-preview.html`.

## Rules that keep clients' data apart
- Every dashboard page and server action starts with `requireAccess()` (or `requirePlatformOwner()`).
- Every review query uses `reviewScope(access)`; branch queries use `branchScope(access)` or filter by `organizationId: access.org.id`.
- Look records up with the scope in the `where` clause and call `notFound()` when missing. Never check ownership after loading by id alone.
- Customer phone/email go through `encryptField` / `decryptField`. IPs and device ids only as `keyedHash`.
- Never `dangerouslySetInnerHTML`. Emails escape through `sendEmail`.

## Commands
- `npm run dev` · `npm test` (needs local Postgres `srp_test`) · `npm run lint` · `npm run typecheck`
- `SEED_DEMO=true npm run db:seed` then sign in at /login with `owner@demo.test`, `meena@demo.test` or `owner@synergy.test` (dev login).
