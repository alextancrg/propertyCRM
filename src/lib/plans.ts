// Subscription plans for AssetHub property managers.
//
// Pricing follows the recommended structure:
//   Free  — up to 1 property, RM 0/yr
//   Starter / Landlord  — up to 3 properties, RM 129/yr
//   Growth (Flagship)   — up to 10 properties, RM 299/yr
//   Pro / Portfolio     — up to 30 properties, RM 699/yr
//   Business / Custom   — unlimited (50+), RM 1,299+/yr
//
// Charging happens through a Stripe Checkout Session on a yearly-recurring
// Price. The Stripe Price IDs live in env vars (STRIPE_PRICE_<TIER>); when a
// price isn't configured the billing UI falls back to dev-mode simulation
// locally so the flow can be smoke-tested without a Stripe account.

export type Plan = {
  id: string;
  name: string;
  tagline: string;
  propertyLimit: number | null; // null = unlimited (Business / custom)
  yearlyPriceRM: number; // 0 = free
  monthlyEquivalentRM: number;
  targetUser: string;
  features: string[];
  highlight?: boolean;
};

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    tagline: "Single-property owners",
    propertyLimit: 1,
    yearlyPriceRM: 0,
    monthlyEquivalentRM: 0,
    targetUser: "Accidental landlords",
    features: [
      "Up to 1 property",
      "Bills & utility tracking",
      "Document vault",
      "Own Stay support",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    tagline: "Landlord",
    propertyLimit: 3,
    yearlyPriceRM: 129,
    monthlyEquivalentRM: 10.75,
    targetUser: "Landlords with a small portfolio",
    features: [
      "Up to 3 properties",
      "Everything in Free",
      "Rental collection",
      "Email support",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    tagline: "Flagship",
    propertyLimit: 10,
    yearlyPriceRM: 299,
    monthlyEquivalentRM: 24.9,
    targetUser: "Growing portfolios, mom-and-pop investors",
    features: [
      "Up to 10 properties",
      "Everything in Starter",
      "Tax & Audit reports",
      "WhatsApp AI agent",
      "Priority support",
    ],
    highlight: true,
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "Portfolio",
    propertyLimit: 30,
    yearlyPriceRM: 699,
    monthlyEquivalentRM: 58.25,
    targetUser: "Small-scale property managers, serious investors",
    features: [
      "Up to 30 properties",
      "Everything in Growth",
      "Advanced reporting",
      "Multi-manager collaboration",
    ],
  },
  {
    id: "business",
    name: "Business",
    tagline: "Custom",
    propertyLimit: null,
    yearlyPriceRM: 1299,
    monthlyEquivalentRM: 108.25,
    targetUser: "Agencies or heavy portfolio holders",
    features: [
      "Unlimited properties (50+)",
      "Everything in Pro",
      "Custom onboarding",
      "Dedicated account manager",
    ],
  },
];

export const DEFAULT_PLAN = "free";

/** Resolve a plan by id (falls back to the free plan). */
export function getPlan(id: string): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}

/** The property limit for a plan id, or null when unlimited. */
export function planPropertyLimit(id: string): number | null {
  return getPlan(id).propertyLimit;
}

/**
 * The Stripe Price ID for a plan, read from env (STRIPE_PRICE_<TIER>).
 * Returns null when not configured — the checkout route then uses dev-mode
 * simulation instead of creating a real Stripe Checkout session.
 */
export function stripePriceId(planId: string): string | null {
  switch (planId) {
    case "starter":
      return process.env.STRIPE_PRICE_STARTER || null;
    case "growth":
      return process.env.STRIPE_PRICE_GROWTH || null;
    case "pro":
      return process.env.STRIPE_PRICE_PRO || null;
    case "business":
      return process.env.STRIPE_PRICE_BUSINESS || null;
    default:
      return null;
  }
}

/** Whether a live Stripe secret key is configured. */
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}
