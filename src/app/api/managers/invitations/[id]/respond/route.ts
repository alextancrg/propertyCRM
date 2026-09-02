import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { logAudit } from "@/lib/ai";
import { MAX_SHARING_PARTNERS } from "@/lib/sharing";
import { isSharingCapUser, sharingPartnerIds } from "@/lib/access";

export const dynamic = "force-dynamic";

// Accept or decline a sharing invitation. Only the invited manager can respond.
// Accepting creates a bidirectional ManagerSharing link (canonical pair) so the
// two managers see each other's properties; visibility is transitive across the
// whole sharing graph.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action =
    body.action === "accept" ? "accept" : body.action === "decline" ? "decline" : null;
  if (!action) {
    return NextResponse.json(
      { error: 'action must be "accept" or "decline".' },
      { status: 400 },
    );
  }

  const invitation = await prisma.managerInvitation.findUnique({
    where: { id },
    include: { fromUser: { select: { id: true, name: true, email: true, role: true } } },
  });
  if (!invitation) {
    return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
  }
  if (invitation.status !== "pending") {
    return NextResponse.json(
      { error: "This invitation is no longer pending." },
      { status: 400 },
    );
  }

  const isInvitee =
    invitation.toUserId === me.id ||
    (invitation.toUserId === null && invitation.email === me.email);
  if (!isInvitee) {
    return NextResponse.json(
      { error: "Only the invited manager can respond to this invitation." },
      { status: 403 },
    );
  }

  if (action === "decline") {
    await prisma.managerInvitation.update({
      where: { id },
      data: { status: "declined", toUserId: me.id, respondedAt: new Date() },
    });
    await logAudit(
      "User",
      "DECLINED",
      `${me.name} declined the sharing invitation from ${invitation.fromUser.name}.`,
      id,
      me.id,
    );
    return NextResponse.json({ ok: true, status: "declined" });
  }

  // Accept — create the bidirectional sharing link (canonical id order).
  // A Property Manager may only share/link with up to 5 other managers, so
  // enforce the cap for BOTH managers before linking them.
  for (const party of [
    { id: invitation.fromUserId, role: invitation.fromUser.role },
    { id: me.id, role: me.role },
  ]) {
    if (!isSharingCapUser(party)) continue;
    const partners = (await sharingPartnerIds(party.id)).filter(
      (pid) => pid !== invitation.fromUserId && pid !== me.id,
    );
    if (partners.length >= MAX_SHARING_PARTNERS) {
      const isMe = party.id === me.id;
      const who = isMe ? "You" : `${invitation.fromUser.name}`;
      const verb = isMe ? "have" : "has";
      return NextResponse.json(
        {
          error: `Sharing is limited to ${MAX_SHARING_PARTNERS} property managers per manager. ${who} already ${verb} ${partners.length} sharing partner${partners.length === 1 ? "" : "s"}, so this link cannot be added.`,
        },
        { status: 409 },
      );
    }
  }

  const [a, b] = [invitation.fromUserId, me.id].sort();
  await prisma.managerSharing.upsert({
    where: { userAId_userBId: { userAId: a, userBId: b } },
    create: { userAId: a, userBId: b },
    update: {},
  });
  await prisma.managerInvitation.update({
    where: { id },
    data: { status: "accepted", toUserId: me.id, respondedAt: new Date() },
  });
  await logAudit(
    "User",
    "ACCEPTED",
    `${me.name} accepted the sharing invitation from ${invitation.fromUser.name}. Property visibility is now shared.`,
    id,
    me.id,
  );

  return NextResponse.json({ ok: true, status: "accepted" });
}
