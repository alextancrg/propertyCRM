import { prisma } from "@/lib/prisma";
import { DocumentsClient } from "@/components/documents/DocumentsClient";
import { requireUser } from "@/lib/auth";
import { propertyScope, visiblePropertyIds } from "@/lib/access";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const me = await requireUser();
  const scope = await propertyScope(me);
  const propIds = await visiblePropertyIds(me);

  const [documents, properties, tenants] = await Promise.all([
    prisma.document.findMany({
      where:
        me.role === "Administrator"
          ? { OR: [{ propertyId: null }, { property: { deletedAt: null } }] }
          : { OR: [{ propertyId: null }, { propertyId: { in: propIds ?? [] } }] },
      include: { property: true, tenant: true },
      orderBy: { uploadedAt: "desc" },
    }),
    // Properties carry their active lease (tenant + tenure) so the upload form
    // auto-fills tenant / lease dates straight from Properties & Leases.
    prisma.property.findMany({
      where: { deletedAt: null, ...scope },
      include: { leases: { where: { status: "ACTIVE" }, include: { tenant: true }, orderBy: { startDate: "desc" } } },
      orderBy: { name: "asc" },
    }),
    prisma.tenant.findMany({
      // Tenant dropdown is scoped: PMs only see tenants leased on properties
      // owned by the owners assigned to them; Administrators see all tenants.
      where:
        me.role === "Administrator"
          ? undefined
          : { leases: { some: { propertyId: { in: propIds ?? [] } } } },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <DocumentsClient
      documents={documents.map((d) => ({
        id: d.id,
        title: d.title,
        category: d.category,
        isStamped: d.isStamped,
        fileUrl: d.fileUrl,
        // A document holds up to 2 attachments — the 2nd downloads via ?slot=2.
        file2Url: d.fileData2 ? `/api/uploads/document/${d.id}?slot=2` : null,
        year: d.year ?? d.uploadedAt.getFullYear(),
        // Lease tenure drives the year search. Dates are serialized as
        // "YYYY-MM-DD" (date-only) to avoid timezone shifts.
        leaseFrom: d.leaseFrom ? d.leaseFrom.toISOString().slice(0, 10) : null,
        leaseTo: d.leaseTo ? d.leaseTo.toISOString().slice(0, 10) : null,
        uploadedAt: d.uploadedAt.toISOString(),
        propertyId: d.propertyId,
        property: d.property?.name ?? null,
        tenantId: d.tenantId,
        tenant: d.tenant?.name ?? null,
      }))}
      properties={properties.map((p) => {
        const lease = p.leases[0] ?? null;
        return {
          id: p.id,
          name: p.name,
          activeLease: lease
            ? {
                tenantId: lease.tenantId,
                tenantName: lease.tenant.name,
                startDate: lease.startDate.toISOString().slice(0, 10),
                endDate: lease.endDate ? lease.endDate.toISOString().slice(0, 10) : null,
              }
            : null,
        };
      })}
      tenants={tenants.map((t) => ({ id: t.id, name: t.name }))}
    />
  );
}
