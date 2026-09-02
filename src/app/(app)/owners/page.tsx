import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { visibleOwnerIds } from "@/lib/access";
import { formatDate } from "@/lib/format";
import { OwnersClient } from "@/components/owners/OwnersClient";

export const dynamic = "force-dynamic";

export default async function OwnersPage() {
  const me = await requireUser();
  const ownerScope = await visibleOwnerIds(me);
  const owners = await prisma.owner.findMany({
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
  });

  return (
    <OwnersClient
      me={{ id: me.id, name: me.name, email: me.email, role: me.role }}
      // registeredAt is formatted on the server (not re-formatted in the
      // browser) so the SSR text is identical to what React hydrates. Vercel
      // renders in UTC while the browser is in another timezone; a mismatch
      // aborts hydration and leaves the page's buttons unresponsive.
      owners={owners.map((o) => ({
        ...o,
        registeredAt: formatDate(o.createdAt),
      }))}
    />
  );
}
