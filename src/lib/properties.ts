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
