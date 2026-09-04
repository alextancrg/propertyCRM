import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyResetToken, clearResetToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Step 2 of password reset: consume the emailed token (24h expiry enforced in
 * verifyResetToken) and set the new password. The token is single-use — it is
 * cleared once the password is changed.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token : "";
  const password = typeof body.password === "string" ? body.password : "";
  const confirmPassword = typeof body.confirmPassword === "string" ? body.confirmPassword : "";

  if (!token) return NextResponse.json({ error: "Reset link is missing or invalid." }, { status: 400 });
  if (!password || !confirmPassword) {
    return NextResponse.json({ error: "Please fill in both password fields." }, { status: 400 });
  }
  if (password !== confirmPassword) {
    return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const userId = await verifyResetToken(token);
  if (!userId) {
    return NextResponse.json(
      { error: "This reset link is invalid or has expired (links last 24 hours). Please request a new one." },
      { status: 400 },
    );
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  await clearResetToken(userId);

  return NextResponse.json({ ok: true, message: "Password updated. You can now log in with your new password." });
}
