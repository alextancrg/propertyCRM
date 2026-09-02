import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/ai";
import { getSessionUser } from "@/lib/auth";
import { BillStatus, LeaseStatus, PropertyStatus } from "@prisma/client";
import { generateBillCycles } from "@/lib/bills";
import { resolveOwnerInput, validateOwners, type OwnerInput } from "@/lib/owners";
import { PROPERTY_MAX_REMARKS, PROPERTY_UNIT_TAGS_MAX, sanitizeGraceDays } from "@/lib/properties";
import { normalizePhoneE164 } from "@/lib/phone";

export const dynamic = "force-dynamic";

/**
 * When a property is marked SOLD, create a one-off "Bill Transfer" follow-up so
 * the manager follows up on switching the property's recurring bills (except
 * one-off bills) over to the next owner. Only created once per sale.
 */
async function createBillTransferFollowUp(
  propertyId: string,
  soldDate: Date,
  userId: string,
): Promise<void> {
  const existing = await prisma.bill.findFirst({
    where: { propertyId, provider: "Bill Transfer" },
  });
  if (existing) return;

  const y = soldDate.getFullYear();
  const due = `${y}-${String(soldDate.getMonth() + 1).padStart(2, "0")}-${String(
    soldDate.getDate(),
  ).padStart(2, "0")}`;
  const cycles = generateBillCycles("One Off", [due], y);

  const bill = await prisma.bill.create({
    data: {
      propertyId,
      type: "Miscellaneous",
      provider: "Bill Transfer",
      schedule: "One Off",
      amountType: "Variable",
      year: y,
      dueDates: JSON.stringify([due]),
      remarks:
        "Follow up on switching recurring bills (except one-off) to the next owner after the sale.",
      payments: {
        create: cycles.map((c) => ({
          cycle: c.cycle,
          dueDate: c.dueDate,
          amount: 0,
          status: BillStatus.UNPAID,
        })),
      },
    },
  });

  await logAudit(
    "Bill",
    "CREATED",
    `One-off bill-switching follow-up created for sold property (${bill.type} / ${bill.provider}).`,
    propertyId,
    userId,
  );
}

