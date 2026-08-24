"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cx, formatMYR, formatDate } from "@/lib/format";

type Plan = {
  id: string;
  name: string;
  tagline: string;
  propertyLimit: number | null;
  yearlyPriceRM: number;
  monthlyEquivalentRM: number;
  targetUser: string;
  features: string[];
  highlight?: boolean;
  canCheckout: boolean;
};

type Subscription = {
  planId: string;
  planName: string;
  planTagline: string;
  status: string;
  propertyLimit: number | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  hasStripeCustomer: boolean;
};

const PLAN_ICONS: Record<string, string> = {
  free: "fa-house-user",
  starter: "fa-key",
  growth: "fa-chart-line",
  pro: "fa-briefcase",
  business: "fa-building",
};

/** The date the current plan stops being available after cancellation (period end minus a day). */
function availableUntil(iso: string): string {
  return formatDate(new Date(new Date(iso).getTime() - 24 * 60 * 60 * 1000).toISOString());
}

export function SubscriptionClient({
  isAdmin,
  subscription,
  propertyCount,
  propertyLimit,
  plans,
  devMode,
}: {
  isAdmin: boolean;
  subscription: Subscription;
  propertyCount: number;
  propertyLimit: number | null;
  plans: Plan[];
  devMode: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const effectiveLimit = isAdmin ? null : propertyLimit;
  const usagePct =
    effectiveLimit !== null && effectiveLimit > 0
      ? Math.min(100, Math.round((propertyCount / effectiveLimit) * 100))
      : 0;
  const atLimit = effectiveLimit !== null && propertyCount >= effectiveLimit;
  const currentPlan = plans.find((p) => p.id === subscription.planId) ?? plans[0];

  async function choose(plan: Plan) {
    setBusy(plan.id);
    setError(null);
    setNotice(null);
    try {
      // Downgrade to Free on a real Stripe customer → manage via the portal.
      if (plan.id === "free" && !devMode && subscription.hasStripeCustomer) {
        const res = await fetch("/api/billing/portal", { method: "POST" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error ?? "Could not open billing.");
        if (data.url) window.location.href = data.url;
        return;
      }
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Could not start checkout.");
      if (data.url) {
        window.location.href = data.url;
      } else if (data.simulated) {
        setNotice(`Dev mode: switched to the ${plan.name} plan locally (no real charge).`);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  async function manageBilling() {
    setBusy("portal");
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Could not open billing.");
      if (data.url) window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  const statusLabel = subscription.cancelAtPeriodEnd
    ? "Canceled"
    : subscription.status === "active"
      ? "Active"
      : subscription.status === "trialing"
        ? "Trialing"
        : subscription.status === "past_due"
          ? "Past due"
          : subscription.status === "canceled"
            ? "Canceled"
            : subscription.status;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-slate-900">Subscription &amp; Billing</h3>
        <p className="text-sm text-slate-500">
          Your plan controls how many properties you can manage. Payments are handled securely by Stripe.
        </p>
      </div>

      {/* Current plan + usage */}
      <div className="card overflow-hidden">
        <div className="flex flex-col gap-5 border-b border-slate-100 bg-gradient-to-br from-primary-900 to-primary p-6 text-white sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-white/10 text-xl">
              <i className={cx("fa-solid", PLAN_ICONS[subscription.planId] ?? "fa-crown")} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-lg font-bold">{isAdmin ? "Unlimited (Administrator)" : subscription.planName}</p>
                <span
                  className={cx(
                    "pill border",
                    subscription.status === "active"
                      ? "border-emerald-300/40 bg-emerald-400/20 text-emerald-100"
                      : "border-amber-300/40 bg-amber-400/20 text-amber-100",
                  )}
                >
                  {statusLabel}
                </span>
              </div>
              <p className="text-sm text-blue-200">
                {isAdmin
                  ? "Admins manage the whole portfolio without a plan limit."
                  : `${subscription.planTagline} · ${subscription.cancelAtPeriodEnd ? "Subscription cancelled" : "yearly billing"}`}
              </p>
            </div>
          </div>
          {!isAdmin && subscription.hasStripeCustomer && (
            <button
              onClick={manageBilling}
              disabled={busy === "portal"}
              className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20 disabled:opacity-50"
            >
              {busy === "portal" ? (
                <i className="fa-solid fa-spinner fa-spin" />
              ) : (
                <i className="fa-solid fa-credit-card" />
              )}
              Manage billing
            </button>
          )}
        </div>

        {!isAdmin && (
          <div className="p-6">
            <div className="mb-2 flex items-end justify-between">
              <p className="text-sm font-semibold text-slate-700">
                Property usage — <span className="font-bold text-slate-900">{propertyCount}</span> of{" "}
                {effectiveLimit === null ? (
                  <span className="font-bold text-slate-900">unlimited</span>
                ) : (
                  <span className="font-bold text-slate-900">{effectiveLimit}</span>
                )}
              </p>
              <p className="text-xs font-bold text-slate-500">{usagePct}%</p>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={cx(
                  "h-full rounded-full transition-all",
                  atLimit ? "bg-amber-500" : "bg-primary",
                )}
                style={{ width: `${usagePct}%` }}
              />
            </div>
            <div className="mt-3 flex flex-col gap-1 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <span>
                {subscription.cancelAtPeriodEnd ? (
                  <>
                    <i className="fa-solid fa-ban mr-1 text-amber-500" />
                    <span className="font-semibold text-slate-700">Subscription cancelled</span> — current plan
                    available until{" "}
                    <span className="font-semibold text-slate-700">
                      {subscription.currentPeriodEnd ? availableUntil(subscription.currentPeriodEnd) : "period end"}
                    </span>
                  </>
                ) : subscription.currentPeriodEnd ? (
                  <>
                    <i className="fa-solid fa-calendar-day mr-1" />
                    Renews {formatDate(subscription.currentPeriodEnd)}
                  </>
                ) : (
                  "Free plan — no renewal date"
                )}
              </span>
              {atLimit && (
                <span className="font-semibold text-amber-600">
                  <i className="fa-solid fa-triangle-exclamation mr-1" />
                  Plan limit reached — upgrade to add more properties.
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {atLimit && !isAdmin && (
        <div className="card flex flex-col gap-3 border-amber-200 bg-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-bold text-slate-900">
              <i className="fa-solid fa-circle-exclamation mr-2 text-amber-500" />
              You've reached the {subscription.planName} limit of {effectiveLimit} propert
              {effectiveLimit === 1 ? "y" : "ies"}.
            </p>
            <p className="text-sm text-slate-600">
              Upgrade to a higher plan to continue adding units. Existing properties stay untouched.
            </p>
          </div>
          <button
            onClick={() => {
              const next = plans.find((p) => p.id !== subscription.planId && p.yearlyPriceRM > currentPlan.yearlyPriceRM);
              if (next) choose(next);
            }}
            disabled={Boolean(busy)}
            className="btn-primary shrink-0 bg-amber-500 hover:bg-amber-600"
          >
            <i className="fa-solid fa-crown" /> Upgrade now
          </button>
        </div>
      )}

      {error && (
        <div className="card border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          <i className="fa-solid fa-triangle-exclamation mr-2" />
          {error}
        </div>
      )}
      {notice && (
        <div className="card border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
          <i className="fa-solid fa-circle-check mr-2" />
          {notice}
        </div>
      )}
      {devMode && (
        <div className="card border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          <i className="fa-solid fa-flask mr-2" />
          <span className="font-semibold text-slate-600">Dev mode:</span> Stripe isn't configured, so plan
          changes are simulated locally (no real charge). Add <code className="rounded bg-slate-200 px-1">STRIPE_SECRET_KEY</code>{" "}
          and <code className="rounded bg-slate-200 px-1">STRIPE_PRICE_*</code> to enable live payments.
        </div>
      )}

      {/* Plan grid */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = plan.id === subscription.planId;
          const isDowngrade = !isCurrent && plan.yearlyPriceRM < currentPlan.yearlyPriceRM;
          const payable = plan.yearlyPriceRM === 0 || plan.canCheckout || devMode;
          return (
            <div
              key={plan.id}
              className={cx(
                "card relative flex flex-col p-6 transition",
                plan.highlight && "ring-2 ring-primary",
                isCurrent && "border-primary-300 bg-primary-50/40",
              )}
            >
              {plan.highlight && (
                <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow">
                  Flagship
                </span>
              )}
              {isCurrent && (
                <span className="absolute -top-3 left-6 rounded-full bg-emerald-500 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow">
                  Current plan
                </span>
              )}

              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={cx(
                      "grid h-10 w-10 place-items-center rounded-xl text-base",
                      plan.highlight ? "bg-primary text-white" : "bg-slate-100 text-slate-500",
                    )}
                  >
                    <i className={cx("fa-solid", PLAN_ICONS[plan.id] ?? "fa-crown")} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{plan.name}</p>
                    <p className="text-xs text-slate-500">{plan.tagline}</p>
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <p className="text-3xl font-extrabold tracking-tight text-slate-900">
                  {plan.yearlyPriceRM === 0 ? (
                    "Free"
                  ) : (
                    <>
                      {formatMYR(plan.yearlyPriceRM, { decimals: 0 })}
                      <span className="text-sm font-semibold text-slate-400">/yr</span>
                    </>
                  )}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {plan.yearlyPriceRM === 0
                    ? "No card required"
                    : `≈ ${formatMYR(plan.monthlyEquivalentRM, { decimals: 2 })}/month, billed yearly`}
                </p>
              </div>

              <div className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm">
                <p className="flex items-center gap-2 font-semibold text-slate-700">
                  <i className="fa-solid fa-house text-xs text-primary" />
                  {plan.propertyLimit === null
                    ? "Unlimited properties (50+)"
                    : `Up to ${plan.propertyLimit} propert${plan.propertyLimit === 1 ? "y" : "ies"}`}
                </p>
                <p className="flex items-center gap-2 text-xs text-slate-500">
                  <i className="fa-solid fa-user text-xs text-primary" />
                  {plan.targetUser}
                </p>
                <ul className="space-y-1.5 pt-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-slate-600">
                      <i className="fa-solid fa-circle-check mt-0.5 text-[10px] text-emerald-500" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-auto pt-5">
                {isCurrent ? (
                  <button disabled className="btn-ghost w-full cursor-default opacity-60">
                    <i className="fa-solid fa-check" /> Current plan
                  </button>
                ) : (
                  <button
                    onClick={() => choose(plan)}
                    disabled={Boolean(busy) || !payable}
                    className={cx(
                      "w-full",
                      plan.highlight ? "btn-primary" : "btn-ghost",
                    )}
                  >
                    {busy === plan.id ? (
                      <><i className="fa-solid fa-spinner fa-spin" /> Processing…</>
                    ) : isDowngrade ? (
                      <><i className="fa-solid fa-arrow-down" /> Downgrade</>
                    ) : (
                      <><i className="fa-solid fa-crown" /> Upgrade</>
                    )}
                  </button>
                )}
                {!payable && (
                  <p className="mt-2 text-center text-[11px] text-slate-400">
                    Contact us to activate this plan.
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-slate-400">
        Payments are processed securely by Stripe. Questions? Visit the{" "}
        <a href="/support" className="font-semibold text-primary hover:underline">
          Support
        </a>{" "}
        page.
      </p>
    </div>
  );
}
