# PropAI CRM

An AI-powered **property management CRM** that empowers the Property Manager across
maintenance, tenant relations, document filing, tax-audit readiness, and financial
management — with a **configurable WhatsApp AI agent** that can be toggled on or off.

Built as a spec-driven Next.js app (reference methodology:
[github/spec-kit](https://github.com/github/spec-kit.git)). See [`spec.md`](spec.md).

## Modules

| Module | What it does |
|--------|--------------|
| **Dashboard** | KPIs, portfolio P&L snapshot, rent-arrears list, recent AI activity feed. |
| **Properties & Leases** | Searchable property database with ownership (single / joint-venture %), tenants, rent, lease status & LHDN stamping. **Own Stay** units track bills only — no rent collection, excluded from Tax & Audit. |
| **Bills & Utilities** | Recurring bill schedules (TNB, Air Selangor, Indah Water, JMB, quit rent, assessment), mark-paid with receipt evidence. |
| **Tax & Audit** | Per-owner LHDN income statements (net taxable = gross − verified expenses), ownership-split distribution, chronological audit trail. Own-stay expenses are excluded. |
| **Documents** | Secure filing vault — leases, receipts, insurance, warranties, titles; stamping status; upload. |
| **Subscription** | Tiered plans (Free → Business) with per-manager property limits, priced in RM and charged yearly via **Stripe Checkout**. |
| **Support** | Feedback form that emails `assethubmy@gmail.com`; replies go to the logged-in user's email. |
| **WhatsApp AI Agent** | **Enable/disable toggle**, provider + prompt config, automation behaviours, live test chat, Meta webhook stub. |

## Tech stack

- **Next.js 15** (App Router) + **TypeScript** + **Tailwind CSS**
- **Prisma ORM** — SQLite locally, Postgres in production (Vercel)
- Hosted on **Vercel**

## Local development

```bash
npm install

# 1. Configure environment
copy .env.example .env        # Windows: copy .env.example .env

# 2. Create & seed the database (SQLite — works out of the box)
npx prisma db push
npx prisma db seed

# 3. Run the app
npm run dev
```

Open http://localhost:3000. The seed ships 3 properties, 2 owners, 2 tenants,
utility bills, 2023 tax data, and a pre-configured AI agent.

## WhatsApp AI agent (configurable)

The agent lives at **/ai** and is controlled by a single persisted toggle:

- **Enabled** — the agent answers tenant messages on WhatsApp (or the test chat)
  using the configured system prompt, greeting, and automation behaviours.
- **Disabled** — inbound messages are recorded but not answered; the chat shows
  the offline state and the header badge turns grey.

### Providers

| Provider | Behaviour |
|----------|-----------|
| `Built-in assistant` (default) | Deterministic, rule-based replies for rent reminders, maintenance triage, and viewing scheduling. No API key required. |
| `OpenAI (API key)` | Uses an OpenAI-compatible Chat Completions API. Set `OPENAI_API_KEY` (and optionally `OPENAI_BASE_URL`, `OPENAI_MODEL`). Falls back to the built-in assistant on failure. |

### WhatsApp (Meta Cloud API)

Point your Meta app webhook to:

```
https://<your-domain>/api/whatsapp/webhook
```

and set:

- `WHATSAPP_VERIFY_TOKEN` — used in the verification handshake
- `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` — for sending replies

The webhook currently receives + classifies inbound messages and generates the
AI reply. To send real replies to WhatsApp, call the Meta Graph API in
`src/app/api/whatsapp/webhook/route.ts` (marked with a `NOTE`).

## Deploy to Vercel

1. Push this repository to GitHub and import it in Vercel (framework preset: **Next.js**).

2. Create a Postgres database (Vercel Postgres or Neon) and copy its connection string.

3. Switch Prisma to Postgres — either:
   - edit `prisma/schema.prisma` and change `provider = "sqlite"` → `provider = "postgresql"`, **or**
   - run with the provided Postgres schema: `npx prisma generate --schema prisma/schema.postgresql.prisma` (and point Prisma CLI calls at it with `--schema`).

4. In Vercel → **Project Settings → Environment Variables**, add:

   ```text
   DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/propai?sslmode=require
   OPENAI_API_KEY=              (optional)
   OPENAI_BASE_URL=             (optional, OpenAI-compatible endpoint)
   OPENAI_MODEL=gpt-4o-mini     (optional)
   WHATSAPP_VERIFY_TOKEN=       (optional)
   WHATSAPP_ACCESS_TOKEN=       (optional)
   WHATSAPP_PHONE_NUMBER_ID=    (optional)
   ```

5. Run the migration + seed against the production database (once):

   ```bash
   npx prisma db push
   npx prisma db seed
   ```

   (Use `--schema prisma/schema.postgresql.prisma` if you chose the alternate file.)

6. Deploy. `prisma generate` runs automatically during the Vercel build via `postinstall`.

> **Note:** SQLite is for local development only. On Vercel (serverless) you must
> use Postgres — there is no persistent filesystem.

## File storage

Document uploads save locally to `public/uploads` in development. For production,
wire the upload handler (`src/app/api/documents/route.ts`) to **Vercel Blob** or S3 —
the document record + audit trail already stores the resulting URL.

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | ✅ | Prisma connection string (`file:./dev.db` locally, Postgres URL in prod). |
| `AI_API_KEY` | ⬜ | The API key you provide for the WhatsApp AI agent (DeepSeek-compatible). |
| `AI_BASE_URL` / `AI_MODEL` | ⬜ | Custom OpenAI-compatible endpoint / model (defaults: `https://api.deepseek.com/v1` / `deepseek-v4-flash`). |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | ⬜ | Twilio credentials required for real WhatsApp message delivery. |
| `TWILIO_WHATSAPP_FROM` | ⬜ | Your Twilio WhatsApp sender number (e.g. `whatsapp:+14155238886`). |
| `WHATSAPP_VERIFY_TOKEN` | ⬜ | Legacy Meta webhook verification token (kept for backward compatibility). |
| `STRIPE_SECRET_KEY` | ⬜ | Enables live Stripe Checkout + Billing Portal on `/subscription`. |
| `STRIPE_WEBHOOK_SECRET` | ⬜ | Signing secret for the `/api/billing/webhook` endpoint. |
| `STRIPE_PRICE_STARTER` / `STRIPE_PRICE_GROWTH` / `STRIPE_PRICE_PRO` / `STRIPE_PRICE_BUSINESS` | ⬜ | Yearly-recurring Stripe Price IDs for each paid plan. |
| `NEXT_PUBLIC_APP_URL` | ⬜ | Public origin for Stripe success/cancel URLs (set on Vercel). |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` | ⬜ | SMTP server used by the Support page to email feedback. |
| `SUPPORT_TO_EMAIL` / `SUPPORT_FROM_EMAIL` | ⬜ | Support inbox (default `goassethub@gmail.com`) and from-address. |

> **WhatsApp via Twilio:** outbound messages (rent reminders, escalations, AI chat
> replies) are sent through the Twilio Messages API. Without Twilio credentials the
> agent still records every attempt in the Dashboard feed but no message is
> delivered. Point your Twilio WhatsApp sender's **"When a message comes in"**
> webhook to `POST /api/whatsapp/webhook` for inbound conversations.

> **Subscriptions without Stripe keys:** in development (non-production) the
> Subscription page simulates plan changes locally so the flow can be tested
> without a Stripe account. Add `STRIPE_SECRET_KEY` + `STRIPE_PRICE_*` for real
> payments, and point a Stripe webhook at `POST /api/billing/webhook`.

## Scripts

```bash
npm run dev        # start dev server
npm run build      # production build
npm run start      # serve production build
npm run db:push    # sync Prisma schema to database
npm run db:seed    # seed demo data
npm run db:studio  # open Prisma Studio
```
