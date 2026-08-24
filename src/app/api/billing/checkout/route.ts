import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";
import { PLANS, stripePriceId } from "@/lib/plans";
import { upsertSubscription } from "@/lib/billing";
import { logAudit } from "@/lib/ai";

export const dynamic = "force-dynamic";

/**
 * Start a Stripe Checkout Session for a yearly subscription to the chosen
 * plan. Returns { url } which the client redirects to (Stripe-hosted payment
 * page). When Stripe isn't configured and we're not in production, the plan is
 * activated locally (dev simulation) so the flow can be smoke-tested.
 */
export async function POST(req: NextRequest) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const planId = typeof body.planId === "string" ? body.planId : "";
  const plan = PLANS.find((p) => p.id === planId);
  if (!plan) {
    return NextResponse.json({ error: "Unknown plan." }, { status: 400 });
  }

  const priceId = stripePriceId(planId);
  const stripe = getStripe();

  // Free plan: no real payment. With Stripe configured, downgrading to Free is
  // handled through the billing portal (cancel); the UI routes there directly.
  if (plan.yearlyPriceRM === 0) {
    if (stripe) {
      return NextResponse.json(
        { error: "To switch to the Free plan, cancel your subscription from the billing portal." },
        { status: 400 },
      );
    }
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Billing is not configured yet. Please try again later." },
        { status: 503 },
      );
    }
    await upsertSubscription({
      userId: me.id,
      planId: "free",
      status: "active",
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    });
    await logAudit(
      "Subscription",
      "DOWNGRADED",
      "Switched to the Free plan (dev simulation — no real charge).",
      undefined,
      me.id,
    );
    return NextResponse.json({ ok: true, simulated: true, planId: "free" });
  }

  // Dev-mode fallback: activate the paid plan locally so the subscription flow
  // can be verified without a Stripe account. Never allowed in production.
  if (!stripe || !priceId) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Billing is not configured yet. Please try again later." },
        { status: 503 },
      );
    }
    await upsertSubscription({
      userId: me.id,
      planId,
      status: "active",
      currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    });
    await logAudit(
      "Subscription",
      "UPGRADED",
      `Switched to the ${plan.name} plan (dev simulation — no real charge).`,
      undefined,
      me.id,
    );
    return NextResponse.json({ ok: true, simulated: true, planId });
  }

  const origin = req.nextUrl.origin;
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/subscription?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/subscription?canceled=1`,
      client_reference_id: me.id,
      customer_email: me.email,
      allow_promotion_codes: true,
      metadata: { userId: me.id, planId },
      subscription_data: { metadata: { userId: me.id, planId } },
    });

    return NextResponse.json({ ok: true, url: session.url });
  } catch (err) {
    console.error("[checkout] Stripe session create failed:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Could not start checkout.",
      },
      { status: 500 },
    );
  }
}
