export const BILL_SCHEDULES = [
  "Monthly",
  "Quarterly",
  "Half-Yearly",
  "Annually",
  "One Off",
] as const;

export type BillSchedule = (typeof BILL_SCHEDULES)[number];

// Bill type options shown in the configure-bill form.
export const BILL_TYPES = [
  "Electricity",
  "Water",
  "Sewerage",
  "Management Fee",
  "Quit Rent",
  "Assessment Tax",
  "Repairs & Renovation",
  "Fire Insurance",
  "Miscellaneous",
] as const;

// How many due dates each schedule requires within a billing year.
export const SCHEDULE_DATE_COUNTS: Record<BillSchedule, number> = {
  Monthly: 1, // one due day, applied to each month
  Quarterly: 4,
  "Half-Yearly": 2,
  Annually: 1,
  "One Off": 1, // a single one-time due date
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function safeDay(year: number, month: number, day: number): number {
  return Math.min(day, new Date(year, month + 1, 0).getDate());
}

function parseDate(s: string): Date {
  return new Date(`${s}T00:00:00`);
}

/**
 * Generate the per-cycle payment schedule for a billing year from the
 * schedule type and the due-date pattern (array of "YYYY-MM-DD").
 *
 *  - Monthly    : 12 cycles (one per month), using the day-of-month from the pattern
 *  - Quarterly  : 4 cycles (Q1–Q4)
 *  - Half-Yearly: 2 cycles (H1, H2)
 *  - Annually   : 1 cycle
 *  - One Off    : 1 single one-time cycle (e.g. renovation / maintenance)
 */
export function generateBillCycles(
  schedule: BillSchedule,
  pattern: string[],
  year: number,
): { cycle: string; dueDate: Date }[] {
  switch (schedule) {
    case "Monthly": {
      const day = pattern.length ? parseDate(pattern[0]).getDate() : 1;
      return Array.from({ length: 12 }, (_, m) => ({
        cycle: `${MONTHS[m]} ${year}`,
        dueDate: new Date(year, m, safeDay(year, m, day)),
      }));
    }
    case "Quarterly": {
      const labels = ["Q1", "Q2", "Q3", "Q4"];
      return labels.map((label, i) => {
        const d = pattern[i] ? parseDate(pattern[i]) : new Date(year, i * 3, 1);
        return { cycle: `${label} ${year}`, dueDate: d };
      });
    }
    case "Half-Yearly": {
      const labels = ["H1", "H2"];
      return labels.map((label, i) => {
        const d = pattern[i] ? parseDate(pattern[i]) : new Date(year, i * 6, 1);
        return { cycle: `${label} ${year}`, dueDate: d };
      });
    }
    case "One Off": {
      const d = pattern.length ? parseDate(pattern[0]) : new Date(year, 0, 1);
      return [{ cycle: "One-Off", dueDate: d }];
    }
    case "Annually":
    default: {
      const d = pattern.length ? parseDate(pattern[0]) : new Date(year, 0, 1);
      return [{ cycle: String(year), dueDate: d }];
    }
  }
}

/**
 * Validate that the provided due-date pattern matches the schedule's expected
 * date count. Returns an error message or null when valid.
 */
export function validateDueDates(
  schedule: string,
  dueDates: string[],
): string | null {
  const count = SCHEDULE_DATE_COUNTS[schedule as BillSchedule];
  if (count === undefined) {
    return `Unsupported schedule: ${schedule}. Use Monthly, Quarterly, Half-Yearly, Annually or One Off.`;
  }
  const valid = dueDates.every((d) => !Number.isNaN(Date.parse(d)));
  if (!valid) return "Each due date must be a valid date.";
  if (dueDates.length !== count) {
    return `${schedule} bills require ${count} due date${count === 1 ? "" : "s"} (${count} date picker${count === 1 ? "" : "s"}).`;
  }
  return null;
}

export const BILL_MAX_REMARKS = 300;

// Maximum number of receipts (PDFs/images) a bill payment can hold. At least 1
// is mandatory when marking a payment as Paid; up to this many are allowed.
export const BILL_RECEIPT_MAX = 4;

// Number of months each schedule cycle covers — used to derive the tenant
// prepayment for the total sewerage over the whole lease tenure.
export const SCHEDULE_MONTHS: Record<BillSchedule, number> = {
  Monthly: 1,
  Quarterly: 3,
  "Half-Yearly": 6,
  Annually: 12,
  "One Off": 12,
};

/** Whole calendar months between a start and an end date (or today). */
export function monthsBetween(start: Date, end: Date | null, now = new Date()): number {
  const e = end ?? now;
  if (e <= start) return 0;
  return (
    (e.getFullYear() - start.getFullYear()) * 12 +
    (e.getMonth() - start.getMonth())
  );
}

/**
 * Compute the tenant prepayment for the total sewerage over the entire lease
 * tenure. Uses the fixed per-cycle amount × the number of cycles the lease
 * covers. Open-ended leases are computed up to the billing year's year-end
 * (a note explains the tenant should top up when the lease is renewed/ends).
 * Returns null when it cannot be computed (no fixed amount / no lease).
 */
export function seweragePrepaySummary(opts: {
  fixedAmount: number;
  schedule: BillSchedule;
  leaseStart: string | null;
  leaseEnd: string | null;
  billingYear: number;
  now?: Date;
}): { total: number; note: string } | null {
  const { fixedAmount, schedule, leaseStart, leaseEnd, billingYear, now } = opts;
  if (!fixedAmount || fixedAmount <= 0 || !leaseStart) return null;
  const start = new Date(leaseStart);
  const end = leaseEnd ? new Date(leaseEnd) : new Date(billingYear, 11, 31);
  const months = monthsBetween(start, end, now);
  const interval = SCHEDULE_MONTHS[schedule] ?? 1;
  const cycles = Math.max(1, Math.ceil(months / interval));
  const total = Math.round(fixedAmount * cycles * 100) / 100;
  const fmt = (d: Date) => `${MONTHS[d.getMonth()] ?? d.getMonth() + 1} ${d.getFullYear()}`;
  const span = leaseEnd
    ? `${fmt(start)} → ${fmt(end)}`
    : `${fmt(start)} → open-ended (to ${billingYear} year-end)`;
  return {
    total,
    note: `${cycles} × ${schedule} cycle(s) — ${span}. Tenant prepays the total sewerage for the whole lease tenure.`,
  };
}
