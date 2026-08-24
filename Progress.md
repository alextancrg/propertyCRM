# AssetHub — Implementation Progress

> Tracked task: run the CRM feature checklist (owners, property managers, login,
> updated-by, rename, bills). Last updated: 2026-08-25.

## Follow-up round (2026-08-25) — cancellation display, bill collapse/order, owner search

- **Subscription cancellation**: `SubscriptionClient` now respects `cancelAtPeriodEnd`.
  When a subscription is cancelled in Stripe (portal) the section shows a **"Canceled"**
  pill, tagline "… · Subscription cancelled", and — instead of "Renews {date}" — it shows
  **"Subscription cancelled — current plan available until {periodEnd − 1 day}"**
  (helper `availableUntil(iso)` in `SubscriptionClient`). Verified locally with a test
  subscription (period end 2027-08-24 → "available until 23 Aug 2027"). The `cancelAtPeriodEnd`
  flag already flowed through the webhook → `upsertSubscription` → `getSubscriptionView`.
- **Bills & Utilities**: each property card is now **collapsable/expandable** (click the
  header; chevron; collapsed shows "N bills — click the header to expand") — same pattern as
  Rental Collection. Bills are now ordered **reverse-chronologically** (`orderBy: { createdAt: "desc" }`
  in `bills/page.tsx`, was `type asc`).
- **Owners & Landlords**: added a **"Search owners by name…"** box at the top that filters the
  owner grid by name (client-side `query` state in `OwnersClient`); empty state shows
  "No owners match …" when filtered.
- Verified locally + deployed to `assethubmy.vercel.app` (propai-8xhxo6bny, aliased assethubmy +
  propai-crm-one); tsc green. Test subscription user cleaned up.

## Feature round (2026-08-25) — Tax additions, sewerage prepayment, rental UX, manager sharing

All implemented, browser-verified end-to-end locally + deployed live at
`assethubmy.vercel.app` (build + tsc green).

- **Tax & Audit — manual rental collection adds, bills auto-total expenses, property search.**
  - `AnnualIncome` gained `manualRent Float @default(0)` (both schemas). Gross rental
    collection = auto-collected PAID rent (Rental Collection) **+ manualRent** (e.g.
    rent received before the lease started). `src/lib/tax.ts` now computes
    `gross = grossCollected + manualRent`; the Edit modal in `TaxClient` is relabelled
    "Additional manual rental collection (RM)" and saves `manualRent` (PATCH
    `/api/tax/property` accepts `manualRent`; legacy `grossAmount` full-override kept for old rows).
  - **Expenses auto-total from Bills & Utilities**: every PAID `BillPayment` in the
    year (`paidAt ?? dueDate` year) is now an expense item (`Bill (provider) — cycle`),
    summed into `expenses` (before only the manual `Expense` model counted). Net property
    income auto-calculates. DTO has `grossCollected/manualRent/billExpenses/manualExpenseItems`;
    the card shows "Collected + Manual + Bills" breakdown; PDF export uses the same data.
  - **Property search box** on the Tax page filters the per-owner year's properties by name.
- **Bills & Utilities — sewerage tenant prepayment + owner-managed note.**
  - The owner-managed note (not tenant-managed; typical: Miscellaneous, Sewerage, Management
    Fees, Assessment Tax, Quit Rent, Repairs & Renovations) was already present.
  - New: for a **Sewerage** bill with a fixed amount, the Configure Bill form offers
    "Collect a prepayment from the tenant for the total sewerage over the entire lease
    tenure" — `src/lib/bills.ts` `seweragePrepaySummary()` computes total = fixed amount ×
    cycles covered by the property's ACTIVE lease (`SCHEDULE_MONTHS` per schedule; open-ended
    leases computed to billing year-end with an explanatory note). Stored on the `Bill`
    (`tenantPrepaid/tenantPrepayAmount/tenantPrepayNote`, both schemas; bills POST/PATCH accept
    them) and shown as a "Tenant prepaid RM X — whole lease tenure" badge + note on the card.
    `bills/page.tsx` now passes each property's active lease.
