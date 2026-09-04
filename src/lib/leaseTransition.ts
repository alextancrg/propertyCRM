import { prisma } from "./prisma";
import { logAudit } from "./ai";

/**
 * Transition future tenancies to active when the current lease is up.
 *
 * For every property that has:
 *  - an ACTIVE lease whose end date has passed (and no checkout notice), and
 *  - a PENDING (future tenancy) lease whose start date has arrived,
 * the old lease is marked EXPIRED and the future tenancy becomes the ACTIVE
 * lease. The pending lease's utility deposit / unit tags (captured for the
 * incoming tenant) are applied to the property, and the property status is
 * refreshed.
 *
 * Idempotent — safe to run daily. Returns the number of transitions made.
 */
export async function transitionFutureLeases(now = new Date()): Promise<number> {
  // Pending leases whose start date has arrived.
  const pending = await prisma.lease.findMany({
    where: { status: "PENDING", startDate: { lte: now } },
    include: { property: true, tenant: true },
  });

  let transitions = 0;
  for (const lease of pending) {
    // The outgoing lease must be finished: no ACTIVE lease that is still
    // running (open-ended or ends in the future).
    const outgoing = await prisma.lease.findFirst({
      where: {
        propertyId: lease.propertyId,
        status: "ACTIVE",
        OR: [{ endDate: null }, { endDate: { gt: now } }],
      },
    });
    if (outgoing) continue; // current lease is still up — keep waiting

    // Expire any lingering ACTIVE lease on the unit, activate the pending one.
    await prisma.$transaction([
      prisma.lease.updateMany({
        where: { propertyId: lease.propertyId, status: "ACTIVE" },
        data: { status: "EXPIRED" },
      }),
      prisma.lease.update({ where: { id: lease.id }, data: { status: "ACTIVE" } }),
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
      "AUTO_ACTIVATED",
      `Future tenancy automatically started: ${lease.property.name} (${lease.tenant.name}) — previous lease is up.`,
      lease.propertyId,
    );
    transitions += 1;
  }
  return transitions;
}
