import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/ai";
import { getSessionUser } from "@/lib/auth";
import { LeaseStatus } from "@prisma/client";
import { visiblePropertyIds } from "@/lib/access";
import { normalizePhoneE164 } from "@/lib/phone";
import { PROPERTY_UNIT_TAGS_MAX } from "@/lib/properties";

export const dynamic = "force-dynamic";

/**
 * Add a future tenancy (pre-booked lease) for a property. The lease is stored
 * with status PENDING so it does not affect rent collection, tax, or the
 * dashboard until it starts. It becomes ACTIVE either automatically when the
 * manager starts it (PATCH /api/leases/[id] { action: "activate" }) or on
 * creation when the start date has already arrived and no active lease exists.
 */
export async function POST(req: NextRequest) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const {
    propertyId,
    tenantName,
    tenantPhone,
    tenantLanguage,
    monthlyRent,
    deposit,
    utilityDeposit,
    unitTags,
    startDate,
    endDate,
    openEnded,
  } = body;

  if (!propertyId || !tenantName || !startDate) {
    return NextResponse.json({ error: "propertyId, tenant name and lease start date are required." }, { status: 400 });
  }

  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property || property.deletedAt) {
    return NextResponse.json({ error: "Property not found." }, { status: 404 });
  }

  // RBAC: the manager must be able to see the property.
  const ids = await visiblePropertyIds(me);
  if (ids !== null && !ids.includes(propertyId)) {
    return NextResponse.json({ error: "You do not have access to this property." }, { status: 403 });
  }

  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) {
    return NextResponse.json({ error: "Invalid lease start date." }, { status: 400 });
  }
  const end = !openEnded && endDate ? new Date(endDate) : null;
  if (end && Number.isNaN(end.getTime())) {
    return NextResponse.json({ error: "Invalid lease end date." }, { status: 400 });
  }
  if (end && end <= start) {
    return NextResponse.json({ error: "Lease end date must be after the start date." }, { status: 400 });
  }

  // Overlap guard against another future tenancy on the same unit.
  const overlapping = await prisma.lease.findFirst({
    where: {
      propertyId,
      status: LeaseStatus.PENDING,
      ...(end
        ? { startDate: { lt: end }, OR: [{ endDate: null }, { endDate: { gt: start } }] }
        : { startDate: { gte: start } }),
    },
    include: { tenant: true },
  });
  if (overlapping) {
    return NextResponse.json(
      {
        error: `This unit already has a future tenancy for ${overlapping.tenant.name} starting ${overlapping.startDate.toLocaleDateString()}.`,
      },
      { status: 409 },
    );
  }

  const tenant = await prisma.tenant.create({
    data: {
      name: tenantName,
      phone: normalizePhoneE164(tenantPhone),
      language: ["en", "ms", "zh-CN"].includes(tenantLanguage) ? tenantLanguage : "en",
    },
  });

  const now = new Date();
  // If the start date has already passed and the unit has no active lease,
  // create it directly as the active lease instead of a future tenancy.
  const activeLease = await prisma.lease.findFirst({ where: { propertyId, status: LeaseStatus.ACTIVE } });
  const status = start <= now && !activeLease ? LeaseStatus.ACTIVE : LeaseStatus.PENDING;

  const lease = await prisma.lease.create({
    data: {
      propertyId,
      tenantId: tenant.id,
      startDate: start,
      endDate: end,
      monthlyRent: monthlyRent !== undefined && monthlyRent !== "" ? Number(monthlyRent) : property.rent,
      deposit: deposit !== undefined && deposit !== "" ? Number(deposit) : 0,
      // Future tenancy only: stored on the pending lease and applied to the
      // property when the tenancy is started (the active fields live on the
      // Property record).
      utilityDeposit:
        utilityDeposit !== undefined && utilityDeposit !== "" && utilityDeposit !== null
          ? Number(utilityDeposit)
          : null,
      unitTags: typeof unitTags === "string" && unitTags.trim() ? unitTags.trim().slice(0, PROPERTY_UNIT_TAGS_MAX) : null,
      status,
    },
  });

  if (status === LeaseStatus.ACTIVE && property.status === "VACANT") {
    await prisma.property.update({ where: { id: propertyId }, data: { status: "LEASED" } });
  }

  await logAudit(
    "Lease",
    status === LeaseStatus.PENDING ? "FUTURE_TENANCY_ADDED" : "CREATED",
    status === LeaseStatus.PENDING
      ? `Future tenancy added for ${property.name} (${tenantName}) starting ${start.toLocaleDateString()}.`
      : `New lease added for ${property.name} (${tenantName}).`,
    propertyId,
    me.id,
  );

  return NextResponse.json({ ok: true, lease });
}
