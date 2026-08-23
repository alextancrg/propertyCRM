import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/ai";
import { getSessionUser } from "@/lib/auth";
import { BillStatus } from "@prisma/client";
import { BILL_MAX_REMARKS } from "@/lib/bills";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

async function saveUpload(file: File): Promise<string> {
  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadsDir, { recursive: true });
  const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadsDir, safeName), bytes);
  return `/uploads/${safeName}`;
}

/**
 * Update a bill payment (cycle).
 *
 * Form data:
 *  - status   : "PAID" to mark paid (receipt upload is mandatory), or "UNPAID"
 *  - amount   : amount paid (optional)
 *  - remarks  : per-cycle remarks (optional, max 500 chars)
 *  - file     : receipt image/PDF (mandatory when status = PAID)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { id } = await params;
  const form = await req.formData().catch(() => null);
  const status = form?.get("status")?.toString() ?? "PAID";
  const amountRaw = form?.get("amount")?.toString();
  const remarks = form?.get("remarks")?.toString() || null;
  const file = form?.get("file");

  const existing = await prisma.billPayment.findUnique({
    where: { id },
    include: { bill: { include: { property: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  }

  if (remarks && remarks.length > BILL_MAX_REMARKS) {
    return NextResponse.json(
      { error: `Remarks must be ${BILL_MAX_REMARKS} characters or fewer.` },
      { status: 400 },
    );
  }

  const isPaid = status === "PAID";
  let receiptUrl: string | null = existing.receiptUrl;

  if (isPaid) {
    // Receipt upload is mandatory when marking a bill as PAID.
    if (file instanceof File && file.size > 0) {
      if (!process.env.VERCEL) {
        receiptUrl = await saveUpload(file);
      } else {
        // On Vercel, use Vercel Blob / S3 — fall back to storing the file name.
        receiptUrl = `/uploads/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      }
    } else if (!receiptUrl) {
      return NextResponse.json(
        { error: "A receipt upload is mandatory to mark this bill as Paid." },
        { status: 400 },
      );
    }
  }

  const amount = amountRaw !== undefined && amountRaw !== "" ? Number(amountRaw) : existing.amount;

  const payment = await prisma.billPayment.update({
    where: { id },
    data: {
      status: isPaid ? BillStatus.PAID : BillStatus.UNPAID,
      paidAt: isPaid ? new Date() : existing.paidAt,
      amount: Number.isFinite(amount) ? amount : existing.amount,
      remarks: remarks,
      ...(receiptUrl ? { receiptUrl } : {}),
    },
    include: { bill: { include: { property: true } } },
  });

  await logAudit(
    "Bill",
    isPaid ? "PAID" : "UPDATED",
    isPaid
      ? `Marked ${payment.bill.type} (${payment.bill.provider}) paid for ${payment.bill.property.name} — ${payment.cycle}.`
      : `Updated payment remarks for ${payment.bill.type} (${payment.bill.provider}) — ${payment.cycle}.`,
    payment.bill.propertyId,
    me.id,
  );

  return NextResponse.json({ ok: true, payment });
}
