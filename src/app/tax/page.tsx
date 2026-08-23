import { prisma } from "@/lib/prisma";
import { TaxClient } from "@/components/tax/TaxClient";
import { buildOwnerStatements } from "@/lib/tax";
import { requireUser } from "@/lib/auth";
import { visibleOwnerIds } from "@/lib/access";

export const dynamic = "force-dynamic";

export default async function TaxPage() {
  const me = await requireUser();
  const ownerScope = await visibleOwnerIds(me);
  const [statements, auditLogs] = await Promise.all([
    buildOwnerStatements(ownerScope),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { user: { select: { name: true } } },
    }),
  ]);

  const years = statements[0]?.years.map((y) => y.year) ?? [];

  return (
    <TaxClient
      statements={statements}
      years={years}
      auditLogs={auditLogs.map((l) => ({
        id: l.id,
        action: l.action,
        entityType: l.entityType,
        description: l.description,
        createdAt: l.createdAt.toISOString(),
        userName: l.user?.name ?? null,
      }))}
    />
  );
}
