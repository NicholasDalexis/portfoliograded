# PortfolioGraded

Recruiter-grade portfolio audits. Paste a portfolio URL, pick a target role, get a
letter grade across 9 categories with concrete, prioritized fixes. Free tier is real;
Pro ($12/mo) unlocks the premium categories, per-check drill-downs, the S-tier ceiling,
and unlimited re-audits.

## Stack

- **Frontend:** React 19 + Vite + Tailwind + wouter, served by the same Express server
- **API:** tRPC (type-safe end-to-end)
- **Auth:** Clerk
- **LLM:** Anthropic Claude Opus 4.8 (audit enrichment)
- **Payments:** Stripe (subscription + webhooks)
- **DB:** MySQL via Drizzle ORM
- **Host:** Railway

The audit engine (`server/auditEngine.ts`) crawls the target URL on both a desktop and
mobile user-agent, extracts ~30 signals, scores deterministically, then enriches the
result with Claude. If the LLM call fails it falls back to the deterministic scoring.

## Local development

1. `pnpm install` (or `npm install`)
2. Copy `.env.example` to `.env` and fill in the values.
3. Start MySQL locally (or point `DATABASE_URL` at a hosted dev DB).
4. `pnpm db:migrate:dev` to create the tables.
5. `pnpm dev` → http://localhost:3000

## Environment variables

See `.env.example`. You need accounts/keys from:

- **Clerk** — `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, and `VITE_CLERK_PUBLISHABLE_KEY`
- **Anthropic** — `ANTHROPIC_API_KEY`
- **Stripe** — `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID_PRO`, `STRIPE_WEBHOOK_SECRET`
- **MySQL** — `DATABASE_URL`

## Deploying to Railway

1. Push this repo to GitHub.
2. In Railway: **New Project → Deploy from GitHub repo**.
3. Add a **MySQL** database plugin. Railway injects `DATABASE_URL` automatically.
4. In the service **Variables** tab, add every key from `.env.example`
   (except `DATABASE_URL`, which Railway provides). Set `APP_URL` to your Railway
   domain (or your custom domain), and `NODE_ENV=production`.
5. Railway runs `railway.json`'s build + start commands. The start command runs
   `pnpm db:migrate` (applies migrations) then `pnpm start`.

### Stripe webhook

After the first deploy, create a webhook in the Stripe dashboard pointing to:

```
https://YOUR_DOMAIN/api/stripe/webhook
```

Subscribe to: `checkout.session.completed`, `customer.subscription.created`,
`customer.subscription.updated`, `customer.subscription.deleted`. Paste the signing
secret into `STRIPE_WEBHOOK_SECRET` and redeploy.

### Custom domain (Porkbun → Railway)

In Railway's service **Settings → Networking → Custom Domain**, add
`portfoliograded.com`. Railway gives you a CNAME target; add it in Porkbun's DNS, then
update `APP_URL` to `https://portfoliograded.com`.

## What's gated behind Pro

Pro status is determined **server-side** from the user's Stripe subscription (never
trusted from the client). Free users get 6 categories + top 3 fixes; Pro unlocks
Accessibility, Discoverability, and Conversion Path, the per-check drill-downs, the
S-tier ceiling, and unlimited re-audits.

## Rate limits

`audit.run` is rate-limited in-memory: anonymous 2/hr/IP, signed-in free 5/hr, Pro 60/hr.
For multi-instance scaling, swap `server/_core/rateLimit.ts`'s Map for Redis (Upstash);
the `consume()` contract stays the same.
