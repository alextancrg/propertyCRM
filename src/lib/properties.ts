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
