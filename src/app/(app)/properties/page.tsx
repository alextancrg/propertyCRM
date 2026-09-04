import { prisma } from "@/lib/prisma";
import { PropertiesClient } from "@/components/properties/PropertiesClient";
import { requireUser } from "@/lib/auth";
import { propertyScope, visibleOwnerIds } from "@/lib/access";
import { transitionFutureLeases } from "@/lib/leaseTransition";

export const dynamic = "force-dynamic";

export default async function PropertiesPage() {
  const me = await requireUser();
  // Promote any future tenancy whose previous lease is up so the table always
  // reflects current tenancies (idempotent; the daily cron does this too).
  await transitionFutureLeases();
  const scope = await propertyScope(me);
  // The owner dropdown is scoped to owners the logged-in manager is tied to
  // (created or assigned); Administrators see all registered owners.
  const ownerScope = await visibleOwnerIds(me);
  const [properties, owners] = await Promise.all([
    prisma.property.findMany({
      where: { deletedAt: null, ...scope },
      include: {
        owners: { include: { owner: true } },
        leases: {
          where: { status: { in: ["ACTIVE", "PENDING", "EXPIRED", "TERMINATED"] } },
          include: { tenant: true },
          orderBy: { startDate: "desc" },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.owner.findMany({
      where: { deletedAt: null, ...(ownerScope ? { id: { in: ownerScope } } : {}) },
      orderBy: { name: "asc" },
    }),
  ]);

  const serialized = properties.map((p) => {
    const lease = p.leases.find((l) => l.status === "ACTIVE") ?? null;
    const futureLease = p.leases.find((l) => l.status === "PENDING") ?? null;
    return {
      id: p.id,
      name: p.name,
      type: p.type,
      address: p.address,
      location: p.location,
      status: p.status,
      rent: p.rent,
      remarks: p.remarks,
      isOwnStay: p.isOwnStay,
      unitTags: p.unitTags,
      utilityDeposit: p.utilityDeposit,
      nextCheckInDate: p.nextCheckInDate?.toISOString() ?? null,
      rentStartDate: p.rentStartDate?.toISOString() ?? null,
      rentGraceDays: p.rentGraceDays,
      soldDate: p.soldDate?.toISOString() ?? null,
      owners: p.owners.map((o) => ({
        ownerId: o.ownerId,
        name: o.owner.name,
        phone: o.owner.phone,
        icNumber: o.owner.icNumber,
        sharePercent: o.sharePercent,
      })),
      tenant: lease?.tenant ?? null,
      monthlyRent: lease?.monthlyRent ?? null,
      lease: lease
        ? {
            id: lease.id,
            tenantId: lease.tenantId,
            tenantName: lease.tenant.name,
            tenantPhone: lease.tenant.phone,
            monthlyRent: lease.monthlyRent,
            deposit: lease.deposit,
            startDate: lease.startDate.toISOString(),
            endDate: lease.endDate?.toISOString() ?? null,
            stampingRef: lease.stampingRef,
            checkoutNotified: lease.checkoutNotified,
            checkoutDate: lease.checkoutDate?.toISOString() ?? null,
            leaseEndRemarks: lease.leaseEndRemarks,
          }
        : null,
      futureLease: futureLease
        ? {
            id: futureLease.id,
            tenantName: futureLease.tenant.name,
            tenantPhone: futureLease.tenant.phone,
            monthlyRent: futureLease.monthlyRent,
            deposit: futureLease.deposit,
            utilityDeposit: futureLease.utilityDeposit,
            unitTags: futureLease.unitTags,
            startDate: futureLease.startDate.toISOString(),
            endDate: futureLease.endDate?.toISOString() ?? null,
          }
        : null,
      archivedLeases: p.leases
        .filter((l) => l.status === "EXPIRED" || l.status === "TERMINATED")
        .map((l) => ({
          id: l.id,
          tenantName: l.tenant.name,
          tenantPhone: l.tenant.phone,
          monthlyRent: l.monthlyRent,
          deposit: l.deposit,
          startDate: l.startDate.toISOString(),
          endDate: l.endDate?.toISOString() ?? null,
          status: l.status,
          stampedAt: l.stampedAt?.toISOString() ?? null,
          stampingRef: l.stampingRef,
        })),
    };
  });

  return (
    <PropertiesClient
      properties={serialized}
      owners={owners.map((o) => ({ id: o.id, name: o.name, phone: o.phone }))}
    />
  );
}
