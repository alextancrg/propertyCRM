import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/ai";
import { getSessionUser } from "@/lib/auth";
import { BillStatus } from "@prisma/client";
import { visiblePropertyIds } from "@/lib/access";
import {
  BILL_SCHEDULES,
  BILL_MAX_REMARKS,
  generateBillCycles,
  validateDueDates,
} from "@/lib/bills";

export const dynamic = "force-dynamic";

// Create a recurring bill for a property. The due-date pattern (from the
// calendar pickers) determines the per-cycle payments generated for the year.
export async function POST(req: NextRequest) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { propertyId, type, provider, schedule, amountType, fixedAmount, dueDates, remarks, year } = body;

  if (!propertyId || !type || !provider) {
    return NextResponse.json({ error: "propertyId, type, provider are required." }, { status: 400 });
  }

  const property = await prisma.property.findFirst({
    where: { id: propertyId, deletedAt: null },
  });
  if (!property) {
    return NextResponse.json({ error: "Property not found." }, { status: 404 });
  }

  // Property managers may only configure bills for properties they can see.
  if (me.role !== "Administrator") {
    const visible = await visiblePropertyIds(me);
    if (!visible || !visible.includes(propertyId)) {
      return NextResponse.json({ error: "You do not have access to this property." }, { status: 403 });
    }
  }

  const sched = BILL_SCHEDULES.includes(schedule) ? schedule : "Monthly";

  // Sold properties keep no recurring bills — only one-off bills.
  if (property.status === "SOLD" && sched !== "One Off") {
    return NextResponse.json(
      {
        error:
          "Sold properties can only have one-off bills — recurring bills are switched to the next owner.",
      },
      { status: 400 },
    );
  }

  const dueDatesArr: string[] = Array.isArray(dueDates) ? dueDates : [];
  const dueErr = validateDueDates(sched, dueDatesArr);
  if (dueErr) {
    return NextResponse.json({ error: dueErr }, { status: 400 });
  }
  if (typeof remarks === "string" && remarks.length > BILL_MAX_REMARKS) {
    return NextResponse.json(
      { error: `Remarks must be ${BILL_MAX_REMARKS} characters or fewer.` },
      { status: 400 },
    );
  }

  const billYear = year ? Number(year) : new Date().getFullYear();
  const fixed = amountType === "Fixed" && fixedAmount ? Number(fixedAmount) : null;
  const cycles = generateBillCycles(sched, dueDatesArr, billYear);

  const bill = await prisma.bill.create({
    data: {
      propertyId,
      type,
      provider,
      schedule: sched,
      amountType: amountType ?? "Variable",
      fixedAmount: fixed,
      year: billYear,
      dueDates: JSON.stringify(dueDatesArr),
      remarks: remarks ? String(remarks).slice(0, BILL_MAX_REMARKS) : null,
      tenantPrepaid: Boolean(body.tenantPrepaid),
      tenantPrepayAmount:
        body.tenantPrepayAmount !== undefined && body.tenantPrepayAmount !== null && body.tenantPrepayAmount !== ""
          ? Number(body.tenantPrepayAmount)
          : null,
      tenantPrepayNote:
        typeof body.tenantPrepayNote === "string" && body.tenantPrepayNote.trim()
          ? body.tenantPrepayNote.trim().slice(0, 500)
          : null,
      payments: {
        create: cycles.map((c) => ({
          cycle: c.cycle,
          dueDate: c.dueDate,
          amount: fixed ?? 0,
          status: BillStatus.UNPAID,
        })),
      },
    },
  });

  await logAudit(
    "Bill",
    "CREATED",
    `Recurring bill configured: ${type} (${provider}) — ${sched} for ${billYear} (${cycles.length} cycles).`,
    propertyId,
    me.id,
  );
  return NextResponse.json({ ok: true, bill });
}
