import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, hashPassword, verifyPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Update the logged-in user's own profile: name, phone, birthdate and
 * (optionally) password. The birthdate doubles as the identity check for
 * password reset, so it's important members can view/update it here.
 * Password changes require the current password.
 */
export async function PATCH(req: NextRequest) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const birthDate = typeof body.birthDate === "string" && body.birthDate ? body.birthDate : null;

  if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });

  const data: Record<string, unknown> = { name };

  if (phone !== undefined) data.phone = phone || null;

  if (birthDate !== undefined) {
    if (birthDate === "") {
      data.birthDate = null;
    } else {
      const d = new Date(birthDate);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "Invalid birthdate." }, { status: 400 });
      }
      data.birthDate = d;
    }
  }

  // Optional password change — must re-authenticate with the current one.
  if (body.newPassword) {
    const newPassword = String(body.newPassword);
    if (newPassword.length < 8) {
      return NextResponse.json({ error: "New password must be at least 8 characters." }, { status: 400 });
    }
    const user = await prisma.user.findUnique({ where: { id: me.id }, select: { passwordHash: true } });
    if (!user?.passwordHash) {
      return NextResponse.json({ error: "Password change is not available for this account." }, { status: 400 });
    }
    const ok = await verifyPassword(String(body.currentPassword ?? ""), user.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 403 });
    }
    data.passwordHash = await hashPassword(newPassword);
  }

  const user = await prisma.user.update({
    where: { id: me.id },
    data,
    select: { id: true, name: true, email: true, phone: true, birthDate: true },
  });

  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      birthDate: user.birthDate?.toISOString().slice(0, 10) ?? null,
    },
  });
}
