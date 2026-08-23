import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/ai";
import { getSessionUser } from "@/lib/auth";
import { LeaseStatus, PropertyStatus } from "@prisma/client";
import { validateOwners, resolveOwnerInput, type OwnerInput } from "@/lib/owners";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { name, type, address, location, rent, rentStartDate, owners } = body;

  if (!name || !type) {
    return NextResponse.json({ error: "name and type are required." }, { status: 400 });
  }

  const ownerInputs: OwnerInput[] = Array.isArray(owners) ? owners : [];
  const validation = validateOwners(ownerInputs);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  // Resolve owners (creating new ones where needed). New owners are tied to
  // the logged-in manager who is configuring the property.
  const resolvedOwners: { ownerId: string; sharePercent: number }[] = [];
  for (const o of ownerInputs) {
    if (!o.ownerId && !(o.ownerName && o.ownerName.trim())) continue;
    const ownerId = await resolveOwnerInput(o, me.id);
    resolvedOwners.push({ ownerId, sharePercent: Number(o.sharePercent ?? 100) });
  }

  const property = await prisma.property.create({
    data: {
      name,
      type,
      address: address ?? "",
      location: location ?? "",
      rent: rent ? Number(rent) : 0,
      rentStartDate: rentStartDate ? new Date(rentStartDate) : null,
      status: PropertyStatus.VACANT,
      owners: {
        create: resolvedOwners.map((o) => ({
          ownerId: o.ownerId,
          sharePercent: o.sharePercent,
        })),
      },
    },
  });

  // Optional tenant + lease.
  if (body.tenantName) {
    const tenant = await prisma.tenant.create({
      data: { name: body.tenantName, phone: body.tenantPhone ?? null },
    });
    await prisma.lease.create({
      data: {
        propertyId: property.id,
        tenantId: tenant.id,
        startDate: body.startDate ? new Date(body.startDate) : new Date(),
        endDate: body.endDate ? new Date(body.endDate) : null,
        monthlyRent: body.monthlyRent ? Number(body.monthlyRent) : Number(rent ?? 0),
        deposit: body.deposit ? Number(body.deposit) : 0,
        status: LeaseStatus.ACTIVE,
      },
    });
    await prisma.property.update({
      where: { id: property.id },
      data: { status: PropertyStatus.LEASED },
    });
  }

  await logAudit("Property", "CREATED", `New property added: ${name}.`, property.id, me.id);
  return NextResponse.json({ ok: true, property });
}
