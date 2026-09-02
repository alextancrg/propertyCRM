// Property unit types offered in the Add/Edit property form and filters.
export const PROPERTY_TYPES = [
  "Apartment",
  "Condominium",
  "Villa",
  "Shophouse",
  "Office",
  "Bungalow",
  "Semi Detached",
  "Shop Lot",
  "Car Park Lot",
] as const;

export type PropertyType = (typeof PROPERTY_TYPES)[number];

// Default grace period (in days) after a rent due date before an unpaid month
// is treated as overdue. Configurable per property in Properties & Leases.
// (Mirrors the historical global 7-day grace in src/lib/rentals.ts.)
export const PROPERTY_RENT_GRACE_DAYS_DEFAULT = 7;

/**
 * Clamp a property's rent grace period to a sane 0–90 day range, falling back
 * to the default (or the passed fallback) when the value is missing/invalid.
 */
export function sanitizeGraceDays(
  value: unknown,
  fallback: number = PROPERTY_RENT_GRACE_DAYS_DEFAULT,
): number {
  if (value === undefined || value === null || value === "") return fallback;
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(90, Math.max(0, n));
}

// Max length for the free-text remarks field on a property (shown on the card
// and captured in the Add/Edit form).
export const PROPERTY_MAX_REMARKS = 300;

// Default meter mode options for a unit's electricity meter (shown in the
// Properties & Leases table, following the EasyRenz design).
export const PROPERTY_METER_MODES = ["Prepaid", "Postpaid"] as const;

// Max length of the comma-separated unit tags field (e.g. "Female Only,
// Private Bathroom").
export const PROPERTY_UNIT_TAGS_MAX = 200;

// Max length of the free-text remarks a manager can attach to a lease that is
// coming to an end (tenant notice, handover notes, etc.).
export const LEASE_END_REMARKS_MAX = 300;

// Window (in days) before a lease's end date during which the "coming to an
// end" status actions (add remarks / tenant informed vacating) are surfaced.
export const LEASE_END_NOTICE_DAYS = 90;

// Lease-end urgency coloring on the Properties & Leases table (Unit's Rental
// Status column): 1 month or less to expiry → red, 2 months or less → orange,
// otherwise the default purple "Contract End" badge.
export const LEASE_END_RED_DAYS = 30; // ~1 month or less → red
// (2 months or less → orange is the 60-day band below the red threshold)
export const LEASE_END_ORANGE_DAYS = 60;
