import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { ManagersClient } from "@/components/managers/ManagersClient";

export const dynamic = "force-dynamic";

export default async function ManagersPage() {
  const me = await requireUser();
  const managers = (
    await prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
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

  return <ManagersClient me={me} managers={managers} />;
}
