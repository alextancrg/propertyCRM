import { prisma } from "./prisma";
import { BillStatus, Lease, Tenant, Property, type Prisma } from "@prisma/client";
import { logAudit } from "./ai";
import { formatMYR } from "./format";
import { getAuthorizedTenantIds, dispatchWhatsAppMessage } from "./whatsapp";
import type { SessionUser } from "./access";

type LeaseWithRelations = Lease & {
  tenant: Tenant;
  property: Property;
  rentPayments: { month: string; status: BillStatus }[];
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function daysDiff(a: Date, b: Date): number {
  return Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / 86_400_000);
}

function safeDay(year: number, month: number, day: number): number {
  const last = new Date(year, month + 1, 0).getDate();
  return Math.min(day, last);
}

/**
 * Build the reminder message for a given stage.
 */
export function buildReminderMessage(
  lease: LeaseWithRelations,
  stage: string,
  dueDate: Date,
): string {
  const { property, tenant } = lease;
  const amount = formatMYR(lease.monthlyRent);
  const due = dueDate.toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" });
  const unit = property.name;

  switch (stage) {
    case "D-3":
      return `Dear ${tenant.name}, this is a friendly reminder from the property management office. Your rent of ${amount} for ${unit} is due in 3 days (${due}). Kindly arrange payment before the due date. Thank you.`;
    case "D+1":
      return `Dear ${tenant.name}, a gentle reminder that your rent of ${amount} for ${unit} is now 1 day overdue (was due ${due}). Please settle at your earliest convenience to avoid late charges.`;
    case "D+3":
      return `Dear ${tenant.name}, this is a final reminder that your rent of ${amount} for ${unit} is 3 days overdue (was due ${due}). Please settle the outstanding amount immediately.`;
    case "ESCALATED":
      return `🚨 RENT OVERDUE — ${unit} | Tenant: ${tenant.name} (${tenant.phone ?? "no phone on file"}) | Amount: ${amount} | Due: ${due} | Automatic reminders have been exhausted. Immediate follow-up required.`;
    default:
      return "";
  }
}

/**
 * Runs the scheduled rent-reminder engine for the current month.
 *
 * Based on each active lease's rent due date (derived from the property's
 * rent collection start date), it sends:
 *   - D-3  : 3 days before the due date
 *   - D+1  : 1 day after the due date
 *   - D+3  : 3 days after the due date
 * Once the reminder windows are exhausted and the tenant is still unpaid,
 * it raises a self-WhatsApp escalation (red highlighted, with the unit name
 * and the tenant's phone number).
 *
 * When a Property Manager is passed, only their authorized tenants are
 * contacted and every message counts against the plan's monthly WhatsApp
 * quota. When run as a cron (no user), all active leases are considered and
 * no quota is enforced.
 *
 * Reminders are deduplicated per lease + month + stage, so running this
 * daily is safe. Returns a summary of what was sent.
 */
export async function runRentReminders(
  now = new Date(),
  user?: SessionUser,
): Promise<{ reminders: number; escalated: number; skipped: number }> {
  const where: Prisma.LeaseWhereInput = { status: "ACTIVE" };
  if (user) {
    const authorized = await getAuthorizedTenantIds(user);
    where.tenantId = { in: authorized };
  }

  const leases = await prisma.lease.findMany({
    where,
    include: {
      tenant: true,
      property: true,
      rentPayments: { select: { month: true, status: true } },
    },
  });

  // For quota-free cron/system runs use an Administrator actor (unlimited).
  const actor: SessionUser =
    user ?? { id: "system", name: "System", email: "system@goassethub.com", role: "Administrator" };
  const managerPhone = user
    ? (await prisma.user.findUnique({ where: { id: user.id }, select: { phone: true } }))?.phone ?? null
    : null;

  const key = monthKey(now);
  const today = startOfDay(now);
  let reminders = 0;
  let escalated = 0;
  let skipped = 0;

  for (const lease of leases) {
    // Only consider leases covering this month.
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    if (monthEnd < lease.startDate || (lease.endDate && monthStart > lease.endDate)) {
      skipped++;
      continue;
    }

    // Skip if the tenant has already paid for this month.
    const paid = lease.rentPayments.some((p) => p.month === key && p.status === BillStatus.PAID);
    if (paid) {
      skipped++;
      continue;
    }

    // Rent due date = same day-of-month as the property's rent collection
    // start date (fallback: lease start date, then the 1st).
    const dueDay =
      lease.property.rentStartDate?.getDate() ?? lease.startDate.getDate() ?? 1;
    const dueDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      safeDay(now.getFullYear(), now.getMonth(), dueDay),
    );

    const diff = daysDiff(today, dueDate);

    let stage: string | null = null;
    if (diff === -3) stage = "D-3";
    else if (diff === 1) stage = "D+1";
    else if (diff === 3) stage = "D+3";
    else if (diff >= 6) stage = "ESCALATED";

    if (!stage) {
      skipped++;
      continue;
    }

    const already = await prisma.rentReminder.findFirst({
      where: { leaseId: lease.id, month: key, stage },
    });
    if (already) {
      skipped++;
      continue;
    }

    const message = buildReminderMessage(lease, stage, dueDate);
    const isEscalation = stage === "ESCALATED";

    await prisma.rentReminder.create({
      data: {
        leaseId: lease.id,
        month: key,
        stage,
        message,
        dueDate,
        self: isEscalation,
      },
    });

    if (isEscalation) {
      // Self-WhatsApp alert to the property manager (quota-checked + logged).
      await dispatchWhatsAppMessage({
        user: actor,
        propertyId: lease.propertyId,
        tenantId: lease.tenantId,
        tenantName: lease.tenant.name,
        propertyName: lease.property.name,
        phone: managerPhone,
        action: "SELF_ALERT",
        body: message,
        now,
      });
      await logAudit(
        "RentReminder",
        "ESCALATED",
        `Rent overdue — self WhatsApp alert: ${lease.property.name}, tenant ${lease.tenant.name} (${lease.tenant.phone ?? "n/a"}).`,
        lease.propertyId,
        user?.id,
      );
      escalated++;
    } else {
      const result = await dispatchWhatsAppMessage({
        user: actor,
        propertyId: lease.propertyId,
        tenantId: lease.tenantId,
        tenantName: lease.tenant.name,
        propertyName: lease.property.name,
        phone: lease.tenant.phone,
        action: "RENT_REMINDER",
        body: message,
        now,
      });
      await logAudit(
        "RentReminder",
        "SENT",
        `${stage} reminder for ${lease.property.name} — ${lease.tenant.name} (${lease.tenant.phone ?? "no phone"})${result.reason ? ` · ${result.reason}` : ""}.`,
        lease.propertyId,
        user?.id,
      );
      reminders++;
    }
  }

  return { reminders, escalated, skipped };
}
