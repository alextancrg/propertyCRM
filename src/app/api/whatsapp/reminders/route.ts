import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runRentReminders } from "@/lib/reminders";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET — recent rent reminder / escalation activity.
export async function GET() {
  const reminders = await prisma.rentReminder.findMany({
    include: { lease: { include: { tenant: true, property: true } } },
    orderBy: { sentAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    reminders: reminders.map((r) => ({
      id: r.id,
      month: r.month,
      stage: r.stage,
      message: r.message,
      self: r.self,
      dueDate: r.dueDate?.toISOString() ?? null,
      sentAt: r.sentAt.toISOString(),
      property: r.lease.property.name,
      tenant: r.lease.tenant.name,
      phone: r.lease.tenant.phone,
    })),
  });
}

// POST — run the rent reminder engine now (also safe to schedule as a cron).
// When a manager is signed in, only their authorized tenants are contacted and
// their plan's monthly WhatsApp quota is enforced.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const now = body.date ? new Date(body.date) : new Date();
  const user = (await getSessionUser()) ?? undefined;
  const result = await runRentReminders(now, user);
  return NextResponse.json({ ok: true, ...result });
}
