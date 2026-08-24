import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

/**
 * Open the Stripe Customer Portal so a user can manage their subscription
 * (upgrade, downgrade, cancel, update payment method). Requires an active
 * Stripe customer id on their subscription record.
 */
export async function POST(req: NextRequest) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Billing is not configured yet. Please try again later." },
      { status: 503 },
    );
  }

  const sub = await prisma.subscription.findUnique({ where: { userId: me.id } });
  if (!sub?.stripeCustomerId) {
    return NextResponse.json(
      { error: "No active subscription to manage." },
      { status: 400 },
    );
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${req.nextUrl.origin}/subscription`,
  });

  return NextResponse.json({ ok: true, url: session.url });
}
