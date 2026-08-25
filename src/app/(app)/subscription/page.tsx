import { requireUser } from "@/lib/auth";
import {
  getSubscriptionView,
  countActiveProperties,
  getUserPropertyLimit,
} from "@/lib/billing";
import { PLANS, stripePriceId, isStripeConfigured } from "@/lib/plans";
import { SubscriptionClient } from "@/components/billing/SubscriptionClient";


export const dynamic = "force-dynamic";

export default async function SubscriptionPage() {
  const me = await requireUser();
  const isAdmin = me.role === "Administrator";

  const [subscription, propertyCount, propertyLimit] = await Promise.all([
    getSubscriptionView(me.id),
    isAdmin ? Promise.resolve(0) : countActiveProperties(me),
    isAdmin ? Promise.resolve(null) : getUserPropertyLimit(me),
  ]);

  const plans = PLANS.map((p) => ({
    ...p,
    // A plan can be paid via real Stripe checkout when it has a price ID
    // configured (or when it's the free plan). In dev mode every paid plan can
    // also be chosen through local simulation.
    canCheckout: p.yearlyPriceRM === 0 || Boolean(stripePriceId(p.id)),
  }));

  const devMode = !isStripeConfigured() && process.env.NODE_ENV !== "production";

  return (
    <SubscriptionClient
      isAdmin={isAdmin}
      subscription={subscription}
      propertyCount={propertyCount}
      propertyLimit={propertyLimit}
      plans={plans}
      devMode={devMode}
    />
  );
}
