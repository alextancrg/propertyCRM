import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { visibleOwnerIds } from "@/lib/access";
import { OwnersClient } from "@/components/owners/OwnersClient";

export const dynamic = "force-dynamic";

export default async function OwnersPage() {
  const me = await requireUser();
  const ownerScope = await visibleOwnerIds(me);
  const [owners, managers] = await Promise.all([
    prisma.owner.findMany({
      where: {
        deletedAt: null,
        ...(ownerScope ? { id: { in: ownerScope } } : {}),
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        icNumber: true,
        phone: true,
        email: true,
        createdAt: true,
        createdBy: { select: { id: true, name: true } },
        assignedManagers: { select: { user: { select: { id: true, name: true } } } },
        properties: { select: { property: { select: { id: true, name: true } } } },
      },
    }),
    prisma.user.findMany({
      where: { role: "Property Manager" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <OwnersClient
      me={{ id: me.id, name: me.name, email: me.email, role: me.role }}
      owners={owners.map((o) => ({
        ...o,
        createdAt: o.createdAt.toISOString(),
      }))}
      managers={managers}
    />
  );
}
