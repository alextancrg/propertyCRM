# AssetHub — Infrastructure Cost & Usage Estimate

> Scope: **Neon (Lakebase) Postgres** (the database behind the Prisma ORM) + **Vercel** hosting.
> Pricing verified: **2026-08-24** from https://neon.com/pricing and https://vercel.com/pricing.
> This is an *estimate* for planning — actual billing depends on real usage.

## Quick summary

| Scale | Vercel | Neon | **Total / month** |
|---|---|---|---|
| **10 users** | Hobby — $0 | Free — $0 | **~$0** |
| **100 users** | Pro — $20 | Launch — ~$12–20 | **~$32–40** |

Notes:
- Vercel Pro is effectively **$20/mo** — the included $20 usage credit absorbs all our compute/bandwidth at 100 users (usage ≈ $2–3 of CPU + <1 GB transfer).
- Neon is pay-as-you-go on Launch; at 100 users it's mostly **CU-hours (compute awake time)**, not storage.
- Per-user revenue (RM 129–1,299/yr ≈ US$27–280/yr per paying user) far exceeds per-user infra cost (≈ $0.35–0.40/user/mo at 100 users).

---

## Assumptions (blended portfolio across subscription tiers)

- **10 users** (early: mostly Free/Starter) → ~3.5 properties each → **~35 properties**.
- **100 users** (mix Free→Business) → ~9 properties each → **~900 properties**.
- Structured rows are tiny (~0.1–0.2 MB/property/yr: rent payments, bills, expenses, audit logs).
- **The big DB driver is file uploads stored as base64 in Postgres** (~10–20 MB/user/yr when managers upload regularly).
- ~3 serverless invocations per page view (page + `/api/auth/me` + `/api/ai/config`), ~120–200 ms CPU each.

Grounded in current data: the seeded DB (10 properties, 3 users) is **~0.22 MB**, confirming structured data is compact.

## Database — Neon (Lakebase Postgres)

| Metric (per month) | 10 users | 100 users |
|---|---|---|
| Storage | ~40–150 MB | ~0.5–1.5 GB |
| Compute (CU-hours) * | ~40–60 | ~100–200 |
| Egress (DB → Vercel) | ~1–2 GB | ~10–25 GB |
| **Recommended plan** | **Free — $0** | **Launch** (pay-as-you-go) |
| **Est. DB cost** | **$0** (or ~$5 if 7-day history/backups wanted) | **~$12–20/mo** |

\* CU-hours = compute size × awake hours, with **scale-to-zero** (idle compute = $0).

- **Free tier**: 0.5 GB storage, 100 CU-hours/project, 5 GB egress — comfortable at 10 users.
- **100 users**: compute stays awake most of the workday (100 users × ~2 hr/day spread over ~10 hrs) → likely crosses the Free 100 CU-hour cap **and** the 5 GB egress cap → move to **Launch**.
- **Launch** at 100 users: storage ~1.5 GB × $0.35/GB ≈ **$0.50/mo** + compute 100–200 CU-hr × $0.106 ≈ **$11–20/mo**.
- Only go to **Scale (~$22–45/mo)** if you need 30-day point-in-time history, IP allow-lists, HIPAA, or an uptime SLA.

## Hosting — Vercel

| Metric (per month) | 10 users | 100 users |
|---|---|---|
| Function invocations | ~35k | ~350–450k |
| Active CPU-hours | ~1.5 | ~15–20 |
| Fast data transfer | ~3 GB | ~30 GB |
| Edge requests | ~40k | ~450k |
| **Recommended plan** | **Hobby — $0** | **Pro — $20/mo** |
| **Est. Vercel cost** | **$0** | **$20/mo** |

