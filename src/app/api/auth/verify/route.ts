import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export const dynamic = "force-dynamic";

/**
 * Email verification endpoint (clicked from the signup email).
 * Marks the account as verified and redirects to /login?verified=1.
 * The token is stored (at signup) as sha256 hash in resetTokenHash prefixed
 * with "verify:"; matching is constant-time on the hex digest.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const origin = req.nextUrl.origin;
  const fail = (reason: string) =>
    NextResponse.redirect(`${origin}/login?verify=${encodeURIComponent(reason)}`);

  if (!token) return fail("invalid");

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const user = await prisma.user.findFirst({
    where: {
      resetTokenHash: `verify:${tokenHash}`,
      resetTokenExpiresAt: { gt: new Date() },
    },
    select: { id: true, emailVerifiedAt: true },
  });
  if (!user) return fail("expired");

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
      resetTokenHash: null,
      resetTokenExpiresAt: null,
    },
  });

  return NextResponse.redirect(`${origin}/login?verified=1`);
}
