import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { logAudit } from "@/lib/ai";
import { visiblePropertyIds } from "@/lib/access";
import { LEASE_END_REMARKS_MAX } from "@/lib/properties";

export const dynamic = "force-dynamic";

/**
 * Update a lease's end-of-tenancy status (opened from the "Unit's Rental
 * Status" cell in Properties & Leases):
 *  - `checkoutNotified` — the tenant has informed they are vacating the unit
 *    at lease expiry (marks the status as "Notified Check Out").
 *  - `checkoutDate` — the date the tenant said they will vacate.
 *  - `nextCheckInDate` — estimated check-in of the next tenant (stored on the
 *    property so it shows under the status once a checkout is notified).
 *  - `leaseEndRemarks` — free-text notes about the lease end.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const lease = await prisma.lease.findUnique({
    where: { id },
    include: { property: true, tenant: true },
  });
  if (!lease) return NextResponse.json({ error: "Lease not found." }, { status: 404 });

  // RBAC: the manager must be able to see the lease's property.
  const ids = await visiblePropertyIds(me);
  if (ids !== null && !ids.includes(lease.propertyId)) {
    return NextResponse.json({ error: "You do not have access to this lease." }, { status: 403 });
  }

  // Start a future (PENDING) tenancy now: expire the outgoing lease and make
  // this one active.
  if (body.action === "activate") {
    if (lease.status !== "PENDING") {
      return NextResponse.json({ error: "Only a future tenancy can be started." }, { status: 400 });
    }
    await prisma.$transaction([
      prisma.lease.updateMany({
        where: { propertyId: lease.propertyId, status: "ACTIVE" },
        data: { status: "EXPIRED" },
      }),
      prisma.lease.update({ where: { id }, data: { status: "ACTIVE" } }),
      prisma.property.update({
        where: { id: lease.propertyId },
        data: {
          status: lease.property.isOwnStay ? "OWN_STAY" : "LEASED",
          nextCheckInDate: null,
          // Apply the incoming tenant's deposits / tags captured on the future
          // tenancy (the live values live on the Property record).
          ...(lease.utilityDeposit !== null && lease.utilityDeposit !== undefined
            ? { utilityDeposit: lease.utilityDeposit }
            : {}),
          ...(lease.unitTags ? { unitTags: lease.unitTags } : {}),
        },
      }),
    ]);
    await logAudit(
      "Lease",
      "ACTIVATED",
      `Future tenancy started: ${lease.property.name} (${lease.tenant.name}).`,
      lease.propertyId,
      me.id,
    );
    return NextResponse.json({ ok: true });
  }

  // Cancel a future tenancy (it has no rent history, so it can be removed).
  if (body.action === "cancel") {
    if (lease.status !== "PENDING") {
      return NextResponse.json({ error: "Only a future tenancy can be cancelled." }, { status: 400 });
    }
    await prisma.lease.delete({ where: { id } });
    await logAudit(
      "Lease",
      "CANCELLED",
      `Future tenancy cancelled: ${lease.property.name} (${lease.tenant.name}).`,
      lease.propertyId,
      me.id,
    );
    return NextResponse.json({ ok: true });
  }

  const checkoutNotified =
    typeof body.checkoutNotified === "boolean" ? body.checkoutNotified : lease.checkoutNotified;
  const checkoutDate =
    checkoutNotified && typeof body.checkoutDate === "string" && body.checkoutDate
      ? new Date(body.checkoutDate)
      : null;
  const leaseEndRemarks =
    typeof body.leaseEndRemarks === "string"
      ? body.leaseEndRemarks
        ? body.leaseEndRemarks.slice(0, LEASE_END_REMARKS_MAX)
        : null
      : lease.leaseEndRemarks;

  await prisma.$transaction([
    prisma.lease.update({
      where: { id },
      data: { checkoutNotified, checkoutDate, leaseEndRemarks },
    }),
    prisma.property.update({
      where: { id: lease.propertyId },
      data: {
        nextCheckInDate:
          typeof body.nextCheckInDate === "string"
            ? body.nextCheckInDate
              ? new Date(body.nextCheckInDate)
              : null
            : lease.property.nextCheckInDate,
      },
    }),
  ]);

  await logAudit(
    "Lease",
    checkoutNotified ? "NOTIFIED_CHECKOUT" : "UPDATED",
    checkoutNotified
      ? `Tenant informed they are vacating at lease end: ${lease.property.name} (${lease.tenant.name}).`
      : `Lease-end notice removed for ${lease.property.name} (${lease.tenant.name}).`,
    lease.propertyId,
    me.id,
  );

  return NextResponse.json({ ok: true });
}
