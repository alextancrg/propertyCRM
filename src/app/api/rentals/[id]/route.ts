import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/ai";
import { getSessionUser } from "@/lib/auth";
import { BillStatus } from "@prisma/client";
import { monthLabel } from "@/lib/rentals";
import { formatMYR } from "@/lib/format";
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
 * Update a rental collection record (one lease-month).
 *
 * Form data:
 *  - status   : "PAID" to collect rent, or "UNPAID" (save draft)
 *  - amount   : amount collected (optional)
 *  - remarks  : per-month notes (optional)
 *  - file     : payment slip (PDF/image) — mandatory when marking PAID
 *  - override : "true" when the Property Manager confirms a PAID update
 *               without a payment slip (recorded for audit)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { id } = await params;

  const form = await req.formData().catch(() => null);
  const status = form?.get("status")?.toString() ?? "UNPAID";
  const amountRaw = form?.get("amount")?.toString();
  const remarks = form?.get("remarks")?.toString() || null;
  const file = form?.get("file");
  const override = form?.get("override") === "true";

  const existing = await prisma.rentPayment.findUnique({
    where: { id },
    include: { lease: { include: { property: true, tenant: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Rental record not found." }, { status: 404 });
  }

  const isPaid = status === "PAID";
  let receiptUrl: string | null = existing.receiptUrl;
  let overrideById: string | null = existing.overrideById;
  let overrideAt: Date | null = existing.overrideAt;

  if (isPaid) {
    if (file instanceof File && file.size > 0) {
      receiptUrl = process.env.VERCEL
        ? `/uploads/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`
        : await saveUpload(file);
    }
    if (!receiptUrl) {
      // No payment slip -> a Property Manager override confirmation is required.
      if (!override) {
        return NextResponse.json(
          {
            error:
              "A payment slip is required to record this rent. Upload a PDF/image, or confirm the override as a Property Manager.",
          },
          { status: 400 },
        );
      }
      overrideById = me.id;
      overrideAt = new Date();
    }
  } else {
    // Saving as unpaid resets any slip/override state.
    receiptUrl = null;
    overrideById = null;
    overrideAt = null;
  }

  const amount =
    amountRaw !== undefined && amountRaw !== "" ? Number(amountRaw) : existing.amount;

  const payment = await prisma.rentPayment.update({
    where: { id },
    data: {
      status: isPaid ? BillStatus.PAID : BillStatus.UNPAID,
      paidAt: isPaid ? new Date() : existing.paidAt,
      amount: Number.isFinite(amount) ? amount : existing.amount,
      remarks: remarks,
      receiptUrl,
      overrideById,
      overrideAt,
    },
  });

  const label = monthLabel(existing.month);
  const tenantName = existing.lease.tenant.name;
  const propName = existing.lease.property.name;
  await logAudit(
    "RentPayment",
    isPaid ? "COLLECTED" : "UPDATED",
    isPaid
      ? `${label} rent of ${formatMYR(payment.amount)} collected from ${tenantName} for ${propName}.${
          overrideById ? " (confirmed by Property Manager without a payment slip)" : ""
        }`
      : `Rental record updated for ${propName} — ${label}.`,
    existing.lease.propertyId,
    me.id,
  );

  return NextResponse.json({ ok: true, payment });
}
