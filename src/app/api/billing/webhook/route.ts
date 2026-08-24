import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { upsertSubscription } from "@/lib/billing";

export const dynamic = "force-dynamic";

/**
 * Stripe webhook endpoint. Point Stripe → Webhooks at
 *   POST /api/billing/webhook
 * with STRIPE_WEBHOOK_SECRET set to the signing secret.
 *
 * Handles the events that keep the local Subscription record in sync:
 *  - checkout.session.completed      → activate the chosen plan
 *  - customer.subscription.updated   → status / period / cancel-at-period-end
 *  - customer.subscription.deleted   → downgrade to Free
 *  - invoice.paid                    → refresh period end
 */
export async function POST(req: NextRequest) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Billing not configured." }, { status: 503 });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook secret missing." }, { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, signature, secret);
  } catch {
    return NextResponse.json(
      { error: "Webhook signature verification failed." },
      { status: 400 },
    );
  }

  // In the current Stripe API the billing period lives on the subscription's
  // first item (`items.data[0].current_period_end`).
  function periodEnd(sub: Stripe.Subscription): Date | null {
    const end = sub.items.data[0]?.current_period_end;
    return end ? new Date(end * 1000) : null;
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const planId = session.metadata?.planId;
      if (userId && planId) {
        const subId =
          typeof session.subscription === "string" ? session.subscription : undefined;
        let currentPeriodEnd: Date | null = null;
        if (subId) {
          const s = await stripe.subscriptions.retrieve(subId);
          currentPeriodEnd = periodEnd(s);
        }
        await upsertSubscription({
          userId,
          planId,
          status: "active",
          stripeCustomerId:
            typeof session.customer === "string" ? session.customer : null,
          stripeSubscriptionId: subId ?? null,
          currentPeriodEnd,
          cancelAtPeriodEnd: false,
        });
      }
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.userId;
      if (userId) {
        await upsertSubscription({
          userId,
          planId: sub.metadata?.planId ?? "free",
          status: sub.status,
          stripeSubscriptionId: sub.id,
          currentPeriodEnd: periodEnd(sub),
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        });
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.userId;
      if (userId) {
        await upsertSubscription({
          userId,
          planId: "free",
          status: "canceled",
          currentPeriodEnd: periodEnd(sub),
          cancelAtPeriodEnd: false,
        });
      }
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      // In the current Stripe API the subscription is nested under the
      // invoice's parent (subscription_details.subscription).
      const subRef = invoice.parent?.subscription_details?.subscription;
      const subId = typeof subRef === "string" ? subRef : subRef?.id;
      if (subId) {
        const s = await stripe.subscriptions.retrieve(subId);
        const userId = s.metadata?.userId;
        if (userId) {
          await upsertSubscription({
            userId,
            planId: s.metadata?.planId ?? "free",
            status: s.status,
            stripeSubscriptionId: subId,
            currentPeriodEnd: periodEnd(s),
            cancelAtPeriodEnd: s.cancel_at_period_end,
          });
        }
      }
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
