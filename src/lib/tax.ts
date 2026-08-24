import { prisma } from "./prisma";
import { BillStatus } from "@prisma/client";

export type ExpenseItem = { id: string; category: string; description: string; amount: number };

export type TaxProperty = {
  id: string;
  name: string;
  sharePercent: number;
  gross: number;
  grossCollected: number;
  manualRent: number;
  expenses: number;
  billExpenses: number;
  net: number;
  share: number;
  hasIncome: boolean;
  expenseItems: ExpenseItem[];
  manualExpenseItems: ExpenseItem[];
  receipts: { id: string; label: string; url: string | null; paidAt: string | null }[];
};

export type OwnerYear = { year: number; totalNet: number; properties: TaxProperty[] };

export type OwnerStatement = { id: string; name: string; icNumber: string | null; years: OwnerYear[] };

/** All years that carry any tax-relevant data (income, receipts, expenses, collected rent). */
export async function buildTaxYears(): Promise<number[]> {
  const set = new Set<number>([new Date().getFullYear()]);
  const [income, bills, expenses, rentPayments] = await Promise.all([
    prisma.annualIncome.findMany({
      where: { property: { isOwnStay: false } },
      distinct: ["year"],
      select: { year: true },
    }),
    prisma.billPayment.findMany({
      where: { receiptUrl: { not: null }, bill: { property: { isOwnStay: false } } },
      select: { dueDate: true, paidAt: true },
    }),
    prisma.expense.findMany({
      where: { property: { isOwnStay: false } },
      select: { incurredAt: true },
    }),
    prisma.rentPayment.findMany({
      where: { status: BillStatus.PAID, lease: { property: { isOwnStay: false } } },
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
        // Own-stay units are excluded from Tax & Audit — their expenses cannot
        // offset rental income.
        where: { property: { deletedAt: null, isOwnStay: false } },
        include: {
          property: {
            include: {
              annualIncomes: true,
              expenses: true,
              bills: { include: { payments: { include: { receipts: true } } } },
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
        // marked as collected (PAID) in this tax year.
        const grossCollected = p.leases
          .flatMap((l) => l.rentPayments)
          .filter((rp) => rp.status === BillStatus.PAID && rp.month.startsWith(`${year}-`))
          .reduce((s, rp) => s + rp.amount, 0);
        // Manual additional rental collection (e.g. rent collected before the
        // lease started) — entered via the Edit button, added on top of the
        // auto-collected rent to form the gross rental collection.
        const manualRent = income?.manualRent ?? 0;
        // Expenses declared in Bills & Utilities: the owner-managed bills that
        // were actually settled (PAID) in this year.
        const billExpenseItems: ExpenseItem[] = p.bills.flatMap((b) =>
          b.payments
            .filter((pay) => pay.status === BillStatus.PAID)
            .filter((pay) => (pay.paidAt?.getFullYear() ?? pay.dueDate?.getFullYear()) === year)
            .map((pay) => ({
              id: `bill-${pay.id}`,
              category: b.type,
              description: `${b.type} (${b.provider}) — ${pay.cycle}`,
              amount: pay.amount,
            })),
        );
        const manualExpenseItems: ExpenseItem[] = p.expenses
          .filter((e) => e.incurredAt.getFullYear() === year)
          .map((e) => ({ id: e.id, category: e.category, description: e.description, amount: e.amount }));
        const expenseItems = [...billExpenseItems, ...manualExpenseItems];
        const expenses = expenseItems.reduce((s, e) => s + e.amount, 0);
        const billExpenses = billExpenseItems.reduce((s, e) => s + e.amount, 0);
        const gross = grossCollected + manualRent;
        const net = gross - expenses;
        const share = (net * po.sharePercent) / 100;
        totalNet += share;

        // Receipts attached to this year's bill payments (1–4 per payment).
        const receipts = p.bills.flatMap((b) =>
          b.payments.flatMap((pay) => {
            const inYear = (pay.paidAt?.getFullYear() ?? pay.dueDate?.getFullYear()) === year;
            if (!inYear) return [];
            const items = (pay.receipts ?? []).map((r) => ({
              id: r.id,
              label: `${b.type} — ${pay.cycle} (${r.fileName})`,
              url: `/api/uploads/bill-receipt/${r.id}`,
              paidAt: pay.paidAt?.toISOString() ?? null,
            }));
            // Legacy single receipt (no BillReceipt rows) is still listed.
            if (pay.receiptUrl && (pay.receipts ?? []).length === 0) {
              items.push({
                id: pay.id,
                label: `${b.type} — ${pay.cycle}`,
                url: pay.receiptUrl,
                paidAt: pay.paidAt?.toISOString() ?? null,
              });
            }
            return items;
          }),
        );

        return {
          id: p.id,
          name: p.name,
          sharePercent: po.sharePercent,
          gross,
          grossCollected,
          manualRent,
          expenses,
          billExpenses,
          net,
          share,
          hasIncome: Boolean(income) || grossCollected > 0 || manualRent > 0,
          expenseItems,
          manualExpenseItems,
          receipts,
        };
      });
      return { year, totalNet, properties };
    }),
  }));
}
