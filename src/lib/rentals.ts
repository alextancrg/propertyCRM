import { prisma } from "./prisma";
import { BillStatus } from "@prisma/client";
import { visiblePropertyIds, type SessionUser } from "./access";

export type RentalPaymentDTO = {
  id: string;
  month: string; // "2026-08"
  label: string; // "Aug 2026"
  dueDate: string; // due date for this month, derived from the lease start day
  graceDays: number; // this property's grace period (days) after the due date
  amount: number;
  status: string;
  paidAt: string | null;
  receiptUrl: string | null;
  remarks: string | null;
  overridden: boolean;
};

export type RentalCollectionItem = {
  id: string; // lease id
  propertyId: string;
  propertyName: string;
  propertyType: string;
  tenantName: string;
  tenantPhone: string | null;
  monthlyRent: number;
  leaseStart: string;
  leaseEnd: string | null;
  payments: RentalPaymentDTO[];
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return month;
  return `${MONTHS[m - 1] ?? m} ${y}`;
}

/**
 * The due date for a given month key, using the lease's start day-of-month
 * (e.g. a lease starting on the 8th makes rent due on the 8th of every month).
 * The day is clamped to the last valid day of the month (e.g. 31 -> Feb 28).
 */
export function dueDateForMonth(month: string, leaseStart: Date): Date {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return new Date(leaseStart);
  const day = Math.min(leaseStart.getDate(), new Date(y, m, 0).getDate());
  return new Date(y, m - 1, day);
}

/** Number of days of grace before an unpaid month is treated as overdue. */
export const RENT_GRACE_DAYS = 7;

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * The list of month keys a lease covers, from its start date up to the earlier
 * of its end date / the current month. This drives the rental collection.
 */
export function leaseMonthKeys(
  lease: { startDate: Date; endDate: Date | null },
  now = new Date(),
): string[] {
  const start = lease.startDate;
  const rawEnd = lease.endDate ?? now;
  // Never generate future months.
  const end = rawEnd > now ? now : rawEnd;
  const keys: string[] = [];
  let y = start.getFullYear();
  let m = start.getMonth();
  const lastY = end.getFullYear();
  const lastM = end.getMonth();
  let guard = 0;
  while ((y < lastY || (y === lastY && m <= lastM)) && guard < 2400) {
    keys.push(`${y}-${String(m + 1).padStart(2, "0")}`);
    m += 1;
    if (m === 12) {
      m = 0;
      y += 1;
    }
    guard += 1;
  }
  return keys;
}

/**
 * Idempotently create a RentPayment row for every covered lease month that
 * doesn't already have one. Called automatically when the Rental Collection is
 * viewed so records reflect each lease's start (leased) date.
 */
export async function ensureRentPayments(
  leases: { id: string; monthlyRent: number; startDate: Date; endDate: Date | null }[],
  now = new Date(),
): Promise<number> {
  let created = 0;
  for (const lease of leases) {
    const existing = await prisma.rentPayment.findMany({
      where: { leaseId: lease.id },
      select: { month: true },
    });
    const have = new Set(existing.map((p) => p.month));
    for (const k of leaseMonthKeys(lease, now)) {
      if (have.has(k)) continue;
      await prisma.rentPayment.create({
        data: {
          leaseId: lease.id,
          month: k,
          amount: lease.monthlyRent,
          status: BillStatus.UNPAID,
        },
      });
      created += 1;
    }
  }
  return created;
}

/**
 * Build the scoped rental collection for the logged-in user. For every active
 * lease on a visible property, monthly rental records are ensured to exist
 * from the lease's start date through the current month.
 */
export async function buildRentalCollection(
  user: SessionUser,
  now = new Date(),
): Promise<RentalCollectionItem[]> {
  const scope = await visiblePropertyIds(user); // null = all (Administrator)
  const leases = await prisma.lease.findMany({
    where: {
      status: "ACTIVE",
      // Own-stay units have no tenants/rental collection.
      property: { deletedAt: null, isOwnStay: false, ...(scope ? { id: { in: scope } } : {}) },
    },
    include: { property: true, tenant: true, rentPayments: true },
    // Reverse chronology — the latest lease/rent activity first.
    orderBy: { startDate: "desc" },
  });

  await ensureRentPayments(leases, now);

  const fresh = await prisma.lease.findMany({
    where: { id: { in: leases.map((l) => l.id) } },
    include: {
      property: true,
      tenant: true,
      // Reverse chronology — the most recent month at the top.
      rentPayments: { orderBy: { month: "desc" } },
    },
  });

  return fresh.map((lease) => ({
    id: lease.id,
    propertyId: lease.propertyId,
    propertyName: lease.property.name,
    propertyType: lease.property.type,
    tenantName: lease.tenant.name,
    tenantPhone: lease.tenant.phone,
    monthlyRent: lease.monthlyRent,
    leaseStart: lease.startDate.toISOString(),
    leaseEnd: lease.endDate?.toISOString() ?? null,
    payments: lease.rentPayments.map((p) => ({
      id: p.id,
      month: p.month,
      label: monthLabel(p.month),
      dueDate: dueDateForMonth(p.month, lease.startDate).toISOString(),
      graceDays: lease.property.rentGraceDays,
      amount: p.amount,
      status: p.status,
      paidAt: p.paidAt?.toISOString() ?? null,
      receiptUrl: p.receiptUrl,
      remarks: p.remarks,
      overridden: Boolean(p.overrideById),
    })),
  }));
}
