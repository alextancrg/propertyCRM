import Stripe from "stripe";

// API version shipped with the installed Stripe SDK. Pinning it keeps requests
// versioned and silences the "unversioned API request" warning.
const STRIPE_API_VERSION = "2026-07-29.dahlia";

let cached: Stripe | null = null;

/**
 * Lazily build the Stripe client from STRIPE_SECRET_KEY. Returns null when the
 * key is not configured (billing falls back to dev-mode simulation).
 */
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!cached) {
    cached = new Stripe(key, {
      apiVersion: STRIPE_API_VERSION,
    });
  }
  return cached;
}
