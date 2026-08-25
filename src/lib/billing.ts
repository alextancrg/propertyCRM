import { prisma } from "./prisma";
import { getPlan, planPropertyLimit, planWhatsappLimit } from "./plans";
import { visiblePropertyIds, type SessionUser } from "./access";

export type SubscriptionView = {
  planId: string;
  planName: string;
  planTagline: string;
  status: string;
  propertyLimit: number | null; // null = unlimited (Business / Admin)
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  hasStripeCustomer: boolean;
};

const DEFAULT_VIEW: SubscriptionView = {
  planId: "free",
  planName: getPlan("free").name,
  planTagline: getPlan("free").tagline,
  status: "active",
  propertyLimit: getPlan("free").propertyLimit,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  hasStripeCustomer: false,
};

/** The current subscription for a user (defaults to the free plan). */
export async function getSubscriptionView(userId: string): Promise<SubscriptionView> {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  if (!sub) return DEFAULT_VIEW;
  const plan = getPlan(sub.plan);
  return {
    planId: sub.plan,
    planName: plan.name,
    planTagline: plan.tagline,
    status: sub.status,
    propertyLimit: sub.propertyLimit ?? plan.propertyLimit,
    currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    hasStripeCustomer: Boolean(sub.stripeCustomerId),
  };
}

/** The property limit for a user, or null when unlimited (Business / Admin). */
export async function getUserPropertyLimit(user: SessionUser): Promise<number | null> {
  if (user.role === "Administrator") return null;
  const sub = await prisma.subscription.findUnique({ where: { userId: user.id } });
  return planPropertyLimit(sub?.plan ?? "free");
}

/**
 * The monthly WhatsApp AI message allowance for a user, or null when
 * unlimited (Administrator). Derived from the user's subscription plan.
 */
export async function getUserWhatsappLimit(user: SessionUser): Promise<number | null> {
  if (user.role === "Administrator") return null;
  const sub = await prisma.subscription.findUnique({ where: { userId: user.id } });
  return planWhatsappLimit(sub?.plan ?? "free");
}

/** Number of active (non-deleted) properties visible to the user. */
export async function countActiveProperties(user: SessionUser): Promise<number> {
  const scope = await visiblePropertyIds(user);
  return prisma.property.count({
    where: scope === null ? { deletedAt: null } : { deletedAt: null, id: { in: scope } },
  });
}

export type PropertyLimitCheck =
  | { ok: true; limit: number | null; count: number }
  | { ok: false; limit: number; count: number; error: string };

/** Whether the user may add another property under their current plan. */
export async function assertCanAddProperty(user: SessionUser): Promise<PropertyLimitCheck> {
  const limit = await getUserPropertyLimit(user);
  const count = await countActiveProperties(user);
  if (limit === null) return { ok: true, limit: null, count };
  if (count >= limit) {
    const sub = await prisma.subscription.findUnique({ where: { userId: user.id } });
    const plan = getPlan(sub?.plan ?? "free");
    return {
      ok: false,
      limit,
      count,
      error: `You've reached the ${plan.name} plan limit of ${limit} propert${
        limit === 1 ? "y" : "ies"
      }. Upgrade your subscription to manage more units.`,
    };
  }
  return { ok: true, limit, count };
}

export type UpsertSubscriptionInput = {
  userId: string;
  planId: string;
  status: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd?: boolean;
};

/** Create (or update) a user's subscription record, typically from a Stripe event. */
export async function upsertSubscription(input: UpsertSubscriptionInput) {
  const plan = getPlan(input.planId);
  return prisma.subscription.upsert({
    where: { userId: input.userId },
    update: {
      plan: input.planId,
      status: input.status,
      propertyLimit: plan.propertyLimit,
      stripeCustomerId: input.stripeCustomerId ?? undefined,
      stripeSubscriptionId: input.stripeSubscriptionId ?? undefined,
      currentPeriodEnd: input.currentPeriodEnd ?? undefined,
      cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
    },
    create: {
      userId: input.userId,
      plan: input.planId,
      status: input.status,
      propertyLimit: plan.propertyLimit,
      stripeCustomerId: input.stripeCustomerId ?? null,
      stripeSubscriptionId: input.stripeSubscriptionId ?? null,
      currentPeriodEnd: input.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
    },
  });
}
