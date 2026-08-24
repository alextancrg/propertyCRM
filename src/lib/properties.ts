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
