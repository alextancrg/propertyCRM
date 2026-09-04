import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { sendMail } from "@/lib/mail";
import { logAudit } from "@/lib/ai";
import { appOrigin } from "@/lib/url";
import crypto from "crypto";

export const dynamic = "force-dynamic";

/**
 * Self-service signup with email + password. The account is created
 * unverified; a verification link is emailed and the user must click it
 * before they can log in. (Their session is not started here — the flow
 * routes them to a "check your inbox" page.)
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const birthDate = typeof body.birthDate === "string" && body.birthDate ? new Date(body.birthDate) : null;
  const password = typeof body.password === "string" ? body.password : "";

  if (!name || !email || !password) {
    return NextResponse.json({ error: "Name, email and password are required." }, { status: 400 });
  }
  if (birthDate && Number.isNaN(birthDate.getTime())) {
    return NextResponse.json({ error: "Invalid birthdate." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists. Try logging in or resetting your password." },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(password);
  // The verification token is emailed once; its hash lets us confirm the click.
  const verifyToken = crypto.randomBytes(32).toString("base64url");
  const verifyTokenHash = crypto.createHash("sha256").update(verifyToken).digest("hex");

  const user = await prisma.user.create({
    data: {
      name,
      email,
      phone: phone || null,
      passwordHash,
      birthDate,
      // The token hash rides in resetTokenHash until verification; expiry 48h.
      resetTokenHash: `verify:${verifyTokenHash}`,
      resetTokenExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      role: "Property Manager",
    },
  });

  // Free-plan subscription so plan limits work from day one.
  await prisma.subscription.create({
    data: { userId: user.id, plan: "free", status: "active" },
  });

  const verifyUrl = `${appOrigin(req)}/api/auth/verify?token=${verifyToken}`;
  const mail = await sendMail({
    to: email,
    subject: "Verify your AssetHub account",
    text: [
      `Hi ${name},`,
      "",
      "Welcome to AssetHub! Please confirm your email address to activate your account:",
      verifyUrl,
      "",
      "This link expires in 48 hours. If you didn't sign up, you can ignore this email.",
    ].join("\n"),
    html: [
      `<p>Hi ${name},</p>`,
      "<p>Welcome to <b>AssetHub</b>! Please confirm your email address to activate your account:</p>",
      `<p><a href="${verifyUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;">Verify my email</a></p>`,
      `<p style="color:#64748b;font-size:12px;">Or paste this link into your browser: ${verifyUrl}</p>`,
      `<p style="color:#64748b;font-size:12px;">This link expires in 48 hours. If you didn't sign up, you can ignore this email.</p>`,
    ].join("\n"),
  });

  await logAudit("User", "SIGNED_UP", `New member signed up: ${name} <${email}>.`, undefined, user.id);

  if (!mail.sent) {
    // Still succeed — the account exists and can be verified later via a
    // re-send, but tell the client email delivery is pending.
    return NextResponse.json({
      ok: true,
      emailSent: false,
      warning:
        "Your account was created, but the verification email could not be sent (email service not configured). Please contact support.",
    });
  }

  return NextResponse.json({ ok: true, emailSent: true });
}
