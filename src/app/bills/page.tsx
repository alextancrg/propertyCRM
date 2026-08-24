import { prisma } from "@/lib/prisma";
import { BillsClient } from "@/components/bills/BillsClient";
import { requireUser } from "@/lib/auth";
import { propertyScope } from "@/lib/access";

export const dynamic = "force-dynamic";

export default async function BillsPage() {
  const me = await requireUser();
  const scope = await propertyScope(me);
  const properties = await prisma.property.findMany({
    where: { deletedAt: null, ...scope },
    include: {
      bills: {
        include: { payments: { include: { receipts: true }, orderBy: { createdAt: "desc" } } },
        orderBy: { type: "asc" },
      },
      owners: { include: { owner: true } },
      leases: {
        where: { status: "ACTIVE" },
        select: { id: true, startDate: true, endDate: true, monthlyRent: true },
        orderBy: { startDate: "desc" },
      },
    },
    orderBy: { name: "asc" },
  });

  const serialized = properties.map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type,
    status: p.status,
    owners: p.owners.map((o) => o.owner.name).join(", "),
    activeLease: p.leases[0]
      ? {
          id: p.leases[0].id,
          startDate: p.leases[0].startDate.toISOString(),
          endDate: p.leases[0].endDate?.toISOString() ?? null,
          monthlyRent: p.leases[0].monthlyRent,
        }
      : null,
    bills: p.bills.map((b) => ({
      id: b.id,
      type: b.type,
      provider: b.provider,
      schedule: b.schedule,
      amountType: b.amountType,
      fixedAmount: b.fixedAmount,
      year: b.year,
      dueDates: (() => {
        try {
          return JSON.parse(b.dueDates ?? "[]") as string[];
        } catch {
          return [];
        }
      })(),
      remarks: b.remarks,
      tenantPrepaid: b.tenantPrepaid,
      tenantPrepayAmount: b.tenantPrepayAmount,
      tenantPrepayNote: b.tenantPrepayNote,
      payments: b.payments.map((payment) => ({
        id: payment.id,
        cycle: payment.cycle,
        dueDate: payment.dueDate?.toISOString() ?? null,
        amount: payment.amount,
        status: payment.status,
        paidAt: payment.paidAt?.toISOString() ?? null,
        receiptUrl: payment.receiptUrl,
        receipts: payment.receipts.map((r) => ({
          id: r.id,
          fileName: r.fileName,
          mimeType: r.mimeType,
          size: r.size,
        })),
        remarks: payment.remarks,
      })),
    })),
  }));

  return <BillsClient properties={serialized} />;
}