- Hobby limits: 1M invocations, **4 Fluid CPU-hours**, 100 GB transfer, 1M edge requests.
- The binding constraint at 100 users is **Fluid CPU-hours** (this app's dynamic pages run several Prisma queries each → ~15–20 CPU-hr/mo at 100 users). Hobby only includes 4 → upgrade to Pro.
- At 100 users on Pro: ~400k invocations, ~16 CPU-hr (≈ $2–3 at $0.128/hr), ~30 GB transfer — **all inside the included $20 credit**.

## What will actually move the needle

1. **Files in Postgres** — uploads (bill receipts, rent slips, documents) are stored as base64 inside Neon. This is the #1 storage-growth risk (could push the 100-user DB from ~0.5 GB to several GB if managers upload large PDFs). **Move files to Vercel Blob / S3 (or Neon Object Storage, public beta) before scaling** — keeps the DB small and fast.
2. **Separate costs NOT counted here**:
   - **Stripe** — ~2.9% + RM 2.00 per successful card charge (not infra).
   - **WhatsApp AI agent** — OpenAI/LLM API usage (your own API key), billed separately.
3. **Keep Neon cheap**: leave **scale-to-zero** on and **cap autoscaling** (e.g. max 0.5 CU) — this workload runs fine on 0.25–0.5 CU.

## Pricing sources (verified 2026-08-24)

- Neon plans: https://neon.com/pricing — Free (0.5 GB, 100 CU-hr, 5 GB egress) / Launch ($0.106/CU-hr, $0.35/GB-mo, 500 GB egress incl.) / Scale ($0.222/CU-hr).
- Vercel plans: https://vercel.com/pricing — Hobby (1M invocations, 4 CPU-hr, 100 GB transfer) / Pro $20/mo (+$20 usage credit, $0.128 CPU-hr, $0.60/1M invocations, 1 TB transfer).

---

# Break-even & ideal user count (2026-08-24)

> Model based on AssetHub's actual subscription pricing and the infra estimate above.
> All assumptions stated below — tweak the numbers to re-run the model.

## Assumptions

- FX: **RM 4.3 ≈ US$1**.
- Blended plan mix of **paying** users: 40% Starter / 35% Growth / 20% Pro / 5% Business.
- **Stripe fee** (MYR cards): 2.9% + RM 2.00 per annual charge.
- **Free→paid conversion**: ~25% (B2B CRM range 15–30%).
- Infra: ~RM 5/mo small-scale (Hobby+Free) → ~RM 150–175/mo at ~100 users (Pro+Launch). AI-agent LLM usage excluded.

## Net revenue per paying user (after Stripe)

| Plan | Price/yr | Stripe fee | Net/yr | Net/month |
|---|---|---|---|---|
| Starter | RM 129 | RM 5.74 | RM 123.26 | RM 10.27 |
| Growth | RM 299 | RM 10.67 | RM 288.33 | RM 24.03 |
| Pro | RM 699 | RM 22.27 | RM 676.73 | RM 56.39 |
| Business | RM 1,299 | RM 39.67 | RM 1,259.33 | RM 104.94 |

**Blended net ≈ RM 29/month per paying user.**

## Operating break-even (recurring costs covered)

$$\text{paying users needed} = \frac{\text{monthly infra}}{\text{RM 29/user}}$$

- Small scale (infra ≈ RM 5/mo): **~1 paying user**
- ~100-user scale (infra ≈ RM 160/mo): **~6 paying users**

→ **Roughly 5–10 paying users covers all recurring infra + Stripe fees**; everything after is profit.

## Investment payback

$$\text{paying users} = \frac{\text{dev cost}}{\text{RM 29} \times \text{months}}$$

| Dev cost | 30 paying users | 50 paying users | 100 paying users |
|---|---|---|---|
| RM 5,000 | ~6 months | ~3.5 months | ~2 months |
| RM 10,000 | ~12 months | ~7 months | ~3.5 months |
| RM 20,000 | ~23 months | ~14 months | ~7 months |

(Dev cost RM 0 — self-built in free time → profitable from the first few paid signups.)

## Profit at different user counts

| Paying users | Registered users (at 25% conv.) | Net revenue/mo | Infra/mo | Profit/mo |
|---|---|---|---|---|
| 5 | 20 | RM 145 | ~RM 5 | ~RM 140 |
| 20 | 80 | RM 580 | ~RM 10 | ~RM 570 |
| 50 | 200 | RM 1,450 | ~RM 100 (Pro kicks in) | ~RM 1,350 |
| 100 | 400 | RM 2,900 | ~RM 160 | ~RM 2,740 |

## Ideal number of users

- **No cost-driven ceiling** — infra is nearly free per user; margin stays ~90%+ even at 100+ users. The ceiling is **support effort**, not dollars.
- **5–10 paying users** → operating break-even; a profitable project.
- **50 paying users (~200 registered)** → ~RM 1,450/mo (~RM 17k/yr) — genuinely worth the time.
- **100 paying users (~400 registered)** → ~RM 2,900/mo (~RM 35k/yr) — infra is only ~5% of revenue.

**Recommendation:** target **50–100 paying users (≈ 200–400 registered)** as the ideal zone — a real business with manageable one-person support load. Growth (flagship) plan should be the main upsell.

## Cash-flow note

Plans are **annual**, so revenue arrives in lump sums: 100 paying users ≈ **RM 30–35k collected upfront per year** (minus ~RM 2.5k Stripe fees). Great for upfront cash, but don't treat month-1 bank balance as steady monthly income for months 2–12.

