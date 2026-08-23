import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { logAudit } from "@/lib/ai";
import { visibleOwnerIds } from "@/lib/access";

export const dynamic = "force-dynamic";

// List owners visible to the logged-in user (requires login).
// Administrators see all; managers see owners they created or were assigned to.
export async function GET() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const scope = await visibleOwnerIds(me);

  const owners = await prisma.owner.findMany({
    where: {
      deletedAt: null,
      ...(scope ? { id: { in: scope } } : {}),
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      icNumber: true,
      phone: true,
      email: true,
      createdAt: true,
      createdBy: { select: { id: true, name: true } },
      assignedManagers: { select: { user: { select: { id: true, name: true } } } },
      properties: { select: { property: { select: { id: true, name: true } } } },
    },
  });
  return NextResponse.json({ owners });
}

// Register a new owner (requires login). The logged-in manager becomes the
// owner's creator and is therefore tied to this owner's properties.
export async function POST(req: NextRequest) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Owner name is required." }, { status: 400 });

  const owner = await prisma.owner.create({
    data: {
      name,
      icNumber: typeof body.icNumber === "string" ? body.icNumber.trim() : null,
      phone: typeof body.phone === "string" ? body.phone.trim() : null,
      email: typeof body.email === "string" ? body.email.trim() : null,
      createdById: me.id,
    },
  });

  await logAudit("Owner", "CREATED", `Owner registered: ${owner.name}.`, owner.id, me.id);
  return NextResponse.json({ ok: true, owner });
}
