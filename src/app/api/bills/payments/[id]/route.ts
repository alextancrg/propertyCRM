import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/ai";
import { getSessionUser } from "@/lib/auth";
import { BillStatus } from "@prisma/client";
import { BILL_MAX_REMARKS, BILL_RECEIPT_MAX } from "@/lib/bills";

export const dynamic = "force-dynamic";

type ParsedFile = { fileName: string; mimeType: string; size: number; data: string };

/** Reads a File and returns its metadata + bytes as base64 (persisted in the
 *  DB so receipts can be downloaded on any host, including Vercel). */
async function parseFile(file: File): Promise<ParsedFile> {
  const buf = Buffer.from(await file.arrayBuffer());
  return {
    fileName: file.name.replace(/[^a-zA-Z0-9._-]/g, "_") || "receipt",
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    data: buf.toString("base64"),
  };
}

/**
 * Update a bill payment (cycle).
 *
 * Form data:
 *  - status   : "PAID" to mark paid, or "UNPAID"
 *  - amount   : amount paid (optional)
 *  - remarks  : per-cycle remarks (optional, max 300 chars)
 *  - files    : 1–4 receipt PDFs/images — at least 1 is mandatory when
 *               status = PAID, up to 4 total per payment (existing + new).
 *               A single legacy `file` field is still accepted.
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

  const existing = await prisma.billPayment.findUnique({
    where: { id },
    include: { bill: { include: { property: true } }, receipts: true },
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

  // Collect new uploads (multiple `files` entries or a legacy single `file`).
  const rawFiles: File[] = [];
  if (form) {
    for (const entry of form.getAll("files")) {
      if (entry instanceof File && entry.size > 0) rawFiles.push(entry);
    }
    const single = form.get("file");
    if (single instanceof File && single.size > 0) rawFiles.push(single);
  }
  // Deduplicate the same selection re-added by the browser.
  const seen = new Set<string>();
  const files = rawFiles.filter((f) => {
    const key = `${f.name}|${f.size}|${f.lastModified}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Existing receipts count (BillReceipt rows, or a legacy single receiptUrl).
  const existingCount =
    existing.receipts.length +
    (existing.receiptUrl && existing.receipts.length === 0 ? 1 : 0);
  const total = existingCount + files.length;

  if (isPaid) {
    if (total < 1) {
      return NextResponse.json(
        { error: "At least one receipt upload is required to mark this bill as Paid." },
        { status: 400 },
      );
    }
    if (total > BILL_RECEIPT_MAX) {
      return NextResponse.json(
        { error: `A maximum of ${BILL_RECEIPT_MAX} receipts is allowed per bill.` },
        { status: 400 },
      );
    }
  }

  // Persist new receipts only when marking as paid.
  let firstNewId: string | null = null;
  if (isPaid) {
    for (const file of files) {
      const parsed = await parseFile(file);
      const receipt = await prisma.billReceipt.create({
        data: {
          paymentId: id,
          fileName: parsed.fileName,
          mimeType: parsed.mimeType,
          size: parsed.size,
          data: parsed.data,
        },
      });
      if (!firstNewId) firstNewId = receipt.id;
    }
  }

  // receiptUrl feeds legacy single-receipt consumers (payment row, tax list).
  // It always points at a live receipt (or null when there are none).
  const receiptUrl: string | null = firstNewId
    ? `/api/uploads/bill-receipt/${firstNewId}`
    : isPaid
      ? existing.receiptUrl
      : existing.receipts.length
        ? `/api/uploads/bill-receipt/${existing.receipts[0].id}`
        : null;

  const amount = amountRaw !== undefined && amountRaw !== "" ? Number(amountRaw) : existing.amount;

  const payment = await prisma.billPayment.update({
    where: { id },
    data: {
      status: isPaid ? BillStatus.PAID : BillStatus.UNPAID,
      paidAt: isPaid ? new Date() : existing.paidAt,
      amount: Number.isFinite(amount) ? amount : existing.amount,
      remarks,
      receiptUrl,
    },
    include: { bill: { include: { property: true } }, receipts: true },
  });

  await logAudit(
    "Bill",
    isPaid ? "PAID" : "UPDATED",
    isPaid
      ? `Marked ${payment.bill.type} (${payment.bill.provider}) paid for ${payment.bill.property.name} — ${payment.cycle} (${payment.receipts.length} receipt${payment.receipts.length === 1 ? "" : "s"}).`
      : `Updated payment remarks for ${payment.bill.type} (${payment.bill.provider}) — ${payment.cycle}.`,
    payment.bill.propertyId,
    me.id,
  );

  return NextResponse.json({ ok: true, payment });
}
