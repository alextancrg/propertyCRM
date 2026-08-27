import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { visibleManagerIds } from "@/lib/access";
import { ManagersClient } from "@/components/managers/ManagersClient";

export const dynamic = "force-dynamic";

export default async function ManagersPage() {
  const me = await requireUser();
  // Property Managers only see themselves + managers they share visibility
  // with; Administrators see every manager.
  const scope = await visibleManagerIds(me);
  const managers = (
    await prisma.user.findMany({
      where: scope ? { id: { in: scope } } : {},
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        language: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  ).map((m) => ({
    ...m,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  }));

  const [sent, received, sharing] = await Promise.all([
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
    prisma.managerSharing.findMany({
      where: { OR: [{ userAId: me.id }, { userBId: me.id }] },
      include: {
        userA: { select: { id: true, name: true, email: true } },
        userB: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);

  const serializeInvite = (i: {
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

  return (
    <ManagersClient
      me={me}
      managers={managers}
      sent={sent.map(serializeInvite)}
      received={received.map(serializeInvite)}
      sharing={sharing.map((s) => {
        const partner = s.userAId === me.id ? s.userB : s.userA;
        return {
          id: partner.id,
          name: partner.name,
          email: partner.email,
          since: s.createdAt.toISOString(),
        };
      })}
    />
  );
}
