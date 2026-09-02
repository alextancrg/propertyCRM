import { prisma } from "@/lib/prisma";

export type SessionUser = { id: string; name: string; email: string; role: string; language?: string };

/**
 * Role-based visibility:
 *  - Administrators see everything (returns null = "no restriction").
 *  - Property Managers only see owners they created or were assigned to, and
 *    the properties owned by those owners.
 *  - Accepted sharing links (ManagerSharing) share visibility: every manager
 *    in the same connected component of the sharing graph sees the union of
 *    all of the members' owners/properties (transitive, bidirectional).
 */

/**
 * The connected component of the manager-sharing graph containing `userId`
 * (including the user themselves). Sharing is transitive — A<->B and B<->C
 * makes A, B and C one component.
 */
async function sharingComponent(userId: string): Promise<string[]> {
  const members = new Set<string>([userId]);
  const queue = [userId];
  while (queue.length) {
    const current = queue.pop()!;
    const links = await prisma.managerSharing.findMany({
      where: { OR: [{ userAId: current }, { userBId: current }] },
      select: { userAId: true, userBId: true },
    });
    for (const link of links) {
      for (const other of [link.userAId, link.userBId]) {
        if (!members.has(other)) {
          members.add(other);
          queue.push(other);
        }
      }
    }
  }
  return Array.from(members);
}

/** The owner IDs visible to a set of manager user ids (created + assigned). */
async function ownerIdsForMembers(memberIds: string[]): Promise<string[]> {
  const [created, assigned] = await Promise.all([
    prisma.owner.findMany({
      where: { createdById: { in: memberIds }, deletedAt: null },
      select: { id: true },
    }),
    prisma.ownerManager.findMany({
      where: { userId: { in: memberIds }, owner: { deletedAt: null } },
      select: { ownerId: true },
    }),
  ]);
  return Array.from(new Set([...created.map((o) => o.id), ...assigned.map((a) => a.ownerId)]));
}

/** Owner IDs visible to a user, or null when unrestricted (Administrator). */
export async function visibleOwnerIds(user: SessionUser): Promise<string[] | null> {
  if (user.role === "Administrator") return null;
  const members = await sharingComponent(user.id);
  return ownerIdsForMembers(members);
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

/**
 * The user ids a Property Manager can see in the Managers section — themselves
 * plus everyone they share visibility with (same connected component). Admins
 * see everyone (null).
 */
export async function visibleManagerIds(user: SessionUser): Promise<string[] | null> {
  if (user.role === "Administrator") return null;
  return sharingComponent(user.id);
}

/**
 * A manager's direct sharing partners — the other user ids linked to them via
 * a ManagerSharing row (bidirectional). Used to enforce the per-manager cap on
 * how many property managers they can share/link with.
 */
export async function sharingPartnerIds(userId: string): Promise<string[]> {
  const links = await prisma.managerSharing.findMany({
    where: { OR: [{ userAId: userId }, { userBId: userId }] },
    select: { userAId: true, userBId: true },
  });
  const ids = new Set<string>();
  for (const link of links) {
    if (link.userAId !== userId) ids.add(link.userAId);
    if (link.userBId !== userId) ids.add(link.userBId);
  }
  return Array.from(ids);
}

/** Whether a user is a Property Manager and therefore subject to the sharing-partner cap. */
export function isSharingCapUser(user: Pick<SessionUser, "role">): boolean {
  return user.role === "Property Manager";
}
