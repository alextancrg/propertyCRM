import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// List the invitations sent by, and received by, the logged-in manager.
export async function GET() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const [sent, received] = await Promise.all([
    prisma.managerInvitation.findMany({
      where: { fromUserId: me.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { toUser: { select: { id: true, name: true, email: true } } },
    }),
    prisma.managerInvitation.findMany({
      where: {
        OR: [{ toUserId: me.id }, { toUserId: null, email: me.email, status: "pending" }],
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { fromUser: { select: { id: true, name: true, email: true } } },
    }),
  ]);

  const serialize = (i: {
    id: string;
    fromUserId: string;
    email: string;
    status: string;
    createdAt: Date;
    respondedAt: Date | null;
    toUserId: string | null;
    fromUser?: { id: string; name: string; email: string } | null;
    toUser?: { id: string; name: string; email: string } | null;
  }) => ({
    id: i.id,
    fromUserId: i.fromUserId,
    fromName: i.fromUser?.name ?? "",
    fromEmail: i.fromUser?.email ?? "",
    email: i.email,
    status: i.status,
    createdAt: i.createdAt.toISOString(),
    respondedAt: i.respondedAt?.toISOString() ?? null,
    toUserId: i.toUserId,
    toName: i.toUser?.name ?? null,
    toEmail: i.toUser?.email ?? null,
  });

  return NextResponse.json({
    sent: sent.map(serialize),
    received: received.map(serialize),
  });
}
