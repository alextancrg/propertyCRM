import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, getSessionUser } from "@/lib/auth";
import { visibleManagerIds } from "@/lib/access";
import { logAudit } from "@/lib/ai";
import { normalizePhoneE164 } from "@/lib/phone";

export const dynamic = "force-dynamic";

// List property managers visible to the caller — Administrators see everyone;
// Property Managers only see themselves + managers they share visibility with.
export async function GET() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const scope = await visibleManagerIds(me);
  const managers = await prisma.user.findMany({
    where: scope ? { id: { in: scope } } : {},
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      language: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return NextResponse.json({
    managers: managers.map((m) => ({
      ...m,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    })),
  });
}

// Register a new property manager (Administrators only).
export async function POST(req: NextRequest) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (me.role !== "Administrator") {
    return NextResponse.json(
      { error: "Only Administrators can register managers." },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const phone = normalizePhoneE164(typeof body.phone === "string" ? body.phone : null);

  if (!name || !email || !password) {
    return NextResponse.json({ error: "Name, email and password are required." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "A manager with this email already exists." }, { status: 409 });
  }

  const manager = await prisma.user.create({
    data: {
      name,
      email,
      phone,
      language: ["en", "ms", "zh-CN"].includes(body.language) ? body.language : "en",
      role: typeof body.role === "string" && body.role ? body.role : "Property Manager",
      passwordHash: await hashPassword(password),
    },
    select: { id: true, name: true, email: true, phone: true, language: true, role: true, createdAt: true, updatedAt: true },
  });

  await logAudit("User", "CREATED", `Property manager registered: ${manager.name} (${manager.email}).`, undefined, me.id);
  return NextResponse.json({ ok: true, manager });
}
