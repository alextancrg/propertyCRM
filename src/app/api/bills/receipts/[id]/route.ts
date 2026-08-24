import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/ai";
import { getSessionUser } from "@/lib/auth";
import { visiblePropertyIds } from "@/lib/access";

export const dynamic = "force-dynamic";

// Remove one receipt from a bill payment. A paid bill must keep at least one
// receipt on file, so deleting the last one is blocked.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { id } = await params;

  const receipt = await prisma.billReceipt.findUnique({
    where: { id },
    include: { payment: { include: { bill: { include: { property: true } }, receipts: true } } },
  });
  if (!receipt) {
    return NextResponse.json({ error: "Receipt not found." }, { status: 404 });
  }

  if (me.role !== "Administrator") {
    const visible = await visiblePropertyIds(me);
    if (!visible || !visible.includes(receipt.payment.bill.propertyId)) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }
  }

  // A paid payment must keep at least one receipt.
  if (receipt.payment.status === "PAID" && receipt.payment.receipts.length <= 1) {
    return NextResponse.json(
      { error: "A paid bill must keep at least one receipt on file." },
      { status: 400 },
    );
  }

  await prisma.billReceipt.delete({ where: { id } });

  // Keep the payment's legacy receiptUrl pointing at a live receipt.
  const remaining = await prisma.billReceipt.findMany({
    where: { paymentId: receipt.paymentId },
    orderBy: { uploadedAt: "asc" },
    select: { id: true },
  });
  await prisma.billPayment.update({
    where: { id: receipt.paymentId },
    data: {
      receiptUrl: remaining.length
        ? `/api/uploads/bill-receipt/${remaining[0].id}`
        : null,
    },
  });

  await logAudit(
    "Bill",
    "UPDATED",
    `Removed a receipt from ${receipt.payment.bill.type} (${receipt.payment.bill.provider}) — ${receipt.payment.cycle}.`,
    receipt.payment.bill.propertyId,
    me.id,
  );

  return NextResponse.json({ ok: true });
}
