import { prisma } from "@/lib/prisma";
import { PropertiesClient } from "@/components/properties/PropertiesClient";
import { requireUser } from "@/lib/auth";
import { propertyScope, visibleOwnerIds } from "@/lib/access";

export const dynamic = "force-dynamic";

export default async function PropertiesPage() {
  const me = await requireUser();
  const scope = await propertyScope(me);
  // The owner dropdown is scoped to owners the logged-in manager is tied to
  // (created or assigned); Administrators see all registered owners.
  const ownerScope = await visibleOwnerIds(me);
  const [properties, owners] = await Promise.all([
    prisma.property.findMany({
      where: { deletedAt: null, ...scope },
      include: {
        owners: { include: { owner: true } },
        leases: { where: { status: "ACTIVE" }, include: { tenant: true }, orderBy: { startDate: "desc" } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.owner.findMany({
      where: { deletedAt: null, ...(ownerScope ? { id: { in: ownerScope } } : {}) },
      orderBy: { name: "asc" },
    }),
  ]);

  const serialized = properties.map((p) => {
    const lease = p.leases[0] ?? null;
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
      unitName: p.unitName,
      unitTags: p.unitTags,
      utilityDeposit: p.utilityDeposit,
      meterMode: p.meterMode,
      meterRate: p.meterRate,
      template: p.template,
      nextCheckInDate: p.nextCheckInDate?.toISOString() ?? null,
      rentStartDate: p.rentStartDate?.toISOString() ?? null,
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
    };
  });

  return (
    <PropertiesClient
      properties={serialized}
      owners={owners.map((o) => ({ id: o.id, name: o.name, phone: o.phone }))}
    />
  );
}
