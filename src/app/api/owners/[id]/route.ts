import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { logAudit } from "@/lib/ai";

export const dynamic = "force-dynamic";

// Update an owner's registration details and/or assigned managers (requires login).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const existing = await prisma.owner.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Owner not found." }, { status: 404 });

  // Only the owner's creator (or an Administrator) may edit/delete an owner.
  const isAdmin = me.role === "Administrator";
  if (!isAdmin && existing.createdById !== me.id) {
    return NextResponse.json(
      { error: "You can only manage owners that you registered." },
      { status: 403 },
    );
  }

  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : existing.name;

  const owner = await prisma.owner.update({
    where: { id },
    data: {
      name,
      icNumber: typeof body.icNumber === "string" ? body.icNumber.trim() : existing.icNumber,
      phone: typeof body.phone === "string" ? body.phone.trim() : existing.phone,
      email: typeof body.email === "string" ? body.email.trim() : existing.email,
    },
  });

  // Assign other property managers to manage this owner's properties.
  // Passing an empty array clears all assignments.
  if (Array.isArray(body.managerIds)) {
    const managerIds = Array.isArray(body.managerIds) ? (body.managerIds as unknown[]) : [];
    const requested: string[] = Array.from(new Set(managerIds.map((x) => String(x))));
    const users = await prisma.user.findMany({
      where: { id: { in: requested } },
      select: { id: true },
    });
    const valid = users.map((u) => u.id);
    await prisma.ownerManager.deleteMany({ where: { ownerId: id } });
    if (valid.length > 0) {
      await prisma.ownerManager.createMany({
        data: valid.map((userId) => ({ ownerId: id, userId })),
      });
    }
  }

  await logAudit("Owner", "UPDATED", `Owner updated: ${owner.name}.`, id, me.id);
  return NextResponse.json({ ok: true, owner });
}

// Soft-delete an owner (requires login). Ownership history, properties,
// documents and bills are kept in the system.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.owner.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Owner not found." }, { status: 404 });

  // Only the owner's creator (or an Administrator) may delete an owner.
  const isAdmin = me.role === "Administrator";
  if (!isAdmin && existing.createdById !== me.id) {
    return NextResponse.json(
      { error: "You can only manage owners that you registered." },
      { status: 403 },
    );
  }

  await prisma.owner.update({ where: { id }, data: { deletedAt: new Date() } });
  await logAudit("Owner", "DELETED", `Owner removed: ${existing.name}.`, id, me.id);
  return NextResponse.json({ ok: true });
}
