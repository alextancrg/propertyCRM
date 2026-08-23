import { prisma } from "@/lib/prisma";

export type SessionUser = { id: string; name: string; email: string; role: string };

/**
 * Role-based visibility:
 *  - Administrators see everything (returns null = "no restriction").
 *  - Property Managers only see owners they created or were assigned to, and
 *    the properties owned by those owners.
 */

/** Owner IDs visible to a user, or null when unrestricted (Administrator). */
export async function visibleOwnerIds(user: SessionUser): Promise<string[] | null> {
  if (user.role === "Administrator") return null;
  const [created, assigned] = await Promise.all([
    prisma.owner.findMany({
      where: { createdById: user.id, deletedAt: null },
      select: { id: true },
    }),
    prisma.ownerManager.findMany({
      where: { userId: user.id, owner: { deletedAt: null } },
      select: { ownerId: true },
    }),
  ]);
  return Array.from(new Set([...created.map((o) => o.id), ...assigned.map((a) => a.ownerId)]));
}

/** Property IDs visible to a user, or null when unrestricted (Administrator). */
export async function visiblePropertyIds(user: SessionUser): Promise<string[] | null> {
  if (user.role === "Administrator") return null;
  const ownerIds = await visibleOwnerIds(user);
  if (!ownerIds) return null;
  if (ownerIds.length === 0) return [];
  const links = await prisma.propertyOwner.findMany({
    where: { ownerId: { in: ownerIds }, property: { deletedAt: null } },
    select: { propertyId: true },
  });
  return Array.from(new Set(links.map((l) => l.propertyId)));
}

/** A Prisma `where` filter (or `undefined` for unrestricted) scoping to the user's visible property IDs. */
export async function propertyScope(user: SessionUser) {
  const ids = await visiblePropertyIds(user);
  return ids === null ? {} : { id: { in: ids } };
}
