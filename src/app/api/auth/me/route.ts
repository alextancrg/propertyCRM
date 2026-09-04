import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ user: null });
  // Include profile fields (birthdate powers the password-reset identity check).
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { id: true, name: true, email: true, phone: true, birthDate: true, role: true },
  });
  return NextResponse.json({
    user: user
      ? {
          ...user,
          birthDate: user.birthDate?.toISOString().slice(0, 10) ?? null,
        }
      : null,
  });
}
