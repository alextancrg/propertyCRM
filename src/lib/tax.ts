import { prisma } from "./prisma";
import { BillStatus } from "@prisma/client";

export type ExpenseItem = { id: string; category: string; description: string; amount: number };

export type TaxProperty = {
  id: string;
  name: string;
  sharePercent: number;
  gross: number;
  expenses: number;
  net: number;
  share: number;
  hasIncome: boolean;
  expenseItems: ExpenseItem[];
  receipts: { id: string; label: string; url: string | null; paidAt: string | null }[];
};

export type OwnerYear = { year: number; totalNet: number; properties: TaxProperty[] };

export type OwnerStatement = { id: string; name: string; icNumber: string | null; years: OwnerYear[] };

/** All years that carry any tax-relevant data (income, receipts, expenses, collected rent). */
export async function buildTaxYears(): Promise<number[]> {
  const set = new Set<number>([new Date().getFullYear()]);
  const [income, bills, expenses, rentPayments] = await Promise.all([
    prisma.annualIncome.findMany({ distinct: ["year"], select: { year: true } }),
    prisma.billPayment.findMany({
      where: { receiptUrl: { not: null } },
      select: { dueDate: true, paidAt: true },
    }),
    prisma.expense.findMany({ select: { incurredAt: true } }),
    prisma.rentPayment.findMany({
      where: { status: BillStatus.PAID },
      select: { month: true },
    }),
  ]);
  income.forEach((x) => set.add(x.year));
  bills.forEach((b) => {
    const y = b.paidAt ?? b.dueDate;
    if (y) set.add(y.getFullYear());
  });
  expenses.forEach((e) => set.add(e.incurredAt.getFullYear()));
  rentPayments.forEach((r) => {
    const y = Number(r.month.slice(0, 4));
    if (y) set.add(y);
  });
  return Array.from(set).sort((a, b) => b - a);
}

/** Build the per-owner, per-year rental income statements used by Tax & Audit. */
export async function buildOwnerStatements(
  scopeOwnerIds?: string[] | null,
): Promise<OwnerStatement[]> {
  const years = await buildTaxYears();
  const owners = await prisma.owner.findMany({
    where: {
      deletedAt: null,
      ...(scopeOwnerIds ? { id: { in: scopeOwnerIds } } : {}),
    },
    include: {
      properties: {
        where: { property: { deletedAt: null } },
        include: {
          property: {
            include: {
              annualIncomes: true,
              expenses: true,
              bills: { include: { payments: true } },
              leases: { include: { rentPayments: true } },
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return owners.map((owner) => ({
    id: owner.id,
    name: owner.name,
    icNumber: owner.icNumber,
    years: years.map((year) => {
      let totalNet = 0;
      const properties = owner.properties.map((po) => {
        const p = po.property;
        const income = p.annualIncomes.find((a) => a.year === year);
        // Gross rental collection from the Rental Collection — the sum of rent
        // marked as collected (PAID) in this tax year. A manual correction
        // (AnnualIncome.grossAmount) overrides this when set.
        const grossCollected = p.leases
          .flatMap((l) => l.rentPayments)
          .filter((rp) => rp.status === BillStatus.PAID && rp.month.startsWith(`${year}-`))
          .reduce((s, rp) => s + rp.amount, 0);
        const expenseItems: ExpenseItem[] = p.expenses
          .filter((e) => e.incurredAt.getFullYear() === year)
          .map((e) => ({ id: e.id, category: e.category, description: e.description, amount: e.amount }));
        const expenses = expenseItems.reduce((s, e) => s + e.amount, 0);
        const gross = income?.grossAmount ?? grossCollected;
        const net = gross - expenses;
        const share = (net * po.sharePercent) / 100;
        totalNet += share;
        const receipts = p.bills.flatMap((b) =>
          b.payments
            .filter(
              (pay) => pay.receiptUrl && (pay.paidAt?.getFullYear() ?? pay.dueDate?.getFullYear()) === year,
            )
            .map((pay) => ({
              id: pay.id,
              label: `${b.type} — ${pay.cycle}`,
              url: pay.receiptUrl,
              paidAt: pay.paidAt?.toISOString() ?? null,
            })),
        );
        return {
          id: p.id,
          name: p.name,
          sharePercent: po.sharePercent,
          gross,
          expenses,
          net,
          share,
          hasIncome: Boolean(income) || grossCollected > 0,
          expenseItems,
          receipts,
        };
      });
      return { year, totalNet, properties };
    }),
  }));
}