// Update an existing property (same form shape as "Add property").
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const existing = await prisma.property.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Property not found." }, { status: 404 });
  }

  const ownerInputs: OwnerInput[] = Array.isArray(body.owners) ? body.owners : [];
  if (ownerInputs.length > 0) {
    const validation = validateOwners(ownerInputs);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
  }

  const resolvedOwners: { ownerId: string; sharePercent: number }[] = [];
  for (const o of ownerInputs) {
    if (!o.ownerId && !(o.ownerName && o.ownerName.trim())) continue;
    const ownerId = await resolveOwnerInput(o, me.id);
    resolvedOwners.push({ ownerId, sharePercent: Number(o.sharePercent ?? 100) });
  }

  // Status + sale date handling.
  const newStatus: PropertyStatus =
    typeof body.status === "string" ? (body.status as PropertyStatus) : existing.status;

  let soldDate = existing.soldDate;
  if (newStatus === PropertyStatus.SOLD) {
    // Record the sale date (explicit date, or today when just marking as sold).
    soldDate = body.soldDate ? new Date(body.soldDate) : (existing.soldDate ?? new Date());
  } else if (existing.status === PropertyStatus.SOLD) {
    soldDate = null;
  }

  // Basic property fields.
  const property = await prisma.property.update({
    where: { id },
    data: {
      name: typeof body.name === "string" ? body.name : existing.name,
      type: typeof body.type === "string" ? body.type : existing.type,
      address: typeof body.address === "string" ? body.address : existing.address,
      location: typeof body.location === "string" ? body.location : existing.location,
      rent: body.rent !== undefined ? Number(body.rent) : existing.rent,
      rentStartDate:
        body.rentStartDate !== undefined && body.rentStartDate
          ? new Date(body.rentStartDate)
          : existing.rentStartDate,
      rentGraceDays: sanitizeGraceDays(body.rentGraceDays, existing.rentGraceDays),
      status: newStatus,
      soldDate,
      isOwnStay: typeof body.isOwnStay === "boolean" ? body.isOwnStay : existing.isOwnStay,
      remarks:
        body.remarks !== undefined
          ? body.remarks
            ? String(body.remarks).slice(0, PROPERTY_MAX_REMARKS)
            : null
          : existing.remarks,
      unitName: typeof body.unitName === "string" ? body.unitName : existing.unitName,
      // Empty / cleared unit tags → store null (a dash in the table), never the
      // literal string "null" (String(null) === "null" was being persisted).
      unitTags:
        body.unitTags !== undefined
          ? typeof body.unitTags === "string" && body.unitTags.trim()
            ? body.unitTags.trim().slice(0, PROPERTY_UNIT_TAGS_MAX)
            : null
          : existing.unitTags,
      utilityDeposit:
        body.utilityDeposit !== undefined ? Number(body.utilityDeposit) : existing.utilityDeposit,
      meterMode: typeof body.meterMode === "string" ? body.meterMode : existing.meterMode,
      meterRate:
        body.meterRate !== undefined && body.meterRate !== null && body.meterRate !== ""
          ? Number(body.meterRate)
          : existing.meterRate,
      template: typeof body.template === "string" ? body.template : existing.template,
    },
  });

  // Replace ownership links (delete + recreate) when the form sent owners.
  if (resolvedOwners.length > 0) {
    await prisma.propertyOwner.deleteMany({ where: { propertyId: id } });
    await prisma.propertyOwner.createMany({
      data: resolvedOwners.map((o) => ({
        propertyId: id,
        ownerId: o.ownerId,
        sharePercent: o.sharePercent,
      })),
    });
  }

  // Optional tenant + lease (same behaviour as create).
  if (body.tenantName) {
    const activeLease = await prisma.lease.findFirst({
      where: { propertyId: id, status: "ACTIVE" },
    });
    if (activeLease) {
      await prisma.lease.update({
        where: { id: activeLease.id },
        data: {
          startDate: body.startDate ? new Date(body.startDate) : activeLease.startDate,
          // Open-ended lease (checkbox) clears the end date; otherwise keep the
          // existing date unless a new one was sent.
          endDate: body.openEnded ? null : body.endDate ? new Date(body.endDate) : activeLease.endDate,
          monthlyRent: body.monthlyRent ? Number(body.monthlyRent) : activeLease.monthlyRent,
          deposit: body.deposit !== undefined ? Number(body.deposit) : activeLease.deposit,
        },
      });
      // Sync the linked tenant's contact details. Previously the name/phone were
      // dropped whenever an active lease already existed, so editing a tenant's
      // phone number on an existing property silently did nothing.
      await prisma.tenant.update({
        where: { id: activeLease.tenantId },
        data: {
          name: body.tenantName ?? undefined,
          phone: body.tenantPhone !== undefined ? normalizePhoneE164(body.tenantPhone) : undefined,
          language:
            body.tenantLanguage !== undefined && ["en", "ms", "zh-CN"].includes(body.tenantLanguage)
              ? body.tenantLanguage
              : undefined,
        },
      });
    } else {
      const tenant = await prisma.tenant.create({
        data: {
          name: body.tenantName,
          phone: normalizePhoneE164(body.tenantPhone),
          language: ["en", "ms", "zh-CN"].includes(body.tenantLanguage) ? body.tenantLanguage : "en",
        },
      });
      await prisma.lease.create({
        data: {
          propertyId: id,
          tenantId: tenant.id,
          startDate: body.startDate ? new Date(body.startDate) : new Date(),
          endDate: body.endDate ? new Date(body.endDate) : null,
          monthlyRent: body.monthlyRent ? Number(body.monthlyRent) : Number(body.rent ?? property.rent),
          deposit: body.deposit ? Number(body.deposit) : 0,
          status: LeaseStatus.ACTIVE,
        },
      });
    }
    if (body.tenantName && property.status === PropertyStatus.VACANT) {
      await prisma.property.update({ where: { id }, data: { status: PropertyStatus.LEASED } });
    }
  }

  // When a property is first marked SOLD, create the one-off bill-switching
  // follow-up (sold properties keep no recurring bills).
  if (newStatus === PropertyStatus.SOLD && existing.status !== PropertyStatus.SOLD) {
    await createBillTransferFollowUp(id, soldDate ?? new Date(), me.id);
  }

  await logAudit("Property", "UPDATED", `Property updated: ${property.name}.`, id, me.id);
  return NextResponse.json({ ok: true, property });
}

// Soft-delete a property (requires login). Documents and older bills are kept
// in the system for record keeping.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { id } = await params;

  const existing = await prisma.property.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Property not found." }, { status: 404 });
  }

  await prisma.property.update({ where: { id }, data: { deletedAt: new Date() } });
  await logAudit("Property", "DELETED", `Property removed: ${existing.name}.`, id, me.id);
  return NextResponse.json({ ok: true });
}
