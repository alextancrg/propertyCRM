import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/ai";
import { getSessionUser } from "@/lib/auth";
import { BillStatus } from "@prisma/client";
import {
  BILL_SCHEDULES,
  BILL_MAX_REMARKS,
  generateBillCycles,
  validateDueDates,
  type BillSchedule,
} from "@/lib/bills";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const bill = await prisma.bill.findUnique({
    where: { id },
    include: { payments: { orderBy: { dueDate: "asc" } }, property: true },
  });
  if (!bill) return NextResponse.json({ error: "Bill not found." }, { status: 404 });
  return NextResponse.json({ bill });
}

// Update a bill's configuration (remarks, provider, schedule, due dates, etc.).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const existing = await prisma.bill.findUnique({
    where: { id },
    include: { payments: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Bill not found." }, { status: 404 });
  }

  const schedule: BillSchedule = BILL_SCHEDULES.includes(body.schedule)
    ? (body.schedule as BillSchedule)
    : (existing.schedule as BillSchedule);
  const dueDatesArr: string[] = Array.isArray(body.dueDates) ? body.dueDates : [];
  const year = body.year ? Number(body.year) : existing.year;

  // Only validate/regenerate cycles when the schedule or due dates were sent.
  const scheduleChanged =
    body.schedule !== undefined || body.dueDates !== undefined || body.year !== undefined;
  if (scheduleChanged) {
    const dueErr = validateDueDates(schedule, dueDatesArr);
    if (dueErr) {
      return NextResponse.json({ error: dueErr }, { status: 400 });
    }
  }

  if (typeof body.remarks === "string" && body.remarks.length > BILL_MAX_REMARKS) {
    return NextResponse.json(
      { error: `Remarks must be ${BILL_MAX_REMARKS} characters or fewer.` },
      { status: 400 },
    );
  }

  const fixed =
    body.amountType === "Fixed" && body.fixedAmount
      ? Number(body.fixedAmount)
      : body.amountType === "Variable"
        ? null
        : existing.fixedAmount;

  const bill = await prisma.bill.update({
    where: { id },
    data: {
      type: typeof body.type === "string" ? body.type : existing.type,
      provider: typeof body.provider === "string" ? body.provider : existing.provider,
      schedule,
      amountType: typeof body.amountType === "string" ? body.amountType : existing.amountType,
      fixedAmount: fixed,
      year,
      dueDates:
        body.dueDates !== undefined ? JSON.stringify(dueDatesArr) : existing.dueDates,
      remarks:
        body.remarks !== undefined
          ? body.remarks
            ? String(body.remarks).slice(0, BILL_MAX_REMARKS)
            : null
          : existing.remarks,
      tenantPrepaid:
        body.tenantPrepaid !== undefined ? Boolean(body.tenantPrepaid) : existing.tenantPrepaid,
      tenantPrepayAmount:
        body.tenantPrepayAmount !== undefined && body.tenantPrepayAmount !== null && body.tenantPrepayAmount !== ""
          ? Number(body.tenantPrepayAmount)
          : body.tenantPrepaid
            ? null
            : existing.tenantPrepayAmount,
      tenantPrepayNote:
        body.tenantPrepayNote !== undefined
          ? body.tenantPrepayNote
            ? String(body.tenantPrepayNote).slice(0, 500)
            : null
          : existing.tenantPrepayNote,
    },
  });

  // Regenerate unpaid cycles when the schedule/dates changed, but never
  // destroy PAID cycles (they carry receipts used for tax & audit).
  if (scheduleChanged) {
    const hasPaid = existing.payments.some((p) => p.status === BillStatus.PAID);
    if (!hasPaid) {
      await prisma.billPayment.deleteMany({ where: { billId: id } });
      const cycles = generateBillCycles(schedule, dueDatesArr, year);
      await prisma.billPayment.createMany({
        data: cycles.map((c) => ({
          billId: id,
          cycle: c.cycle,
          dueDate: c.dueDate,
          amount: fixed ?? 0,
          status: BillStatus.UNPAID,
        })),
      });
    }
  }

  await logAudit("Bill", "UPDATED", `Bill updated: ${bill.type} (${bill.provider}).`, bill.propertyId, me.id);
  return NextResponse.json({ ok: true, bill });
}
