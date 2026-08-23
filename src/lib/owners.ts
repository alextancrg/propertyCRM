import { prisma } from "./prisma";

export type OwnerInput = {
  ownerId?: string | null;
  ownerName?: string | null;
  ownerPhone?: string | null;
  ownerIc?: string | null;
  sharePercent?: number | string | null;
};

/**
 * Resolve an owner input into an existing owner id, creating a new owner
 * record when a new name is provided. Used for both create & update.
 * When a new owner is created, `createdById` records which property manager
 * registered them (drives role-based visibility).
 */
export async function resolveOwnerInput(
  owner: OwnerInput,
  createdById?: string | null,
): Promise<string> {
  if (owner.ownerId) return owner.ownerId;
  const created = await prisma.owner.create({
    data: {
      name: (owner.ownerName ?? "").trim(),
      phone: owner.ownerPhone?.trim() || null,
      icNumber: owner.ownerIc?.trim() || null,
      createdById: createdById ?? null,
    },
  });
  return created.id;
}

/**
 * Validate a list of owner inputs: at least one owner and total share <= 100.
 * Returns { ok: true } or { ok: false, error }.
 */
export function validateOwners(
  owners: OwnerInput[],
): { ok: true } | { ok: false; error: string } {
  const clean = owners.filter((o) => o.ownerId || (o.ownerName && o.ownerName.trim()));
  if (clean.length === 0) {
    return { ok: false, error: "At least one owner is required for the property." };
  }
  const total = clean.reduce((sum, o) => sum + Number(o.sharePercent ?? 100), 0);
  if (total > 100.0001) {
    return {
      ok: false,
      error: `Total ownership share cannot exceed 100% (currently ${Math.round(total * 100) / 100}%).`,
    };
  }
  return { ok: true };
}