- **Rental Collection — reverse chronology, collapse/expand, pay-earliest info.**
  - `buildRentalCollection` orders leases by `startDate desc` and months by `month desc`
    (newest first). `RentalsClient` shows an info banner ("Any rent payment is always applied
    to the earliest unpaid month first. Months are shown newest first."), and when there are
    **>4 properties only the latest 3 are expanded by default** — clicking a card header
    collapses/expands it (chevron; collapsed shows "N rent months — click the header to expand").
- **Support — text fix**: "Emailed to assethubmy@gmail.com." (removed "— replies go to …").
- **Managers — invite by email + accept + shared property visibility.**
  - New models (both schemas): `ManagerInvitation` (fromUserId, email, status pending/accepted/
    declined, unique token, toUserId, respondedAt) and `ManagerSharing` (userAId/userBId canonical
    pair, @@unique). `User` gained `sentInvitations/receivedInvitations/sharingA/sharingB`.
  - `src/lib/access.ts` `visibleOwnerIds` now unions owners across the **connected component**
    of the sharing graph (transitive, bidirectional) — so accepted sharing partners see each
    other's owners/properties. New `visibleManagerIds(user)` (self + partners; null for admin).
  - API: `POST /api/managers/invite` (by email; emails the invitee best-effort via SMTP),
    `GET /api/managers/invitations` (sent + received), `POST /api/managers/invitations/[id]/respond`
    (accept creates the ManagerSharing link / decline). `GET /api/managers` is now scoped
    (admin = all; PM = self + partners).
  - Managers page: PM sees "Your team" (self + shared partners with a "Shared visibility" badge),
    an invite-by-email form, and an Invitations panel (received: Accept/Decline; sent: pending).
    `ManagersClient.respond` re-fetches `/api/managers` after accept so the partner appears instantly.
- **Schema**: both `schema.prisma` + `schema.postgresql.prisma` kept in sync; `db push` applied
  locally + on Neon (additive). Verified live: admin invites a new PM → PM accepts → both appear
  in each other's team AND the PM sees the admin's property (cross-user shared visibility).
- ⚠️ Pre-existing, non-fatal: a React hydration warning (#418, "text didn't match") fires on
  client navigation on **all** pages (incl. untouched ones like `/properties`) — from the
  AppShell's sessionStorage-cached `/api/auth/me` display; pages still render correctly. Not from
  this round; left as-is.

## Stripe subscriptions — BLOCKER RESOLVED, full checkout + webhook verified (2026-08-24)

- **Site URL is now `https://assethubmy.vercel.app`** (the user's requested
  canonical URL; `assethub.vercel.app` is NOT available — taken on Vercel).
  The `vercel --prod` deploy auto-aliases `propai-crm-one.vercel.app`; after
  every deploy we must ALSO run
  `npx vercel alias set <new-deploy>.vercel.app assethubmy.vercel.app` to keep
  the user-facing URL on the latest code.
- **Root cause of the 500 `"No such price: '<prod_…>'"`**: the `STRIPE_PRICE_*`
  env vars held **Product IDs** (`prod_…`), not yearly **Price IDs**
  (`price_…`). Also, the copied `prod_…` values didn't even match the real
  products in the Stripe account — the correct products were
  `prod_V8Bj2Z5JJcpZm8` (Starter), `prod_V8BkGx8elIInl5` (Growth),
  `prod_V8BlXY5d9A0f1x` (Pro), `prod_V8Bneatgwv0L9P` (Business).
- **Discovered the Price IDs programmatically** (server-side `STRIPE_SECRET_KEY`
  was available to the deployed app; a temporary Administrator-only debug route
  listed `stripe.prices.list`). Correct yearly prices set on Vercel (Production):
  - `STRIPE_PRICE_STARTER`  = `price_1U7vLsR3YZjosIhHzofjBmnG` (MYR 12,900 = RM 129/yr)
  - `STRIPE_PRICE_GROWTH`   = `price_1U7vMzR3YZjosIhH20CJjS8e` (MYR 29,900 = RM 299/yr)
  - `STRIPE_PRICE_PRO`      = `price_1U7vOER3YZjosIhHbbvaRhzM` (MYR 69,900 = RM 699/yr)
  - `STRIPE_PRICE_BUSINESS` = `price_1U7vPsR3YZjosIhHgLEulKkz` (MYR 129,900 = RM 1,299/yr)
- **Webhook was missing entirely** (`stripe.webhookEndpoints.list()` → `[]`), so
  completed checkouts never activated the `Subscription` row. Created the
  endpoint via the Stripe API (temporary Administrator-only setup route):
  - URL `https://assethubmy.vercel.app/api/billing/webhook` (enabled,
    `we_1U7xztR3YZjosIhHLgIMqwHT`), events
    `checkout.session.completed`, `customer.subscription.updated`,
    `customer.subscription.deleted`, `invoice.paid`, api version
    `2026-07-29.dahlia`. Signing secret (shown once at creation) stored as
    Vercel env `STRIPE_WEBHOOK_SECRET`.
- **End-to-end verified in the browser (test mode, card 4242 4242 4242 4242):**
  Upgrade → Stripe Checkout (MYR 299.00/yr Growth, email prefilled) → test
  payment completes → redirect to `/subscription?success=1` → webhook fires →
  `/subscription` now shows **Growth as the CURRENT PLAN** (Free/Starter show
  "Downgrade", Pro/Business show "Upgrade"). Admin is exempt from limits but
  the `Subscription` row (`planId: growth`, status active, stripe customer +
  sub ids, period end) is persisted in Neon.
- **Cleanup**: the two temporary routes (`/api/billing/prices`,
  `/api/billing/webhook-setup`) were removed; final clean build deployed
  (`propai-1h4fz4yjq-alex-tan.vercel.app`, aliased to `assethubmy` +
  `propai-crm-one`); `/api/billing/prices` now 404s. `npm run tsc` green.
- **Keep** the checkout try/catch error surfacing in
  `src/app/api/billing/checkout/route.ts` (it's what made this debuggable).
- Note: `vercel env pull` masks "Sensitive" vars as `[SENSITIVE]`, so Stripe
  keys/price IDs can't be read back via CLI — debug through the deployed app.

## Subscriptions (Stripe) + Support page (2026-08-24)

- **Tiered subscriptions per property manager** — plans in `src/lib/plans.ts`
  matching the recommended pricing: **Free** (1 property, RM 0), **Starter**
  (3, RM 129/yr ≈ RM 10.75/mo), **Growth** (10, RM 299/yr ≈ RM 24.90/mo,
  Flagship), **Pro** (30, RM 699/yr ≈ RM 58.25/mo), **Business** (unlimited,
  RM 1,299+/yr).
- **New `/subscription` page** (nav + server page + `SubscriptionClient`):
  current-plan banner, property-usage progress bar (count vs limit), renews
  date, "Manage billing" (Stripe portal), plan-limit warning, and a plan grid
  with yearly/monthly pricing, features, and Upgrade/Downgrade CTAs.
- **Stripe payment page** — `POST /api/billing/checkout` creates a yearly
  recurring **Stripe Checkout Session** (success/cancel redirect back to
  `/subscription`); `POST /api/billing/portal` opens the **Customer Portal**;
  `POST /api/billing/webhook` keeps the local `Subscription` row in sync
  (`checkout.session.completed`, `customer.subscription.updated/deleted`,
  `invoice.paid`). Stripe Price IDs come from env `STRIPE_PRICE_*`; signing via
  `STRIPE_WEBHOOK_SECRET`.
- **Property limit enforcement** — `POST /api/properties` calls
  `assertCanAddProperty` (limit from the user's plan; Administrators + Business
  are unlimited) and returns **402 `PLAN_LIMIT`** with an upgrade message. The
  Add/Edit Property modal shows an **"Upgrade my plan"** link on that error.
- **Dev-mode simulation** — without `STRIPE_SECRET_KEY`/`STRIPE_PRICE_*`,
  plan changes are applied locally (dev only, never production) so the whole
  flow is testable; the UI shows a dev-mode banner.
- **Support page** — `/support` collects feedback (category / subject / message),
  stores a `Feedback` row, and emails the support inbox (default
  `assethubmy@gmail.com`) via SMTP (**nodemailer**) with **Reply-To set to the
  logged-in user's email**. Users see their submission history; admins see all.
  When SMTP isn't configured the feedback is still recorded (no email).
- Schema (both `schema.prisma` + `schema.postgresql.prisma`): new **`Subscription`**
  and **`Feedback`** models + `User.subscription`/`User.feedback` relations; `db push`
  applied locally, both schemas validate.
- New deps: `stripe`, `nodemailer` (+ `@types/nodemailer`). New env vars in
  `.env.example` + README (`STRIPE_*`, `NEXT_PUBLIC_APP_URL`, `SMTP_*`,
  `SUPPORT_TO_EMAIL`/`SUPPORT_FROM_EMAIL`).
- Verified end-to-end in the browser: dev-mode upgrade (Free→Starter), property
  create blocked at the Free limit (402) then allowed after upgrade (2/3 shown
  on usage bar), support submission appears in history + mail fallback logged.
  Test data cleaned up afterwards; `npm run build` green.

## New URL + bills/properties remarks + loading UX (2026-08-24)

- **New live URL: https://assethubmy.vercel.app** — added as a production alias to the latest prod deployment (`vercel alias set`); old `https://propai-crm-one.vercel.app` alias removed. ⚠️ **Permanent change caveat**: on the next `vercel --prod` deploy Vercel re-creates `propai-crm-one.vercel.app` because it is still the project's configured production domain in the dashboard — to make it stick, open **Vercel → project `propai-crm` → Settings → Domains** and set `assethubmy.vercel.app` as the production/primary domain (and remove the old one). Deployment Protection (Vercel SSO) applies to the new alias just like the old one.
- **Bills & Utilities header**: added a small description clarifying these bills are **not tenant-managed** — they are settled by the property owners/managers — listing typical types: Miscellaneous, Sewerage, Management Fees, Assessment Tax, Quit Rent, Repairs & Renovations.
- **Remarks**: `Property` gained `remarks String?` (both schema files; `prisma db push` applies the column on deploy). Add/Edit Property form has a remarks textarea (max 300, live counter) shown on the property card. Bill remarks limit lowered 500 → 300 (`BILL_MAX_REMARKS`); new `PROPERTY_MAX_REMARKS = 300` in `src/lib/properties.ts`.
- **Loading UX**: new `src/app/loading.tsx` (global Suspense fallback) + `src/components/RouteProgress.tsx` (top progress bar on internal link clicks, wired into AppShell) + spinner icons (`fa-solid fa-spinner fa-spin`) on every async action button (bills, properties, rentals, owners, managers, documents, AI settings, login).
- **Speed**: Prisma client now cached on `globalThis` in production too (warm serverless reuse); AppShell header fetches (`/api/auth/me`, `/api/ai/config`) cached in sessionStorage (5-min TTL) with background revalidation; `preconnect` added for the Font Awesome CDN. `npm run build` verified green; deployed to prod at `assethubmy.vercel.app`.

## Receipt downloads + multi-receipt bills + Own Stay (2026-08-24)

- **Fixed the 404 download bug**: Vercel's serverless filesystem is ephemeral, so the old code stored only a fake `/uploads/<name>` URL on production — downloads 404'd. All uploads now persist the **bytes as base64 in the DB** and are served through a new auth + RBAC-checked route `GET /api/uploads/[kind]/[id]` (`bill-receipt` | `rent-slip` | `document`) with correct Content-Type/Disposition. Fixed on ALL three upload surfaces: bills receipts, rent payment slips, and vault documents.
- **Bills = up to 4 receipts (min 1 when Paid)**: new `BillReceipt` model (paymentId, fileName, mimeType, data(base64), size). Payment modal uploads multiple files (chips, remove), enforces 1–4 (existing + new), lists existing receipts with download + delete. `PATCH /api/bills/payments/[id]` accepts `files[]`; new `DELETE /api/bills/receipts/[id]` (a paid payment must keep ≥1 receipt; `BillPayment.receiptUrl` is kept in sync with live receipts — cleared when the last one is removed on an unpaid payment).
- **Own Stay property type**: `Property.isOwnStay Boolean @default(false)` (both schema files). Add/Edit Property form has an **Own Stay** checkbox with an explanation; card shows an **Own Stay** badge. Own-stay units are **excluded from Rental Collection** (`buildRentalCollection` filters `property.isOwnStay: false`) and **excluded from Tax & Audit** (`buildOwnerStatements` + `buildTaxYears` filter them out — their expenses can't offset rental income), but bills/utilities tracking still works.
- Schema changes on both `schema.prisma` + `schema.postgresql.prisma`: `Property.isOwnStay`, `BillPayment.receipts`, new `BillReceipt`, `RentPayment.receiptData/receiptMime`, `Document.fileData/fileMime`. Deployed + verified live: uploaded 2 test PDFs to a bill → both downloaded with 200/`application/pdf`; reverted the test payment; build green. ⚠️ **Pre-existing broken receipts** (uploaded before this fix, e.g. Sewerage H1 2026 `STMT__3_.pdf`) still 404 — their bytes were never saved; re-upload once via the payment modal to restore them.

## Deployed to Vercel production + Neon database (2026-08-24)

- **Live URL: https://assethubmy.vercel.app** (project `propai-crm`, Vercel team `alex-tan`).
- **Online database = Neon (Lakebase) Postgres** project `misty-meadow-15049146` (us-east-1), already attached to the Vercel project via the Postgres integration (`DATABASE_URL` pooled + `DATABASE_URL_UNPOOLED` direct).
- **Schema pushed to Neon** with `prisma db push --schema prisma/schema.postgresql.prisma` (had to accept dropping legacy `Bill.dueDay` / `Property.targetRent` columns that existed from an older push).
- **Data exported SQLite → Neon** with `prisma/export-to-pg.cjs` (reads local `dev.db` via a dedicated SQLite client at `prisma/generated/sqlite`, writes to Neon via `prisma/generated/pg`; clears tables first, inserts in FK order). Counts verified identical (3 users, 10 owners, 8 owner-managers, 10 properties, 18 ownership links, 3 annual incomes, 9 tenants, 9 leases, 52 rent payments, 7 bills, 7 bill payments, 9 expenses, 5 documents, 64 audit logs, 1 AI config). Admin login verified on Neon.
- **`AUTH_SECRET` added to Vercel** (Production/Preview/Development) so session cookies sign consistently online.
- **`directUrl = env("DATABASE_URL_UNPOOLED")`** added to `prisma/schema.postgresql.prisma` so `prisma db push` uses the direct connection (pooled PgBouncer breaks schema DDL).
- Verified live on the deployed site: admin login works, Dashboard shows live Neon data (7 properties, occupancy 86%, rent roll RM 14,235, collected YTD RM 75,000, audit trail), Properties page loads all units from Neon.
- Note: file uploads (documents/payment slips) store bytes locally only; on Vercel the code keeps the metadata but skips writing the file (`process.env.VERCEL` branch) — needs Vercel Blob/S3 for full file persistence.
- Tooling (export script, generated clients) is gitignored + excluded via `.vercelignore`.

## Documents — lease tenure replaces filing year (2026-08-24)

- **Upload/Edit Document form no longer has a Year field.** It now captures the **Lease from date** and **Lease to date** (the document's lease tenure).
- **Infinite end date via checkbox** — "Lease is infinite — until further notice (no end date)" disables the to-date and stores `leaseTo = null`. New docs default to unchecked (PM explicitly ticks it when the end date is unknown).
- **Reminder note for the PM** — the form tells them: if the end date isn't determined yet, tick "Lease is infinite" and file it; once the end date is confirmed, use **Edit** on the document to update it. The Edit modal shows the same reminder.
- **Year search is tenure-based** — a document appears in a search year when its lease tenure overlaps that year (`leaseFrom.year ≤ year ≤ leaseTo.year`). **Open-ended (infinite) documents always appear in every year search.**
- Docs are grouped by lease start year; each row shows the tenure line (e.g. `Lease: 01 Jan 2025 – Open (until further notice)` or `… – 31 Dec 2025`).
- New **Edit** button on every document row + `PATCH /api/documents/[id]` (RBAC-checked) so the PM can set the end date later (and update details / replace file).
- Schema: `Document` gained `leaseFrom DateTime?`, `leaseTo DateTime?` (both schema files, `db push` applied). Legacy docs (no lease dates) keep filtering by their stored `year`.
- Verified live: open-ended doc appeared in both 2026 and 2025 searches; after editing its end date to 31 Dec 2025 it correctly disappeared from 2026 and stayed in 2025. Build green.

## Document upload tenant dropdown scoped by RBAC (2026-08-24)

- **Tenant dropdown under Upload Document is now RBAC-scoped** (`src/app/documents/page.tsx`): Property Managers only see tenants leased on properties owned by the owners assigned to them (created/assigned via `OwnerManager`); Administrators still see all tenants.
- Implemented with the same scoping as properties: `visiblePropertyIds(me)` → `prisma.tenant.findMany({ where: { leases: { some: { propertyId: { in: propIds } } } } })`.
- Verified live with a temporary PM (assigned to owner Dato' Fazil): tenant dropdown showed **only "Sarah Ahmad"** (Apt 4B tenant) while other tenants (Kevin, Rajesh Kumar, 7 Eleven, etc.) stayed hidden; properties dropdown showed only Dato' Fazil's 2 units. Admin still sees all tenants. Test PM removed afterwards.

## Open-ended lease checkbox (2026-08-24)

- **Properties & Leases**: the lease can run from a start date to an **undefined end date ("until further notice")** via a new **"Open-ended lease — until further notice (no end date)"** checkbox beside the Lease end date field.
- Checking it disables the end-date input and saves the lease with `endDate = null` (property card shows the tenancy period as `… – Open`). Unchecking re-enables the date picker.
- New properties default to **checked** (open-ended); existing leases auto-check when they have no end date.
- `PATCH /api/properties/[id]` now clears `endDate` when `openEnded` is true (previously it silently kept the old date). Create already mapped empty `endDate` → `null`.
- Verified live: 7-Eleven (end date 2026-10-07) opens with checkbox **unchecked** + date filled; checking disables the field; Add New Unit opens with checkbox **checked** + field disabled. Build green.

## Gross rental collection → Tax & Audit (2026-08-24)

- **Tax & Audit now reflects the Rental Collection** — each property's "Gross rental collection" per year is auto-derived from **paid** (`PAID`) rent payments for that year in the Rental Collection (`src/lib/tax.ts`).
- `buildTaxYears()` includes years that have any paid rent; `buildOwnerStatements()` sums `rentPayments` where `status === PAID` and `month` starts with `<year>-`, per property.
- **Manual override still wins** — if a correction was saved via the Edit button (`AnnualIncome.grossAmount`), that value takes precedence over the auto-derived figure (`gross = income?.grossAmount ?? grossCollected`).
- Verified live: Chuen Rhung Tan (2026) shows Cheras Business Center RM 3,600 + 7-Eleven RM 32,795 + Danau Permai RM 14,400 + Dynasty Garden A1009 RM 1,850 = RM 52,645, exactly matching the PAID-rent sum in the Rental Collection; shares + net total (RM 9,629.50) all correct.
- Empty-state copy updated: collected rent auto-records gross; Edit still available for manual amounts. Build green, PDF export uses the same `buildOwnerStatements`.

## Rental Collection — due date & grace period (2026-08-24)

- **Due date follows the lease start date** — rent for each month is due on the same day-of-month the lease started (e.g. a lease starting on the 8th makes rent due on the 8th of every month). Day is clamped for short months (e.g. 31 → Feb 28). (`dueDateForMonth` in `src/lib/rentals.ts`)
- **7-day grace period** — an unpaid month does **not** turn red until the due date + 7 days has passed. Within grace it shows a neutral "Due · in grace"; after grace it shows a red "Overdue" pill, and the card header + metrics reflect Overdue vs Due/in-grace vs Collected.

## Additions (2026-08-24)

- **Rent ↔ Monthly rent sync** — in the Add/Edit Property form, the "Rent (RM)" and "Monthly rent (RM)" fields now share one amount; entering either auto-populates the other.
- **New "Rental Collection" section** (`/rentals`, nav + page + client + API):
  - Records monthly rent for each property based on the lease's start date through the current month (auto-generates an `UNPAID` `RentPayment` per lease-month on view, idempotent via `@@unique([leaseId, month])`).
  - Per-property cards list every month with amount + status; "Collect" opens a modal.
  - Marking a month **Paid requires a payment slip** (PDF/image upload). Without a slip, the Property Manager must tick an **override confirmation** — the payment is then recorded as collected and flagged "No slip" (override PM + timestamp + audit log recorded).
  - RBAC-scoped: PMs only see rental records for their visible properties.
- Schema: `RentPayment` gained `receiptUrl`, `remarks`, `overrideById`, `overrideAt` + `@@unique([leaseId, month])`; `User.rentOverrides`. Applied to both schema files and `db push`.

## Additions (2026-08-23)

- **New property types** — `src/lib/properties.ts` now exports `PROPERTY_TYPES` = Apartment, Condominium, Villa, **Shophouse, Office, Bungalow, Semi Detached, Shop Lot, Car Park Lot**. Used by the Add/Edit Property form and the type filters on Properties & Leases and Bills & Utilities.
- **Owner dropdown scoped to manager** — when adding a property, the owner dropdown is populated only with owners the logged-in manager is tied to (created or assigned via `OwnerManager`); Administrators see all registered owners. Verified: an unassigned PM sees no owners; after assignment to one owner, only that owner appears.

## UX fixes (2026-08-23)

- **Modals render above the page header (portals)** — even with correct viewport sizing, the sticky section header (`sticky top-0 z-20` in AppShell) painted on top of the modal title because the modal's stacking context was trapped below the header. All modal overlays are now rendered via **React portals to `document.body`**, so they always sit above the header. Verified: Configure Bill, Add/Edit Property, payment, assign-managers, delete-confirm and document-upload modals all show their full title + form top-to-bottom.
- **Modal forms no longer clipped** — the root cause was the page content wrapper's `animate-fade-in` animation (`.animate-fade-in { animation: fadeSlideIn 0.35s ease-out both }`), whose `both` fill-mode left a persistent `transform` on the wrapper. A transformed ancestor becomes the containing block for `position: fixed`, so every modal overlay was sized to the full page content instead of the viewport — the top was cut off when centered, and the bottom was unreachable when top-aligned. Fix: the animation now fades opacity only (no lingering `transform`), so `fixed inset-0` overlays are correctly viewport-sized and scroll to reveal both the top and bottom.
- **Auto-refresh after mutations** — registering/editing an owner or manager now updates the list immediately (local state synced + `router.refresh()`); bills, properties and documents already refreshed via props. Verified live: new owner/manager appears without a manual reload; owner delete removes it in place.

## Feature round 2 — sold properties, one-off bills, delete, RBAC (2026-08-23)

All implemented, built green, and smoke-tested in the browser:

| # | Requirement | Status |
|---|-------------|--------|
| 1 | **One Off bill schedule** (one-time, e.g. renovation/maintenance) | ✅ `BILL_SCHEDULES` + `generateBillCycles` + UI (1 due date, `One-Off` cycle) |
| 2 | **New bill types**: Repairs & Renovation, Fire Insurance, Miscellaneous | ✅ `BILL_TYPES` + icons in Bills |
| 3 | **Sold properties keep no recurring bills** | ✅ Status `SOLD`; `POST /api/bills` rejects non-`One Off` on sold props (400); UI disables them |
| 4 | **Sold → bill-switch follow-up** | ✅ Auto-creates a **One Off** `Miscellaneous / Bill Transfer` bill when a property is marked SOLD (once per sale) |
| 5 | **Property Delete** (soft) | ✅ `DELETE /api/properties/[id]` sets `deletedAt`; retype-name confirm modal; documents/bills kept |
| 6 | **Property SOLD + soldDate** | ✅ `Property.soldDate` recorded; Status field in the edit form |
| 7 | **Owner Delete** (soft) | ✅ `DELETE /api/owners/[id]`; retype-name confirm; history kept |
| 8 | **Owner ↔ manager ties + assignment** | ✅ `Owner.createdById` (creator) + `OwnerManager` join model; "Assign managers" UI on each owner; creator/admin can edit/delete |
| 9 | **Administrator sees all** | ✅ Admin role = unrestricted visibility; `admin@assethub.my` promoted to Administrator |
| 10 | **PM sees only owners they created / are assigned to** (and their properties) | ✅ `lib/access.ts` scoping on Dashboard, Properties, Owners, Bills, Documents, Tax (+ tax export/corrections, document upload, bill create) |

Verified live: RBAC tester saw **0** owners/properties → after assignment saw exactly **2** properties (its owners'), while other units stayed hidden.

## Todo status

- [x] **Audit codebase against checklist**
- [x] **Rename `PropAI CRM` → `AssetHub`**
- [x] **Add Owners section** (API + page + nav)
- [x] **Add auth: login/register managers (email + password)**
- [x] **Add Property Managers section** (API + page + nav)
- [x] **Wire "updatedBy" into audit logs + display**
- [x] **Protect routes & mutations with auth**
- [x] **Test bills flow + build & run app** (build green, smoke-tested end-to-end)

## Checklist vs current state

| # | Requirement | Status |
|---|-------------|--------|
| 1 | New section(s): Owners + Property Managers | ✅ Added `/owners` and `/managers` (nav + pages) |
| 2 | Owner registration & updates | ✅ `/api/owners` (GET/POST), `/api/owners/[id]` (PATCH), `OwnersClient` |
| 3 | Property manager profile updates | ✅ `/api/managers/[id]` (PATCH), edit UI in Managers section |
| 4 | Property manager registration + login (email+password) | ✅ bcrypt + signed session cookie, `/login`, `/api/auth/login\|logout\|me` |
| 5 | "Updated by" logged-in PM on each update | ✅ `logAudit(..., userId)` wired into all mutations; shown on Dashboard + Tax audit trail |
| 6 | Rename PropAI CRM → AssetHub | ✅ UI strings, PDF export, package name; schema comments already AssetHub |
| 7 | Bills: half-yearly, calendar due dates, per-schedule counts, remarks ≤500, edit, payment upload, receipt mandatory on Paid | ✅ Implemented + verified at runtime (half-yearly H1/H2, receipt-mandatory enforced, remarks >500 rejected) |

## What changed / added


**Rename**
- `src/app/layout.tsx`, `src/components/AppShell.tsx`, `src/components/ai/AiSettings.tsx`, `src/app/api/tax/export/route.ts`, `package.json` (name → `assethub`)

**Auth (`src/lib/auth.ts`)**
- bcrypt password hash/verify; HMAC-signed session cookie (`assethub_session`, 7-day TTL)
- `getSessionUser()` / `requireUser()` guards; secret via `AUTH_SECRET` (dev fallback)

**Routes**
- `src/app/api/auth/login|logout|me/route.ts`
- `src/app/api/managers/route.ts` + `[id]/route.ts`
- `src/app/api/owners/route.ts` + `[id]/route.ts`

**Pages / components**
- `src/app/login/page.tsx` + `src/components/auth/LoginForm.tsx`
- `src/app/managers/page.tsx` + `src/components/managers/ManagersClient.tsx`
- `src/app/owners/page.tsx` + `src/components/owners/OwnersClient.tsx`
- `AppShell` — added Owners + Managers nav, dynamic signed-in user, sign-out button

**Audit ("updated by")**
- `src/lib/ai.ts` — `logAudit(entityType, action, description, entityId?, userId?)` now persists `userId`
- Dashboard + Tax pages include `user` on audit logs and render "· by {name}"
- All mutation routes (properties, bills, payments, documents, tax, owners, managers) require login and record `me.id`

**Schema / DB**
- `User.updatedAt` given `@default(now())` in **both** `prisma/schema.prisma` and `prisma/schema.postgresql.prisma` (kept in sync) so `db push` is non-destructive
- `npx prisma db push` applied (existing dev data preserved: 3 properties, 3 owners, 7 bills, 2 leases)
- `prisma/ensure-admin.ts` (+ `npm run db:admin`) — upserts admin login; `prisma/seed.ts` now seeds a password-hashed manager

## Login (default)

```
Email:    admin@assethub.my
Password: Assethub@2026
```
Set via `npm run db:admin` (or env `ADMIN_PASSWORD`). Change it after first login in the Managers section.

## Remaining — ALL DONE (2026-08-23)

- [x] Re-run `npm run build` — **green** (both pre-existing date-serialization fixes confirmed; final build passes lint + type check)
- [x] Run `npm run dev` and smoke-test — **all flows verified in the browser**:
  - Login (admin + newly registered manager) → redirect to `/dashboard`
  - Owners: registered a test owner (created via `/api/owners`)
  - Managers: registered + updated profile (PATCH `/api/managers/[id]`)
  - Bills: created a **Half-Yearly** bill (2 calendar due dates H1/H2: 30 Jun & 31 Dec), per-schedule count `0/2 → 1/2`, remarks ≤500 (UI counter + server 400), payment upload, **receipt mandatory on Paid** (blocked without file, persisted with file)
  - Audit trail: Dashboard + Tax render `· by {name}` (verified `· by Test Manager`)
- [x] Set `AUTH_SECRET` — generated a 64-char random secret in `.env.local`; added `AUTH_SECRET` placeholder to `.env.example` for deployments

## Bug fixed during verification

- **`src/app/dashboard/page.tsx`** — the `· by {log.user.name}` span (and `{log.description}`) had been pasted *inside* the icon `div`'s `className` template literal, so the attribution silently never rendered. Moved the user span into the description line; dashboard now shows `… · by {name}`. (`TaxClient.tsx` already rendered it correctly.)

## Test data cleaned up

Smoke-test artifacts were removed from the dev DB (owners back to 3, single admin user, 7 original bills, 3 unpaid / 4 paid) and test receipts removed from `public/uploads/`.
