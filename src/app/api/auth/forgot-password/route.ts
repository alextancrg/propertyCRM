import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createResetToken } from "@/lib/auth";
import { sendMail } from "@/lib/mail";
import { appOrigin } from "@/lib/url";

export const dynamic = "force-dynamic";

/**
 * Step 1 of password reset: verify identity with email + birthdate. If both
 * match an account, email a reset link (valid 24 hours). The response is
 * intentionally identical whether or not the identity matched, so the
 * endpoint can't be used to probe which emails/birthdates are registered.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const birthDate = typeof body.birthDate === "string" ? body.birthDate.trim() : "";

  if (!email || !birthDate) {
    return NextResponse.json({ error: "Email and birthdate are required." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  // Compare calendar dates (timezone-independent): both as YYYY-MM-DD.
  const dob = user?.birthDate ? user.birthDate.toISOString().slice(0, 10) : null;
  const identityOk = Boolean(user && dob && dob === birthDate);

  if (identityOk && user) {
    const { token } = await createResetToken(user.id);
    const resetUrl = `${appOrigin(req)}/reset-password?token=${token}`;
    await sendMail({
      to: user.email,
      subject: "Reset your AssetHub password",
      text: [
        `Hi ${user.name},`,
        "",
        "We received a request to reset your AssetHub password (your identity was verified with your birthdate).",
        "Click the link below to choose a new password:",
        resetUrl,
        "",
        "This link expires in 24 hours. If you didn't request this, you can safely ignore this email — your password stays unchanged.",
      ].join("\n"),
      html: [
        `<p>Hi ${user.name},</p>`,
        "<p>We received a request to reset your <b>AssetHub</b> password (your identity was verified with your birthdate).</p>",
        `<p><a href="${resetUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;">Reset my password</a></p>`,
        `<p style="color:#64748b;font-size:12px;">Or paste this link into your browser: ${resetUrl}</p>`,
        `<p style="color:#64748b;font-size:12px;">This link expires in 24 hours. If you didn't request this, you can safely ignore this email — your password stays unchanged.</p>`,
      ].join("\n"),
    });
  }

  return NextResponse.json({
    ok: true,
    message:
      "If your email and birthdate match our records, a password reset link has been sent to your email. The link expires in 24 hours.",
  });
}
