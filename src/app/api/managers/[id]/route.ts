import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword, getSessionUser } from "@/lib/auth";
import { logAudit } from "@/lib/ai";
import { normalizePhoneE164 } from "@/lib/phone";

export const dynamic = "force-dynamic";

// Update a property manager's profile (requires login).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Manager not found." }, { status: 404 });

  const isAdmin = me.role === "Administrator";

  // A Property Manager may only update their own profile.
  if (!isAdmin && me.id !== id) {
    return NextResponse.json(
      { error: "You can only update your own profile." },
      { status: 403 },
    );
  }
  // Only an Administrator may change a role.
  if (!isAdmin && typeof body.role === "string" && body.role !== existing.role) {
    return NextResponse.json(
      { error: "Only Administrators can change roles." },
      { status: 403 },
    );
  }

  const email =
    typeof body.email === "string"
      ? body.email.trim().toLowerCase()
      : existing.email;
  if (email !== existing.email) {
    const clash = await prisma.user.findUnique({ where: { email } });
    if (clash && clash.id !== id) {
      return NextResponse.json({ error: "A manager with this email already exists." }, { status: 409 });
    }
  }

  const password = typeof body.password === "string" ? body.password : "";
  if (password && password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  // A password change from the profile form must re-authenticate with the
  // current password first (Administrators may reset without it).
  let passwordHash: string | undefined;
  if (password) {
    if (!isAdmin) {
      const ok = await verifyPassword(String(body.currentPassword ?? ""), existing.passwordHash ?? "");
      if (!ok) {
        return NextResponse.json({ error: "Current password is incorrect." }, { status: 403 });
      }
    }
    passwordHash = await hashPassword(password);
  }

  // Birthdate (used for password-reset identity checks) — optional date.
  let birthDate: Date | null | undefined;
  if (body.birthDate !== undefined) {
    if (body.birthDate === null || body.birthDate === "") {
      birthDate = null;
    } else {
      const d = new Date(String(body.birthDate));
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "Invalid birthdate." }, { status: 400 });
      }
      birthDate = d;
    }
  }

  const manager = await prisma.user.update({
    where: { id },
    data: {
      name: typeof body.name === "string" && body.name.trim() ? body.name.trim() : existing.name,
      email,
      phone: typeof body.phone === "string" ? normalizePhoneE164(body.phone) : existing.phone,
      ...(birthDate !== undefined ? { birthDate } : {}),
      language:
        typeof body.language === "string" && ["en", "ms", "zh-CN"].includes(body.language)
          ? body.language
          : existing.language,
      role:
        isAdmin && typeof body.role === "string" && body.role
          ? body.role
          : existing.role,
      ...(passwordHash ? { passwordHash } : {}),
    },
    select: { id: true, name: true, email: true, phone: true, birthDate: true, role: true, updatedAt: true },
  });

  await logAudit("User", "UPDATED", `Property manager updated: ${manager.name} (${manager.email}).`, id, me.id);
  return NextResponse.json({ ok: true, manager });
}
