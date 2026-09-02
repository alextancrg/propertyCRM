import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { logAudit } from "@/lib/ai";
import { sendMail } from "@/lib/mail";
import { MAX_SHARING_PARTNERS } from "@/lib/sharing";
import { isSharingCapUser, sharingPartnerIds } from "@/lib/access";

export const dynamic = "force-dynamic";

// Share property visibility with another property manager by inviting them by
// email. The invitee must accept before the two managers can see each other's
// properties. Any property manager can invite any other registered manager.
export async function POST(req: NextRequest) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { email } });
  if (!target) {
    return NextResponse.json(
      { error: "No property manager with that email was found." },
      { status: 404 },
    );
  }
  if (target.id === me.id) {
    return NextResponse.json({ error: "You cannot invite yourself." }, { status: 400 });
  }

  const [a, b] = [me.id, target.id].sort();
  const existingShare = await prisma.managerSharing.findUnique({
    where: { userAId_userBId: { userAId: a, userBId: b } },
  });
  if (existingShare) {
    return NextResponse.json(
      { error: "You are already sharing visibility with this manager." },
      { status: 409 },
    );
  }

  const pending = await prisma.managerInvitation.findFirst({
    where: { fromUserId: me.id, email, status: "pending" },
  });
  if (pending) {
    return NextResponse.json(
      { error: "An invitation to this manager is already pending." },
      { status: 409 },
    );
  }

  // A Property Manager may only share/link with up to 5 other managers.
  if (isSharingCapUser(me)) {
    const partners = await sharingPartnerIds(me.id);
    if (partners.length >= MAX_SHARING_PARTNERS) {
      return NextResponse.json(
        {
          error: `You can share visibility with up to ${MAX_SHARING_PARTNERS} property managers. You are already sharing with ${partners.length}, so no more invitations can be sent.`,
        },
        { status: 400 },
      );
    }
  }

  const token = crypto.randomBytes(24).toString("hex");
  const invitation = await prisma.managerInvitation.create({
    data: { fromUserId: me.id, email, status: "pending", token },
  });

  // Best-effort email to the invitee (skipped silently when SMTP isn't set up).
  const acceptUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://assethubmy.vercel.app"}/managers`;
  await sendMail({
    to: email,
    subject: `${me.name} invited you to share property visibility on AssetHub`,
    text: [
      `${me.name} (${me.email}) has invited you to share property visibility on AssetHub.`,
      "",
      "Sign in to AssetHub and accept the invitation under Managers → Invitations:",
      acceptUrl,
      "",
      "Once accepted, you and this manager will see each other's properties.",
    ].join("\n"),
  });

  await logAudit(
    "User",
    "INVITED",
    `Invited ${target.name} (${email}) to share property visibility.`,
    target.id,
    me.id,
  );

  return NextResponse.json({
    ok: true,
    invitation: {
      ...invitation,
      createdAt: invitation.createdAt.toISOString(),
      fromName: me.name,
      fromEmail: me.email,
      toName: null,
      toEmail: null,
    },
  });
}
